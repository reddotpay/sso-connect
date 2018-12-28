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
#### Environment variables
```
VUE_APP_RDP_SSO_ENDPOINT="https://sso.api.reddotpay.sg"
VUE_APP_RDP_SSO_PAGE="https://sso.reddotpay.sg"
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
		vue.$sso.checkSSO(vue.$route);
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

