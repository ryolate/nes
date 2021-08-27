// Module to provide golden data for testing using jsnes.

import * as Color from '../nes/ppu/color'
import * as jsnes from './jsnes'
import * as canvas from 'canvas'
import * as fs from 'fs'

const width = 256, height = 240

// Reads romData and run it for frameCount frames, and returns the
// view.
export const wantFrame = (filepath: string, frameCount: number): Uint8ClampedArray => {
	const nes = new jsnes.JSNES()
	nes.loadFile(filepath)

	for (let i = 0; i < frameCount; i++) {
		nes.frame()
	}
	return nes.buffer()
}

const sameColor = (i: number, j: number): boolean => {
	return Color.sameColor(Color.get(i), Color.get(j))
}

export const assertSameImageBuffers = async (ours: Uint8ClampedArray, theirs: Uint8ClampedArray, filepath?: string): Promise<void> => {
	const ourIndices = []
	for (let y = 0; y < height; y++) {
		const a = []
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) << 2
			a.push(Color.indexOf([ours[i], ours[i + 1], ours[i + 2]]))
		}
		ourIndices.push(a)
	}

	const theirIndices = []
	for (let y = 0; y < height; y++) {
		const a = []
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) << 2
			a.push(TheirColor.indexOf([theirs[i], theirs[i + 1], theirs[i + 2]]))
		}
		theirIndices.push(a)
	}

	let failCount = 0
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const got = ourIndices[y][x]
			const want = theirIndices[y][x]

			if (!sameColor(got, want)) {
				console.log(`${y}-th row (${x}, ${y}) mismatch; got ${got} want ${want}`)
				failCount++
			}
		}
		if (failCount >= 10) {
			console.log(`too much mismatch >= ${failCount}`)
			break
		}
	}
	if (failCount == 0) {
		return
	}
	// Create diff image
	const diff = Uint8ClampedArray.from(ours)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (sameColor(ourIndices[y][x], theirIndices[y][x])) {
				continue
			}
			const i = (y * width + x) << 2
			for (let j = i; j < i + 3; j++) {
				diff[j] = Math.abs(ours[j] - theirs[j])
			}
		}
	}
	const cnv = canvas.createCanvas(width * 3, height)
	const ctx = cnv.getContext('2d')
	ctx.putImageData(new canvas.ImageData(ours, width, height), 0, 0)
	ctx.putImageData(new canvas.ImageData(theirs, width, height), width, 0)
	ctx.putImageData(new canvas.ImageData(diff, width, height), width * 2, 0)

	const out = fs.createWriteStream(__dirname + '/diff.png')
	const stream = cnv.createPNGStream()
	stream.pipe(out)
	await new Promise((resolve) => {
		out.on('finish', () => {
			const name = filepath ? filepath : 'test'
			console.log(`${name} failed; diff.png created under ${__dirname}`)
			resolve(0)
		})
	})
	fail()
}

class TheirColor {
	// https://github.com/bfirsh/jsnes/blob/HEAD/src/ppu.js
	static curTable = [
		0x525252, 0xB40000, 0xA00000, 0xB1003D, 0x740069, 0x00005B, 0x00005F, 0x001840, 0x002F10, 0x084A08, 0x006700, 0x124200, 0x6D2800, 0x000000, 0x000000, 0x000000,
		0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B, 0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1, 0x006A5B, 0x008C03, 0x00AB00, 0x2C8800, 0xA47200, 0x000000, 0x000000, 0x000000,
		0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5, 0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7, 0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E, 0xE5E218, 0x787878, 0x000000, 0x000000,
		0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8, 0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF, 0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC, 0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000
	];

	static indexOf(rgb: [number, number, number]): number {
		const c = rgb[2] << 16 | rgb[1] << 8 | rgb[0]
		for (let i = 0; i < 64; i++) {
			if (this.curTable[i] === c) {
				return i
			}
		}
		throw new Error(`Unknown their color #${c.toString(16)}`)
	}
}