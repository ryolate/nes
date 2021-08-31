import * as admin from "firebase-admin";

const secretKey = "./firebase_admin_key.json";

function credential() {
	if (process.env.FIREBASE_CONFIG) {
		return JSON.parse(process.env.FIREBASE_CONFIG)
	}
	return require(secretKey)
}

export function adminInitOnce(): void {
	credential()
	admin.initializeApp({
		credential: admin.credential.cert(credential()),
		storageBucket: "tsnes-324212.appspot.com",
	});
}
