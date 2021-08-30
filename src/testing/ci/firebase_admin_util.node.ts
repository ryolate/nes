import * as admin from "firebase-admin";

const secretKey = "./firebase_admin_key.json";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require(secretKey)

export function adminInitOnce(): void {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		storageBucket: "tsnes-324212.appspot.com",
	});
}
