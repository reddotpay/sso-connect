import * as crypto from 'crypto';

const k1Length = 32;
const k2Length = 16;

function encryptData(object) {
	let key1 = crypto.randomBytes(k1Length);
	let key2 = crypto.randomBytes(k2Length);
	const cipher = crypto.createCipheriv('aes-256-gcm', key1, key2);
	let encrypted = cipher.update(JSON.stringify(object), 'utf8');
	encrypted = Buffer.concat([encrypted, cipher.final()]).toString('base64');
	key1 = crypto.publicEncrypt(process.env.VUE_APP_RDP_SSO_PUB, key1).toString('base64');
	key2 = crypto.publicEncrypt(process.env.VUE_APP_RDP_SSO_PUB, key2).toString('base64');
	const key4 = crypto.publicEncrypt(process.env.VUE_APP_RDP_SSO_PUB, cipher.getAuthTag()).toString('base64');
	return {
		k1: key1,
		k2: key2,
		k3: encrypted,
		k4: key4,
	};
}

export default encryptData;
