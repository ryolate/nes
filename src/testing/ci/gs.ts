import * as gs from '@google-cloud/storage'
import * as fs from 'fs'

const projectID = "tsnes-324212"
const bucketID = "ci-tsnes-324212"

const keyFilePath = __dirname + "/ci-uploader_secret_key.json"

if (!fs.existsSync(keyFilePath)) {
	console.error(`${keyFilePath} not found`)
}

const storage = new gs.Storage({
	projectId: projectID,
	keyFilename: keyFilePath,
});

export class Client {
	bucket(): gs.Bucket {
		return storage.bucket(bucketID)
	}
	async uploadFile(localPath: string, remotePath: string): Promise<gs.UploadResponse> {
		return storage.bucket(bucketID).upload(localPath, {
			destination: remotePath,
		}).catch(e => {
			console.error(`uploadFile(${localPath}, ${remotePath}) failed: ${e}`)
			throw e
		})
	}
	async getRecent() {
		const b = this.bucket()
		const [, , prefixes]: [unknown, unknown, Array<string>]
			= await b.getFiles({
				autoPaginate: false,
				delimiter: '/',
			})
		const [files, ,] = await b.getFiles({
			autoPaginate: false,
			prefix: prefixes[0],
		})
		console.log(files[0].metadata.updated)
		// const x = res[0]
		// console.log(x[0].metadata)
	}

}

const urlPrefix = "https://storage.cloud.google.com/" + bucketID
export function urlFor(remotePath: string): string {
	return urlPrefix + "/" + encodeURI(remotePath)
}

// new Client().getRecent()