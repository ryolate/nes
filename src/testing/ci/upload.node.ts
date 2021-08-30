import * as admin from "firebase-admin";
import { devInit } from './firebase_util';
import { adminInitOnce } from "./firebase_admin_util.node";
import * as fs from 'node:fs'

export class Client {
	private readonly bucket

	constructor() {
		adminInitOnce()
		this.bucket = admin.storage().bucket()
	}

	// Upload the file to firebase storage using bucket API
	// https://googleapis.dev/nodejs/storage/latest/Bucket.html
	async uploadFile(localPath: string, remotePath: string): Promise<void> {
		console.log(`uploading to ${remotePath}...`)
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

import firebase from 'firebase/app'
import 'firebase/storage'
export class DevClient {
	constructor() {
		devInit()
	}
	async uploadFile(localPath: string, remotePath: string): Promise<void> {
		const data = fs.readFileSync(localPath)
		console.log(`uploading ${remotePath} to emulator`)
		const snapshot = await firebase.storage().ref().child(remotePath).put(data)
		console.log(`uploaded ${snapshot.metadata.fullPath}`)
	}
}
