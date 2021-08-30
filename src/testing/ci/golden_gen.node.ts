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
		path.basename(path.dirname(testROM)),
		path.basename(testROM) + `@${frame}.png`)
}

// write images without overwriting existing files.
// Retuns updated file paths.
// If overwrite is true, files are overwritten even if they exist.
async function writeImages(tmpdir: string, overwrite?: boolean): Promise<Array<string>> {
	const res: Array<string> = []
	await Promise.all(targets.map(async line => {
		const [testROM, frame] = parseLine(line)
		const filepath = localFilePath(tmpdir, testROM, frame)
		if (!overwrite && fs.existsSync(filepath)) {
			return
		}
		const data = fs.readFileSync(path.join(__dirname, "../../..", testROM))
		let nes: NES.NES
		try {
			nes = NES.NES.fromCartridgeData(data)
			nes.frame(frame)
		} catch (err) {
			console.error(`${testROM}: NES failure: ${err}`)
			throw err
		}
		fs.mkdirSync(path.dirname(filepath), { recursive: true })
		res.push(filepath)
		await writeBufferAsImage(nes.buffer(), filepath)
	}))
	return res
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
		new RegExp('^src/testing/ci/golden_gen.ts$'),
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

	console.log(`writing images in ${localBaseDir}`)
	const filesToUpload = await writeImages(localBaseDir, opts.overwrite)

	const latest = path.join(localRoot, "latest")
	fs.unlinkSync(latest)
	fs.symlinkSync(localBaseDir, latest)

	if (opts.upload) {
		const cl = opts.development ? new fire.DevClient() : new fire.Client()
		await Promise.all(filesToUpload.map(localPath => {
			const remotePath = path.relative(localRoot, localPath)
			return cl.uploadFile(localPath, remotePath)
		}))
	}
	console.log(`all done!`)
	process.exit(0)
}

main().catch(console.error)
