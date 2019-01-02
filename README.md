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
		},
		{
			path: '/auth',
			component: Auth,
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
	if (window.location.pathname.length >= 2) {
		window.location = `${window.location.origin}/#${window.location.pathname}${window.location.search}`;
	}
	SSO.init(to, from, router);
	next();
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

