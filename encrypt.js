import * as crypto from 'crypto';

function encryptData(object) {
	let key1 = crypto.randomBytes(32);
	let key2 = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv('aes-256-cbc', key1, key2);
	let encrypted = cipher.update(JSON.stringify(object), 'utf8');
	encrypted = Buffer.concat([encrypted, cipher.final()]).toString('base64');
	key1 = crypto.publicEncrypt(process.env.VUE_APP_RDP_SSO_PUB, key1).toString('base64');
	key2 = crypto.publicEncrypt(process.env.VUE_APP_RDP_SSO_PUB, key2).toString('base64');
	return {
		k1: key1,
		k2: key2,
		k3: encrypted,
	};
}

export default encryptData;
