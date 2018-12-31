class localStorageClass {

	constructor() {
		this.storageAvailable = true;
		if (typeof (Storage) ==='undefined') {
			this.storageAvailable = false;
		}
	}

	storeLocal(key, value) {
		if (!this.storageAvailable) {
			return false;
		}
		localStorage.setItem(key, value);
		return true;
	}

	getLocal(key) {
		if (!this.storageAvailable) {
			return false;
		}
		const str = localStorage.getItem(key);
		if (!str) {
			return false;
		}
		return str;
	}

	removeLocal(key) {
		if (!this.storageAvailable) {
			return false;
		}
		localStorage.removeItem(key);
		return true;
	}

	clearAllLocal() {
		if (!this.storageAvailable) {
			return false;
		}
		localStorage.clear();
		return true;
	}
}

const LS = localStorageClass;
const ls = new LS();

export default ls;
