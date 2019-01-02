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
		this.ssoShortTimeout = (process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT !== undefined) ?  process.env.VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT : '30m';
	}

	async init(vueRouteTo, vueRouteFrom, vueRouter) {
		if(vueRouteTo.name === 'auth'
		|| vueRouteTo.name === 'login'
		|| vueRouteTo.name === 'show') {
			return;
		}
		if (this.getShortLiveToken()) {
			return true;
		}
		this._storeLocalPathBeforeRedirect(vueRouteFrom);
		vueRouter.push('auth');
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
		} else if (mToken && this.getSSOData(mToken) && this.exchangeJWT()) {
			this._redirectToFrom(vueRouter);
			return true;
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
		if (!shortLive || !jwt.verifyPublicToken(shortLive)) {
			return false;
		}
		const rdpJWT = ls.getLocal(this.ssoKey);
		if (!rdpJWT || !this.getSSOData(rdpJWT)) {
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

	_storeLocalPathBeforeRedirect(vueRoute) {
		ls.storeLocal(this.fromKey, vueRoute.fullPath);
		ls.storeLocal(this.originKey, `${window.location.protocol}//${window.location.host}`);
	}

	_redirectToFrom(vueRouter) {
		const from = ls.getLocal(this.fromKey);
			console.log(`from: ${from}`);
			ls.removeLocal(this.fromKey);
			vueRouter.push(from);
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
