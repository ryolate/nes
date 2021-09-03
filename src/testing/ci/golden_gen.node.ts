/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Image generator
// Creates images running nes against each rom in target.txt.
// They are uploaded to GS or stored locally.
import canvas from 'canvas'
import cluster from 'node:cluster'
import fs from 'node:fs'
import { glob } from 'glob'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import commander from 'commander'

import * as git from './git.node'
import * as NES from '../../nes/nes'
import * as fire from './upload.node'

const NUM_WORKER = os.cpus().length

interface TestCase {
	filepath: string
	frameCount: number
}

const PREFIX = 'testdata/nes-test-roms/'

async function allTargets(): Promise<Array<TestCase>> {
	const frameMap = new Map<string, number>()
	for (const line of fs.readFileSync(__dirname + '/target.txt', 'utf8').split("\n")) {
		if (line.length === 0 || line[0] === '#') {
			continue
		}
		const ss = line.split(/\s+/)

		const fileglob = PREFIX + ss[0]
		const frame = ss.length > 1 ? parseInt(ss[1]) : 60
		await new Promise<void>((resolve, reject) => {
			glob.glob(fileglob, (err, files) => {
				if (err) {
					reject(err)
					return
				}
				if (files.length === 0) {
					reject(new Error(`No file matches ${fileglob}`))
				}
				for (const filepath of files) {
					frameMap.set(filepath, Math.max((frameMap.get(filepath) || 0), frame))
				}
				resolve()
			})
		})
	}
	const res = new Array<TestCase>()
	for (const [k, v] of frameMap.entries()) {
		res.push({
			filepath: k,
			frameCount: v,
		})
	}
	return res
}

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

function localFilePath(tmpdir: string, testROMPath: string, frame: number): string {
	const testROM = testROMPath.replace(PREFIX, "")
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
function writeImages(targets: Array<TestCase>, tmpdir: string, overwrite?: boolean): Array<Promise<ImageData | undefined>> {
	return targets.map(({ filepath: testROM, frameCount: frame }) => {
		async function f() {
			const filepath = localFilePath(tmpdir, testROM, frame)
			if (!overwrite && fs.existsSync(filepath)) {
				return
			}
			const data = fs.readFileSync(path.join(__dirname, "../../../", testROM))
			let nes: NES.NES
			try {
				nes = NES.NES.fromCartridgeData(data)
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

interface Option {
	ignoreDirty: boolean,
	overwrite: boolean,
	upload: boolean
	development: boolean,
}

async function isDirty(): Promise<boolean> {
	const dirty = await git.dirtyFiles([
		/^.*\.md$/,
		/^.*\.tsx$/,
		/^.*\.json$/,
	])
	return dirty.length > 0
}

const LOCAL_ROOT = "/tmp/nes"

async function processTargets(opts: Option, localBaseDir: string, targets: Array<TestCase>) {
	const filesToUpload = writeImages(targets, localBaseDir, opts.overwrite)

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
			const remotePath = path.relative(LOCAL_ROOT, localPath)
			const url = await cl.uploadFile(localPath, remotePath)
			const [version, ...testConfig] = remotePath.replace(".png", "").split("/")

			if (opts.upload) {
				await cl.updateFirestore(version, testConfig.join(":"), url, imageSHA1)
			}
		}
		return f()
	}))
	cl.close()
}

interface Message {
	localBaseDir: string
	targets: Array<TestCase>
}

async function workerFunc(opts: Option) {
	process.on("message", ({ localBaseDir, targets }: Message) => {
		processTargets(opts, localBaseDir, targets).catch((e) => {
			console.error(`Error on worker ${cluster.worker!.id}: ${e}`)
		}).then(() => {
			process.send!(cluster.worker!.id)
			cluster.worker?.disconnect()
		})
	})
}

async function primaryFun(opts: Option) {
	if (await isDirty()) {
		if (opts.ignoreDirty) {
			console.log(`working directory not clean; continue`)
		} else {
			throw new Error(`working directory not clean; stash or commit`)
		}
	}
	const timestamp = await git.headCommiterDateTimestamp()
	const hash = await git.headHash()
	const remoteBaseDir = timestamp + "-" + hash + (await isDirty() ? '-dirty' : '')
	const localBaseDir = path.join(LOCAL_ROOT, remoteBaseDir)

	const all = await allTargets()

	// process
	for (let i = 0; i < NUM_WORKER; i++) {
		const worker = cluster.fork()

		const targets = new Array<TestCase>()
		for (let j = i; j < all.length; j += NUM_WORKER) {
			targets.push(all[j])
		}
		worker.on('online', () => {
			worker.send({
				localBaseDir,
				targets,
			})
		})
	}

	await new Promise(resolve => {
		let doneCount = 0
		cluster.on('message', () => {
			doneCount++
			if (doneCount === NUM_WORKER) {
				resolve(0)
			}
		})
	})

	const latest = path.join(LOCAL_ROOT, "latest")
	if (fs.existsSync(latest)) {
		fs.unlinkSync(latest)
	}
	fs.symlinkSync(localBaseDir, latest)

	console.log(`all done!`)
}

async function main() {
	const program = new commander.Command()
	program
		.option('--upload', 'upload the results to GS')
		.option('--overwrite', 'overwrite existing local files')
		.option('--ignore-dirty', 'ignore dirty (uncommitted) files')
		.option('--development', 'upload files to devserver')
	program.parse(process.argv)

	const opts = program.opts() as Option

	if (cluster.isPrimary) {
		primaryFun(opts).catch(console.error)
	} else {
		workerFunc(opts).catch(console.error)
	}
}

main().catch((e) => {
	console.error(e)
	throw e
})
