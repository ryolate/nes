import * as admin from "firebase-admin";

export class Client {
	private readonly bucket

	constructor() {
		const secretKey = "./firebase_admin_key.json";
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const serviceAccount = require(secretKey)
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
			storageBucket: "tsnes-324212.appspot.com",
		});
		this.bucket = admin.storage().bucket()
	}

	// Upload the file to firebase storage using bucket API
	// https://googleapis.dev/nodejs/storage/latest/Bucket.html
	async uploadFile(localPath: string, remotePath: string): Promise<void> {
		const [file,] = await this.bucket.upload(localPath, {
			destination: remotePath,
		}).catch(e => {
			console.error(`uploadFile(${localPath}, ${remotePath}) failed: ${e}`)
			throw e
		})

		const now = new Date()
		const signedURL = await file.getSignedUrl({
			action: "read",
			expires: now.setDate(now.getDate() + 1),
		})
		console.log(`success! ${signedURL}`)
		return
	}
}
