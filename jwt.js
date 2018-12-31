import * as jsonwebtoken from 'jsonwebtoken';

class jwtClass {
	constructor() {
		this.jwt = jsonwebtoken;
		this.algo = 'RS256';
		this.public_key = process.env.VUE_APP_RDP_SSO_PUB;
		this.issuer = process.env.VUE_APP_RDP_SSO_ISS;
		this.options = {
			algorithm: this.algo,
			issuer: this.issuer,
		};
	}

	verifyToken(token) {
		try {
			const verify = this.jwt.verify(token, this.public_key, this.options);
			console.log(verify);
			return verify;
		} catch (err) {
			console.log(err);
			return false;
		}
	}

	generatePublicToken(payload, expiresIn) {
		const publicOptions = this.options;
		publicOptions.algorithm = 'none';
		if (typeof expiresIn !== 'undefined' && expiresIn) {
			publicOptions.expiresIn = expiresIn;
		}
		const token = this.jwt.sign(payload, '', publicOptions);
		return token;
	}

	verifyPublicToken(token) {
		try {
			const publicOptions = this.options;
			publicOptions.algorithm = 'none';
			if (this.jwt.verify(token, '', publicOptions)) {
				return true;
			}
			return false;
		} catch (err) {
			return false;
		}
	}
}

// module.exports = new jwtClass();
const JWT = jwtClass;
const jwt = new JWT();
// module.exports = jwt;

export default jwt;
