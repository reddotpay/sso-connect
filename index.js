import jwt from './jwt';
import ls from './localstorage';

const axios = require('axios');

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
		this.ssoShortTimeout = (process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT) ? process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT : '15m';
	}

	async init(vueRouteTo, vueRouteFrom, vueRouter, defaultRoutePath) {
		if (vueRouteTo.name === 'auth'
		|| vueRouteTo.name === 'login'
		|| vueRouteTo.name === 'show'
		|| vueRouteTo.name === 'logout'
		|| vueRouteTo.name === 'error'
		|| vueRouteTo.name === 'notfound') {
			return;
		}
		if (this.getSSOData()) {
			if (this.getShortLiveToken() || this._verifyToken(this.getSSOToken())) {
				return;
			}
		}
		if (typeof defaultRoutePath !== 'undefined') {
			ls.storeLocal(this.defaultFromKey, defaultRoutePath);
		}
		this._storeLocalPathBeforeRedirect(vueRouteTo);
		vueRouter.push({ path: '/auth' });
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

	async doLogout() {
		const rdpJWT = ls.getLocal(this.ssoKey);
		ls.removeLocal(this.ssoKey);
		ls.removeLocal(this.permKey);
		ls.removeLocal(this.ssoShortKey);
		if (this.getSSOData(rdpJWT)) {
			return axios.post(
				`${this.ssoEndPoint}/logout`,
				{
					rdp_jwt: rdpJWT,
				},
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				},
			)
				.then(() => true)
				.catch(() => false);
		}
		return true;
	}

	async checkSSO(vueRouter) {
		const rdpJWT = ls.getLocal(this.ssoKey);
		const mToken = ls.getLocal(this.mTokenKey);
		// if token exists, verify with the server
		if (rdpJWT && this.getSSOData(rdpJWT)) {
			// Verify SSO key with sso server
			if (await this._verifyToken(rdpJWT)) {
				this._redirectToFrom(vueRouter);
				return true;
			}
			// if token not valid / expired, remove JWT from local storage and proceed to login
			ls.removeLocal(this.ssoKey);
			// if mtoken exists, and is valid, exchange for jwt
		} else if (mToken && this.getSSOData(mToken)) {
			if (await this.exchangeJWT()) {
				this._redirectToFrom(vueRouter);
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
		if (mToken) {
			// verify mToken
			if (this.getSSOData(mToken)) {
				return axios.post(
					`${this.ssoEndPoint}/exchange`,
					{
						rdp_mtoken: mToken,
					},
					{
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
					},
				).then((response) => {
					if (response.status === 200
					&& response.data.rdp_jwt && this.getSSOData(response.data.rdp_jwt)
					&& response.data.rdp_perm) {
						this.storeSSO(response.data.rdp_jwt);
						this.storePermissions(response.data.rdp_perm);
						this.storeShortLiveToken();
						return true;
					}
					return false;
				}).catch(() => false);
			}
		}
		// Token expired, redirect back to login page
		return false;
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
		if (ls.getLocal(this.ssoKey)) {
			const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
			if (data) {
				return data;
			}
			ls.removeLocal(this.ssoKey);
		}
		return false;
	}

	getUserID() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_uuid;
		}
		return false;
	}

	getUserName() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_username;
		}
		return false;
	}

	getUserFirstName() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_firstname;
		}
		return false;
	}

	getUserLastName() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_lastname;
		}
		return false;
	}

	getCompanyID() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_company;
		}
		return false;
	}

	getCompanyName() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_companyName;
		}
		return false;
	}

	getCompanyGroupID() {
		const data = jwt.verifyToken(ls.getLocal(this.ssoKey));
		if (data) {
			return data.rdp_groupID;
		}
		return false;
	}

	getSSOToken() {
		if (jwt.verifyToken(ls.getLocal(this.ssoKey))) {
			return ls.getLocal(this.ssoKey);
		}
		return false;
	}

	storeShortLiveToken() {
		return ls.storeLocal(this.ssoShortKey, jwt.generatePublicToken({ body: 'empty' }, this.ssoShortTimeout));
	}

	getShortLiveToken() {
		const shortLive = ls.getLocal(this.ssoShortKey);
		if (!shortLive || !jwt.verifyPublicToken(shortLive)) {
			ls.removeLocal(this.ssoShortKey);
			return false;
		}
		return true;
	}

	storePermissions(value) {
		return ls.storeLocal(this.permKey, value);
	}

	getPermissions() {
		return ls.getLocal(this.permKey);
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
		vueRouter.push({ path: from });
	}

	_redirectToLogin() {
		const from = encodeURIComponent(ls.getLocal(this.fromKey));
		const origin = encodeURIComponent(ls.getLocal(this.originKey));
		const finalURI = `${this.ssoPage}/#/auth?from=${from}&origin=${origin}`;
		window.location = finalURI;
	}

	_verifyToken(rdpJWT) {
		return axios.post(
			`${this.ssoEndPoint}/verify`,
			{
				rdp_jwt: rdpJWT,
			},
			{
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			},
		).then((response) => {
			this.storeShortLiveToken();
			return response.status === 200;
		}).catch(() => false);
	}
}

const SSO = rdpSSO;
const rdpsso = new SSO();

export default rdpsso;
