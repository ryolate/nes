// Image generator
// Creates images running nes against each rom in target.txt.
// They are uploaded to GS or stored locally.
import * as canvas from 'canvas'
import * as fs from 'node:fs'
import * as path from 'node:path'

import commander from 'commander'

import * as git from './git.node'
import * as NES from '../../nes/nes'
import * as fire from './upload.node'

const targets = fs.readFileSync(__dirname + '/target.txt', 'utf8').split("\n").filter((line: string) => {
	if (line.length === 0 || line[0] === '#') {
		return false
	}
	return true
})

async function writeBufferAsImage(buffer: Uint8ClampedArray, filepath: string) {
	const width = 256, height = 240
	const cnv = canvas.createCanvas(width, height)
	const ctx = cnv.getContext('2d')
	ctx.putImageData(new canvas.ImageData(buffer, width, height), 0, 0)

	const out = fs.createWriteStream(filepath)
	const stream = cnv.createPNGStream()
	stream.pipe(out)

	await new Promise<void>((resolve, reject) => {
		out.on('finish', () => {
			resolve()
		})
		out.on('error', (err: Error) => {
			reject(err)
		})
	})
}

function parseLine(line: string): [string, number] {
	const ss = line.split(/\s+/)

	const filepath = ss[0]
	const frame = ss.length > 1 ? parseInt(ss[1]) : 60
	return [filepath, frame]
}

function localFilePath(tmpdir: string, testROM: string, frame: number): string {
	return path.join(tmpdir,
		path.dirname(testROM),
		path.basename(testROM) + `@${frame}.png`)
}

interface ImageData {
	sha1: string
	filepath: string
}

import * as crypto from "crypto"

function sha1sum(data: Buffer): string {
	return crypto.createHash("sha1").update(data).digest('hex')
}

// write images without overwriting existing files.
// Retuns updated file paths.
// If overwrite is true, files are overwritten even if they exist.
function writeImages(tmpdir: string, overwrite?: boolean): Array<Promise<ImageData | undefined>> {
	return targets.map(line => {
		async function f() {
			const [testROM, frame] = parseLine(line)
			const filepath = localFilePath(tmpdir, testROM, frame)
			if (!overwrite && fs.existsSync(filepath)) {
				return
			}
			const data = fs.readFileSync(path.join(__dirname, "../../../testdata/nes-test-roms", testROM))
			let nes: NES.NES
			try {
				nes = NES.NES.fromCartridgeData(data)

				console.log(`Running ${line}`)
				nes.frame(frame)
			} catch (err) {
				console.error(`${testROM}: NES failure: ${err}`)
				throw err
			}
			fs.mkdirSync(path.dirname(filepath), { recursive: true })
			await writeBufferAsImage(nes.buffer(), filepath)

			const imageSHA1 = sha1sum(fs.readFileSync(filepath))
			return {
				filepath: filepath,
				sha1: imageSHA1
			}
		}
		return f()
	})
}

async function main() {
	const program = new commander.Command()
	program
		.option('--upload', 'upload the results to GS')
		.option('--overwrite', 'overwrite existing local files')
		.option('--ignore-dirty', 'ignore dirty (uncommitted) files')
		.option('--development', 'upload files to devserver')
	program.parse(process.argv)

	const opts = program.opts() as {
		ignoreDirty: boolean,
		overwrite: boolean,
		upload: boolean
		development: boolean,
	}

	const dirty = await git.dirtyFiles([
		/^.*\.md$/,
		/^.*\.tsx$/,
		/^.*\.json$/,
	])
	const isDirty = dirty.length > 0
	if (isDirty) {
		if (opts.ignoreDirty) {
			console.log(`working directory not clean; continue`)
		} else {
			throw new Error(`working directory not clean; stash or commit ${dirty}`)
		}
	}

	const timestamp = await git.headCommiterDateTimestamp()
	const hash = await git.headHash()
	const localRoot = "/tmp/nes"
	const remoteBaseDir = timestamp + "-" + hash + (dirty.length > 0 ? '-dirty' : '')
	const localBaseDir = path.join(localRoot, remoteBaseDir)

	const filesToUpload = writeImages(localBaseDir, opts.overwrite)

	if (opts.development) {
		throw new Error(`--development is not supported`)
	}
	const cl = new fire.Client()
	await Promise.all(filesToUpload.map(fileToUploadPromise => {
		async function f() {
			const fileToUpload = await fileToUploadPromise
			if (!fileToUpload) {
				return
			}
			const { sha1: imageSHA1, filepath: localPath } = fileToUpload
			const remotePath = path.relative(localRoot, localPath)
			const url = await cl.uploadFile(localPath, remotePath)
			const [version, ...testConfig] = remotePath.replace(".png", "").split("/")

			if (opts.upload) {
				await cl.updateFirestore(version, testConfig.join(":"), url, imageSHA1)
			}
		}
		return f()
	}))
	cl.close()

	const latest = path.join(localRoot, "latest")
	if (fs.existsSync(latest)) {
		fs.unlinkSync(latest)
	}
	fs.symlinkSync(localBaseDir, latest)

	console.log(`all done!`)
}

main().catch((e) => {
	console.error(e)
	throw e
})
