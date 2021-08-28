import * as GS from '@google-cloud/storage'

const projectID = "tsnes-324212"
const bucketID = "ci-tsnes-324212"

const storage = new GS.Storage({
	projectId: projectID,
	keyFile: "src/testing/ci/ci-uploader_secret_key.json",
});

export class Client {
	async uploadFile(localPath: string, remotePath: string): Promise<GS.UploadResponse> {
		return storage.bucket(bucketID).upload(localPath, {
			destination: remotePath,
		})
	}
}
