import jwt from './jwt';
import ls from './localstorage';

const axios = require('axios');

// to be used by modules

class rdpSSO {
	constructor() {
		this.ssoKey = 'rdp-sso-jwtkey';
		this.permKey = 'rdp-sso-permissionkey';
		this.fromKey = 'rdp-sso-from';
		this.originKey = 'rdp-sso-origin';
		this.mTokenKey = 'rdp-sso-mtoken';
		this.ssoEndPoint = process.env.VUE_APP_RDP_SSO_ENDPOINT;
		this.ssoPage = process.env.VUE_APP_RDP_SSO_PAGE;
		this.fromURL = '';
		this.mToken = '';
	}

	async doLogin(vueRoute, vueRouter) {
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
		// let rdpJWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZABfdXNlcm5hbWUiOiJsbGpoOTlAaG90bWFpbC5jb20iLCJyZHBfZmlyc3RuYW1lIjoiTGVyb3kiLCJyZHBfbGFzdG5hbWUiOiJMZWUiLCJyZHBfdXVpZCI6IjY4YTcyYzIwLTgzMzctNGM3OC04NjdjLWQ1M2Y2YTA0OTMwZCIsInJkcF9hdXRoIjoiYXV0aCIsImlhdCI6MTU0NDUxMzI5MCwiaXNzIjoiUkRQX1NTTyJ9.rUdZktzafiLVJAWXihylkwmjIacQ6WO4_V454eUun_6WFLjpNMpEfNGFdH3poifHQ-fFFWke7GICTeNeISU4WjQ25eLFW3jx3c_LZlI-M_mT5lXDTRvik7IuCcNdvEJ8-qIeIaNkSvPumPBN8CaxwWQNBdj1Nif90JHOIfP0BmQMXE81hxj_dk87NOnyhmcy5nMVNPbFGV6iutu3w_urGl5fEjzk-b0qd2BY4jSmX7OcgFLpVvBv9z0d-Ze6uJrZb8aH7c0sp8jAj13M9TcF7ga5Hge2v8wqa3YgoJRI3I_xtvd-kJaf0jMnnBR_eeuMpj3T1UqNOPdwwR_c1MEzlg';
		if (rdpJWT && this.getSSOData(rdpJWT)) {
			// Verify SSO key with sso server
			console.log('verifying with auth');
			// if token not valid, remove JWT from local storage and proceed to login
			if (!await this._verifyToken(rdpJWT)) {
				ls.removeLocal(this.ssoKey);
			} else {
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
						ls.removeLocal(this.mTokenKey);
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