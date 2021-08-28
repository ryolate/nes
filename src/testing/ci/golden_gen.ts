// Image generator
// Creates images running nes against each rom in target.txt.
// They are uploaded to GS or stored locally.
import * as canvas from 'canvas'
import * as fs from 'fs'
import * as path from 'path'

import * as git from './git'
import * as gs from './gs'
import * as NES from '../../nes/nes'

import * as commander from 'commander'

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
async function writeImages(tmpdir: string) {
	parseLine(targets[0])

	await Promise.all(targets.map(async line => {
		const [testROM, frame] = parseLine(line)
		const filepath = localFilePath(tmpdir, testROM, frame)
		if (fs.existsSync(filepath)) {
			console.log(`${filepath} already exists; skip`)
			return
		}
		const data = fs.readFileSync(testROM)
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
	}))
}

async function* walk(dir: string): AsyncGenerator<string> {
	for await (const d of await fs.promises.opendir(dir)) {
		const entry = path.join(dir, d.name);
		if (d.isDirectory()) yield* walk(entry);
		else if (d.isFile()) yield entry;
	}
}

async function main() {
	const program = new commander.Command()
	program
		.option('--upload', 'upload the results to GS')
		.option('--ignore-dirty', 'ignore dirty (uncommitted) files')
	program.parse(process.argv)

	const opts: {
		"ignoreDirty": boolean,
		"upload": boolean,
	} = program.opts() as {
		ignoreDirty: boolean,
		upload: boolean
	}

	const dirty = await git.dirtyFiles([
		/^.*\.md$/,
		new RegExp('^src/testing/ci/golden_gen.ts$'),
	])
	if (dirty.length > 0) {
		const msg = `working directory not clean; stash or commit ${dirty}`
		console.error(msg)
		if (!opts.ignoreDirty) {
			throw new Error(msg)
		}
	}

	const hash = await git.headHash()
	const basedir = "/tmp/nes"
	const tmpdir = path.join(basedir, hash) + (dirty.length > 0 ? '-dirty' : '')

	await writeImages(tmpdir)

	const latest = path.join(basedir, "latest")
	fs.unlinkSync(latest)
	fs.symlinkSync(tmpdir, latest)

	if (opts.upload) {
		const cl = new gs.Client()
		for await (const localPath of walk(tmpdir)) {
			const remotePath = localPath.substring(basedir.length + 1)
			cl.uploadFile(localPath, remotePath)
		}
	}
}

main().catch(console.error)
