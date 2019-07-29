const axios = require('axios');
const jwt = require('./jwt');
const ls = require('./localstorage');
const encryptData = require('./encrypt');
// import jwt from './jwt'
// import ls from './localstorage'
// import encryptData from './encrypt'


// to be used by modules
class rdpSSO {
	constructor() {
		this.ssoShortKey = 'rdp-sso-shortkey';
		this.ssoKey = 'rdp-sso-jwtkey';
		this.permKey = 'rdp-sso-permissionkey';
		this.fromKey = 'rdp-sso-from';
		this.originKey = 'rdp-sso-origin';
		this.mTokenKey = 'rdp-sso-mtoken';
		this.defaultFromKey = 'rdp-sso-default-from';
		this.ssoEndPoint = process.env.VUE_APP_RDP_SSO_ENDPOINT;
		this.ssoPage = process.env.VUE_APP_RDP_SSO_PAGE;
		this.ssoShortTimeout = (process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT)
			? process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT
			: '15m';

		this.ssoIntervalFn = null;
		this.ssoToken = null;
		this.acl = null;
		this.isBackend = !ls.storageAvailable;
	}

	async init(vueRouteTo, vueRouteFrom, vueRouter, defaultRoutePath) {
		if (typeof defaultRoutePath !== 'undefined') {
			ls.storeLocal(this.defaultFromKey, defaultRoutePath);
		}
		if (vueRouteTo.name === 'auth'
		|| vueRouteTo.name === 'login'
		|| vueRouteTo.name === 'show'
		|| vueRouteTo.name === 'logout'
		|| vueRouteTo.name === 'error'
		|| vueRouteTo.name === 'notfound') {
			return;
		}
		this._storeLocalPathBeforeRedirect(vueRouteTo);
		this._performJWTCheck(1, vueRouter);
	}

	async backendCheckSSO(ssoJWT, productName) {
		if (!this.isBackend) {
			return;
		}
		const payload = {
			rdp_jwt: ssoJWT,
		};
		let getACL = false;
		if (productName !== 'undefined' && productName) {
			payload.product_name = productName;
			getACL = true;
		}

		// eslint-disable-next-line consistent-return
		return axios.post(`${this.ssoEndPoint}/exchange`,
			{
				payload: encryptData(payload),
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'X-Rdp-Csrf': 'sso',
					'X-Requested-With': 'XmlHttpRequest',
				},
			})
			.then((response) => {
				if (response.status === 200 && response.data) {
					this.ssoToken = ssoJWT;
					if (getACL && response.data.rdp_perm) {
						this.acl = JSON.parse(response.data.rdp_perm);
					}
					return true;
				}
				return false;
			})
			.catch(() => false);
	}

	async doLogin(vueRoute, vueRouter) {
		if (Object.keys(vueRoute.query).length) {
			if (vueRoute.query.mtoken) {
				ls.storeLocal(this.mTokenKey, vueRoute.query.mtoken);
			}
			if (vueRoute.query.from) {
				ls.storeLocal(this.fromKey, vueRoute.query.from);
			}
		}
		// unable to get the JWT token from auth server, redirect to login
		if (!await this.exchangeJWT()) {
			this._redirectToLogin();
		} else {
			this._redirectToFrom(vueRouter);
		}
	}

	async doLogout(callbackfn) {
		const rdpJWT = this._getSSOJWT();
		ls.removeLocal(this.ssoKey);
		ls.removeLocal(this.permKey);
		ls.removeLocal(this.ssoShortKey);
		const payload = {
			rdp_jwt: rdpJWT,
		};
		await axios.post(`${this.ssoEndPoint}/logout`,
			{
				payload: encryptData(payload),
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'X-Rdp-Csrf': 'sso',
					'X-Requested-With': 'XmlHttpRequest',
				},
			})
			.then(() => {
				if (typeof callbackfn === 'function') {
					callbackfn();
				}
				return true;
			})
			.catch(() => {
				if (typeof callbackfn === 'function') {
					callbackfn();
				}
				return false;
			});
	}

	async checkSSO(vueRouter) {
		const rdpJWT = this._getSSOJWT();
		const mToken = ls.getLocal(this.mTokenKey);
		// if token exists, verify with the server
		if (rdpJWT && this.getSSOData(rdpJWT)) {
			// Verify SSO key with sso server
			if (await this._verifyToken(rdpJWT)) {
				if (typeof vueRouter !== 'undefined' && vueRouter) {
					this._redirectToFrom(vueRouter);
				}
				return true;
			}
			// if token not valid / expired, remove JWT from local storage and proceed to login
			ls.removeLocal(this.ssoKey);
			// if mtoken exists, and is valid, exchange for jwt
		} else if (mToken && this.getSSOData(mToken)) {
			if (await this.exchangeJWT()) {
				if (typeof vueRouter !== 'undefined' && vueRouter) {
					this._redirectToFrom(vueRouter);
				}
				return true;
			}
			ls.removeLocal(this.mTokenKey);
		}
		// if no token exists, or token verification failed,
		// preform redirect to the login server

		this._redirectToLogin();
		return false;
	}

	exchangeJWT() {
		const mToken = ls.getLocal(this.mTokenKey);
		ls.removeLocal(this.mTokenKey);
		if (!mToken || !this.getSSOData(mToken)) {
			// Token expired, redirect back to login page
			return false;
		}
		// verify mToken
		const payload = {
			rdp_mtoken: mToken,
		};
		return axios.post(`${this.ssoEndPoint}/exchange`,
			{
				payload: encryptData(payload),
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'X-Rdp-Csrf': 'sso',
					'X-Requested-With': 'XmlHttpRequest',
				},
			})
			.then((response) => {
				if (response.status === 200
					&& response.data.rdp_jwt && this.getSSOData(response.data.rdp_jwt)
					&& response.data.rdp_perm) {
					this.storeSSO(response.data.rdp_jwt);
					this.storePermissions(response.data.rdp_perm);
					// this.storeShortLiveToken();
					return true;
				}
				return false;
			}).catch(() => false);
	}

	storeSSO(value) {
		return ls.storeLocal(this.ssoKey, value);
	}

	/**
	 *
	 * @param string value; optional parameter, of type SSO token
	 *
	 * @return object
	 * {
			"rdp_username": "test@test.com", // email address of the user when signing up
			"rdp_firstname": "test", // first name of the user when
			"rdp_lastname": "test", // last name of the user
			"rdp_company": "test", // companyID used to log in
			"rdp_companyName": "test", // company name entered when user signs up
			"rdp_groupID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // company UUID (used for MAM)
			"rdp_merchantID": "[merchantID1, merchantID2, ...] | '*' ", "// array of MerchantID | or '*' ('*' represents all MerchantID) that this user has permission for
			"rdp_uuid": "xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // UUID of user (used for permissions etc)
			"rdp_auth": "auth", // sso variables
			"iat": xxxxxxxx, // sso variables
			"iss": "xxxxx" // sso variables
		}
	 */
	getSSOData(value) {
		if (typeof value !== 'undefined' && value) {
			return jwt.verifyToken(value);
		}
		const data = jwt.verifyToken(this._getSSOJWT());
		if (!data) {
			ls.removeLocal(this.ssoKey);
			this.ssoToken = null;
			return false;
		}
		return data;
	}

	getUserID() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_uuid;
	}

	getUserName() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_username;
	}

	getUserFirstName() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_firstname;
	}

	getUserLastName() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_lastname;
	}

	getCompanyID() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_company;
	}

	getCompanyName() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_companyName;
	}

	getMerchantID() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_merchantID;
	}

	getMerchantIDStaging() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_merchantID.Staging;
	}

	getMerchantIDProd() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_merchantID.Production;
	}

	getRootMerchantID() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_rootMerchantID;
	}

	getCompanyGroupID() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_groupID;
	}

	getUserRole() {
		const data = this.getSSOData();
		if (!data) {
			return false;
		}
		return data.rdp_role;
	}

	getSSOToken() {
		if (!jwt.verifyToken(this._getSSOJWT())) {
			ls.removeLocal(this.ssoKey);
			this.ssoToken = null;
			return false;
		}
		return this._getSSOJWT();
	}

	// storeShortLiveToken() {
	// 	return true;
	// 	return ls.storeLocal(this.ssoShortKey, jwt.generatePublicToken({ body: 'empty' }, this.ssoShortTimeout));
	// }

	// getShortLiveToken() {
	// 	return true;
	// 	const shortLive = ls.getLocal(this.ssoShortKey);
	// 	if (!shortLive || !jwt.verifyPublicToken(shortLive)) {
	// 		ls.removeLocal(this.ssoShortKey);
	// 		return false;
	// 	}
	// 	return true;
	// }

	storePermissions(value) {
		return ls.storeLocal(this.permKey, value);
	}

	getPermissions() {
		return ls.getLocal(this.permKey);
	}

	_getSSOJWT() {
		if (this.ssoToken) {
			return this.ssoToken;
		}
		return ls.getLocal(this.ssoKey);
	}

	_storeLocalPathBeforeRedirect(vueRoute) {
		ls.storeLocal(this.fromKey, vueRoute.fullPath);
		ls.storeLocal(this.originKey, `${window.location.protocol}//${window.location.host}`);
	}

	_redirectToFrom(vueRouter) {
		let from = ls.getLocal(this.fromKey);
		ls.removeLocal(this.fromKey);
		if (ls.getLocal(this.defaultFromKey)) {
			from = ls.getLocal(this.defaultFromKey);
			ls.removeLocal(this.defaultFromKey);
		}
		// uses window.location if vueRouter doesnt exists
		if (typeof vueRouter !== 'undefined' && vueRouter) {
			vueRouter.push({ path: from });
		} else {
			const origin = ls.getLocal(this.originKey);
			window.location = `${origin}/#${from}`;
		}
	}

	_redirectToLogin() {
		const from = encodeURIComponent(ls.getLocal(this.fromKey));
		const origin = encodeURIComponent(ls.getLocal(this.originKey));
		const finalURI = `${this.ssoPage}/#/auth?from=${from}&origin=${origin}`;
		window.location = finalURI;
	}

	async _verifyToken(rdpJWT, loop) {
		const payload = {
			rdp_jwt: rdpJWT,
		};
		payload.loop = (loop !== undefined && loop) ? 1 : 0;
		return axios.post(`${this.ssoEndPoint}/verify`,
			{
				payload: encryptData(payload),
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'X-Rdp-Csrf': 'sso',
					'X-Requested-With': 'XmlHttpRequest',
				},
			})
			.then(response => response.status === 200)
			.catch(() => false);
		// this.storeShortLiveToken();
	}

	async _performJWTCheck(skipTimeout, vueRouter) {
		if (!skipTimeout) {
			if (this.ssoIntervalFn) {
				clearTimeout(this.ssoIntervalFn);
			}
		}

		if (this.getSSOData() && await this._verifyToken(this._getSSOJWT(), !skipTimeout)) {
			if (!skipTimeout || !this.ssoIntervalFn) {
				this.ssoIntervalFn = setTimeout(() => {
					this._performJWTCheck(0, vueRouter);
				}
				// eslint-disable-next-line no-magic-numbers
				, 60000);
			}
		} else {
			vueRouter.push({ path: '/auth' });
		}
	}
}

const SSO = rdpSSO;
const rdpsso = new SSO();

// export default rdpsso
module.exports = rdpsso;
