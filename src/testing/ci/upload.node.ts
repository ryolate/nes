import * as admin from "firebase-admin";
import "@google-cloud/firestore";
import { devInit, initOnce } from './firebase_util';
import { adminInitOnce } from "./firebase_admin_util.node";
import * as fs from 'node:fs'

import "firebase/app"
import "firebase/firestore"

export class Client {
	constructor() {
		adminInitOnce()
		initOnce(false)
	}

	// Upload the file to firebase storage using bucket API
	// https://googleapis.dev/nodejs/storage/latest/Bucket.html
	async uploadFile(localPath: string, remotePath: string): Promise<string> {
		console.log(`uploading to ${remotePath}...`)
		const [file,] = await admin.storage().bucket().upload(localPath, {
			destination: remotePath,
		}).catch(e => {
			console.error(`uploadFile(${localPath}, ${remotePath}) failed: ${e}`)
			throw e
		})

		await file.makePublic()
		if (!file.isPublic()) {
			throw new Error(`file ${file} is not public`)
		}
		return file.publicUrl()
	}

	async updateFirestore(version: string, testROM: string, persistentURL: string, imageSHA1: string): Promise<void> {
		await firebase.firestore().collection("imageHash").doc(version)
			.set({
				[testROM]: {
					url: persistentURL,
					imageSHA1: imageSHA1,
				}
			}, { merge: true })

		// const db = admin.firestore()
		// const ref = db.collection("results").doc(version)
		// This call hangs. https://github.com/FirebaseExtended/flutterfire/issues/4513
		// const result = await ref.set({ [testROM]: persistentURL }, { merge: true })

		console.log(`uploaded ${version}/${testROM} -> ${persistentURL}`)
	}
}

import firebase from 'firebase/app'
import 'firebase/storage'
import { firestore } from "firebase-admin";
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
