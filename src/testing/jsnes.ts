import * as fs from 'fs'
import * as jsnes from 'jsnes'

/*
Reference:
- Play online https://jsnes.org/
- Usage: https://github.com/bfirsh/jsnes
 */

const loadData = (filepath: string): string => {
	return fs.readFileSync(filepath, { encoding: 'binary' })
}

const width = 256, height = 240

export class JSNES {
	private nes: jsnes.NES

	private buffer_32: Uint32Array
	private buffer_8: Uint8ClampedArray
	constructor() {
		this.nes = new jsnes.NES({
			onFrame: this.onFrame.bind(this),
		})
		this.nes.ppu.clipToTvSize = false

		const b = new ArrayBuffer(width * height * 4)
		this.buffer_32 = new Uint32Array(b)
		this.buffer_8 = new Uint8ClampedArray(b)
	}
	loadFile(filepath: string): void {
		const data = loadData(filepath)
		this.nes.loadROM(data)
	}
	private onFrame(buf: Array<number>) {
		for (let i = 0; i < buf.length; i++) {
			this.buffer_32[i] = 0xFF000000 | buf[i]
		}
	}
	frame(n?: number): void {
		const iter = n ?? 1
		for (let i = 0; i < iter; i++) {
			this.nes.frame()
		}
	}
	buffer(): Uint8ClampedArray {
		return this.buffer_8
	}
	// controller 1-2. buttonID: 0-7
	buttonDown(controller: number, buttonID: number): void {
		this.nes.buttonDown(controller, buttonID)
	}
	// controller 1-2. buttonID: 0-7
	buttonUp(controller: number, buttonID: number): void {
		this.nes.buttonUp(controller, buttonID)
	}
}