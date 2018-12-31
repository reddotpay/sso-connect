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
		this.ssoEndPoint = process.env.VUE_APP_RDP_SSO_ENDPOINT;
		this.ssoPage = process.env.VUE_APP_RDP_SSO_PAGE;
		this.ssoShortTimeout = (process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT !== undefined) ?  process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT : 1800;
		this.fromURL = '';
		this.mToken = '';
	}

	async init(vueRoute) {
		if (this.getShortLiveToken()) {
			return true;
		}
		return this.checkSSO(vueRoute);
	}

	async doLogin(vueRoute, vueRouter) {
		console.log('calling frontend doLogin');
		if (Object.keys(vueRoute.query).length) {
			if (vueRoute.query.mtoken) {
				ls.storeLocal(this.mTokenKey, vueRoute.query.mtoken);
				this.mToken = vueRoute.query.mtoken;
			}
			if (vueRoute.query.from) {
				ls.storeLocal(this.fromKey, vueRoute.query.from);
				this.fromURL = vueRoute.query.from;
			}
		}
		// unable to get the JWT token from auth server, redirect to login
		if (!await this.exchangeJWT()) {
			console.log('failed to exchange token');
			this._redirectToLogin();
		} else {
			console.log('sso front push');
			vueRouter.push(this.fromURL);
		}
	}

	async checkSSO(vueRoute) {
		console.log('checking sso');
		const rdpJWT = ls.getLocal(this.ssoKey);
		const mToken = ls.getLocal(this.mTokenKey);
		// if token exists, verify with the server
		console.log(rdpJWT);
		if (rdpJWT && this.getSSOData(rdpJWT)) {
			// Verify SSO key with sso server
			console.log('verifying with auth');
			// if token not valid, remove JWT from local storage and proceed to login
			if (await this._verifyToken(rdpJWT)) {
				return true;
			}
			// if mtoken exists, and is valid, exchange for jwt
		} else if (mToken && this.getSSOData(mToken) && this.exchangeJWT()) {
			return true;
		}
		// if no token exists, or token verification failed,
		// preform redirect to the login server

		console.log(vueRoute);
		const from = encodeURIComponent(vueRoute.fullPath);
		ls.storeLocal(this.fromKey, from);
		let origin = `${window.location.protocol}//${window.location.host}`;
		origin = encodeURIComponent(origin);
		ls.storeLocal(this.originKey, origin);
		this._redirectToLogin();
		return false;
	}

	exchangeJWT() {
		console.log(`mtoken: ${this.mToken}`);
		console.log(`from: ${this.fromURL}`);
		ls.removeLocal(this.mTokenKey);

		if (this.mToken) {
			// verify mToken
			if (this.getSSOData(this.mToken)) {
				return axios.post(
					`${this.ssoEndPoint}/exchange`,
					{
						rdp_mtoken: this.mToken,
					},
					{
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
					},
				).then((response) => {
					console.log(response);
					if (response.status === 200
					&& response.data.rdp_jwt && this.getSSOData(response.data.rdp_jwt)
					&& response.data.rdp_perm) {
						this.storeSSO(response.data.rdp_jwt);
						this.storePermissions(response.data.rdp_perm);
						this.storeShortLiveToken();
						ls.removeLocal(this.fromKey);
						ls.removeLocal(this.originKey);
						return true;
					}
					return false;
				});
			}
		}
		// Token expired, redirect back to login page
		return false;
	}

	storeSSO(value) {
		return ls.storeLocal(this.ssoKey, value);
	}

	getSSOData(value) {
		if (value === undefined) {
			return jwt.verifyToken(ls.getLocal(this.ssoKey));
		}
		return jwt.verifyToken(value);
	}

	storeShortLiveToken() {
		return ls.storeLocal(this.ssoShortKey, jwt.generatePublicToken({ body: 'empty' }, this.ssoShortTimeout));
	}

	getShortLiveToken() {
		const shortLive = ls.getLocal(this.ssoShortKey);
		if (!shortLive) {
			return false;
		}
		if (!jwt.verifyPublicToken(shortLive)) {
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

	logout() {
		ls.removeLocal(this.ssoKey);
		ls.removeLocal(this.permKey);
	}

	_redirectToLogin() {
		const from = ls.getLocal(this.fromKey);
		const origin = ls.getLocal(this.originKey);
		const finalURI = `${this.ssoPage}/#/auth?from=${from}&origin=${origin}`;
		console.log(`sso ${this.ssoPage}`);
		console.log(`sso redirecting to ${finalURI}`);
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
			console.log(response);
			return response.status === 200;
		}).catch(() => false);
	}
}

const SSO = rdpSSO;
const rdpsso = new SSO();

export default rdpsso;
