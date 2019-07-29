# rdp-sso
[![npm (scoped)](https://img.shields.io/npm/v/@reddotpay/rdp-sso.svg)](https://www.npmjs.com/package/@reddotpay/rdp-sso)

SSO package for RDP products

## Install
```
npm install @reddotpay/rdp-sso
```

## Requirements
```
To be used with Vue 2.x and Vue-Router 3.x
```
#### Environment variables (build/buildenv.sh)
```
#!/bin/sh

PARENT_DIR=$( pwd -P )
PATH="${PARENT_DIR}/.env.development.local"
if [ "$1" == "prod" ]; then
	PATH="${CI_PROJECT_DIR}/frontend/.env.production"
fi

echo "VUE_APP_RDP_SSO_ENDPOINT=\"$RDP_SSO_ENDPOINT\"" >> $PATH
echo "VUE_APP_RDP_SSO_PAGE=\"$RDP_SSO_PAGE\"" >> $PATH
echo "VUE_APP_RDP_SSO_PUB=\"$RDP_SSO_PUBLIC_KEY\"" >> $PATH
echo "VUE_APP_RDP_SSO_ISS=\"$RDP_SSO_ISS\"" >> $PATH
echo "VUE_APP_RDP_SSO_SHORTKEY_TIMEOUT=\"$RDP_SSO_SHORTLIVE_TIMEOUT\"" >> $PATH
```

#### CSP
Allow `$RDP_SSO_CSP` in connect-src CSP

Create a few files below to use
#### auth.vue
Page to perform SSO token verification/exchange
```
<template>
</template>

<script>

export default {
	name: 'auth',
	mounted() {
		const vue = this;
		vue.$sso.checkSSO(vue.$router);
	}
}
</script>
```
#### login.vue
Page for callback URL from SSO after logging in
```
<template>
</template>

<script>

export default {
	name: 'login',
	mounted() {
		const vue = this;
		// omit vue.$router to use window.location for redirection
		vue.$sso.doLogin(vue.$route, vue.$router);
	}
}
</script>
```
#### Modify Router.js and add entry to routes
```
import Login from './views/login.vue'; // path to login.vue
import Auth from './views/auth.vue'; // path to auth.vue
routes: [
	{	// callback URL from SSO after logging in
		path: '/login',
		component: Login,
		name: 'login',
	},
	{	// URL to perform SSO token verification/exchange
		path: '/auth',
		component: Auth,
		name: 'auth',
	},
]
```

## Usage

#### main.js
```
import Vue from 'vue';
import SSO from '@reddotpay/rdp-sso';

Object.defineProperty(Vue.prototype, '$sso', { value: SSO });

router.beforeEach((to, from, next) => {
	// this line of code is to handle the hashed url properly, since we are not using history mode
	if (window.location.pathname.length >= 2) {
		window.location = `${window.location.origin}/#${window.location.pathname}${window.location.search}`;
	}

	// the entry point for SSO
	// SSO will redirect to optionalDefaultPath after login (/some-path)
	SSO.init(to, from, router, optionalDefaultPath);
	next();
});
```

#### To logout
```
const vue = this;
// supply a callback function to doLogout for redirect
vue.$sso.doLogout(function() {
	// vue.$router.push({ name: 'home' });
	// vue.$router.push({ path: '/' });
});
```

#### To get user's data
```
export default {
	mounted() {
		const vue = this;
		const userDataObj = vue.$sso.getSSOData();
	}
}
```
##### sample userDataObj
```
{
	"rdp_username": "test@test.com", // email address of the user when signing up
	"rdp_firstname": "test", // first name of the user when
	"rdp_lastname": "test", // last name of the user
	"rdp_company": "test", // companyID used to log in
	"rdp_companyName": "test", // company name entered when user signs up
	"rdp_groupID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // company UUID (used for MAM)
	"rdp_role": "merchant-admin"|"merchant-staff" // role of user
	"rdp_uuid": "xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // UUID of user (used for permissions etc)
	"rdp_auth": "auth", // sso variables
	"rdp_merchantID": "{ Staging: [merchantID1, merchantID2, ...] | '*',
						Production: [merchantID1, merchantID2, ...] | '*'
						}", "// array of MerchantID | or '*' ('*' represents all MerchantID) that this user has permission
	"iat": xxxxxxxx, // sso variables
	"iss": "xxxxx" // sso variables
}
```
To retrieve user data
```
const vue = this;

const userID = vue.$sso.getUserID(); // user unique identifier within the system
const userName = vue.$sso.getUserName(); // user email
const userFirstName = vue.$sso.getUserFirstName(); // user first name
const userLastName = vue.$sso.getUserLastName(); // user last name
const companyID = vue.$sso.getCompanyID(); // company ID used to log in to SSO
const companyName = vue.$sso.getCompanyName(); // company name entered by user when signing up
const companyGroupID = vue.$sso.getCompanyGroupID(); // company group ID tied to MAM and other services
const merchantID = vue.$sso.getMerchantID(); // Object of Staging & Production array of merchantIDs or *
const stagingMerchantID = vue.$sso.getMerchantIDStaging(); // array of staging merchantIDs
const productionMerchantID = vue.$sso.getMerchantIDProd(); // array of production merchantIDs
const userRole = vue.$sso.getUserRole(); // role of user
```

#### To get userToken
```
export default {
	mounted() {
		const vue = this;
		const userDataObj = vue.$sso.getSSOToken();
	}
}
```

#### To verify token / extend user session on backend
This should be run once per backend execution.
ssojwt should be sent from frontend products to backend

productName field is used to retrieve ACL permissions
```
const sso = require('@reddotpay/rdp-sso');
await sso.backendCheckSSO(ssojwt, 'productName'); // returns true or false
```

#### To extend user session
Frontend
```
this.$sso.checkSSO();
```
Backend
```
const sso = require('@reddotpay/rdp-sso');
await sso.backendCheckSSO(ssojwt); // returns true or false
```

#### To read permissions
```
export default {
	mounted() {
		const vue = this;
		const permissionsObj = vue.$sso.getPermissions();
	}
}
```

