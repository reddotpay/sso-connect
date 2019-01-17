# rdp-sso
[![npm (scoped)](https://img.shields.io/npm/v/@leroyleejh/rdp-sso.svg)](https://www.npmjs.com/package/@leroyleejh/rdp-sso)

SSO package for RDP products

## Install
```
npm install @leroyleejh/rdp-sso
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
Create a few files below to use
#### auth.vue
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
```
<template>
</template>

<script>

export default {
	name: 'login',
	mounted() {
		const vue = this;
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
		{
			path: '/login',
			component: Login,
			name: 'login',
		},
		{
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
import SSO from '@leroyleejh/rdp-sso';

Object.defineProperty(Vue.prototype, '$sso', { value: SSO });

router.beforeEach((to, from, next) => {
	// this line of code is to handle the hashed url properly, since we are not using history mode
	if (window.location.pathname.length >= 2) {
		window.location = `${window.location.origin}/#${window.location.pathname}${window.location.search}`;
	}

	// the entry point for SSO
	SSO.init(to, from, router);
	next();
}
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
##### sample serDataObj
```
{
	"rdp_username": "test@test.com",	// email address of the user when signing up
	"rdp_firstname": "test",				// first name of the user when
	"rdp_lastname": "test",					// last name of the user
	"rdp_company": "test",					// parsed company name when signing up (used to get MerchantId from MAM service)
	"rdp_uuid": "xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // UUID of this particular user (used for permissions etc)
	"rdp_auth": "auth",	// sso variables
	"iat": xxxxxxxx,	// sso variables
	"iss": "xxxxx"	// sso variables
}
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

