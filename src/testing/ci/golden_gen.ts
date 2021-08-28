// Image generator
// Creates images running nes against each rom in target.txt.
// They are uploaded to GS or stored locally.
import * as canvas from 'canvas'
import * as fs from 'fs'
import * as path from 'path'

import * as git from './git'
import * as NES from '../../nes/nes'

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

async function main() {
	const dirty = await git.dirtyFiles([
		/^.*\.md$/,
		new RegExp('^src/testing/ci/golden_gen.ts$'),
	])
	if (dirty.length > 0) {
		console.log()
		throw new Error(`working directory not clean; stash or commit ${dirty}`)
	}

	const hash = await git.headHash()
	const basedir = "/tmp/nes"
	const tmpdir = path.join(basedir, hash)

	await writeImages(tmpdir)

	fs.symlinkSync(tmpdir, path.join(basedir, "latest"))
}

main().catch(console.error)
