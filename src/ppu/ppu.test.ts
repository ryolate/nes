/**
 * @jest-environment jsdom
 */

import * as fs from 'fs'
import { NES } from '../nes'
import * as PPU from './ppu'

const helloROM = fs.readFileSync("src/asset/hello.nes")

test("Hello world", () => {
	const nes = new NES(helloROM)

	const canvas = newGameCanvas()
	const ctx = canvas.getContext('2d') ?? fail()

	const iter = 10000
	for (let i = 0; i < iter; i++) {
		nes.stepToNextInstruction()
	}
	nes.render(ctx)
})

const newGameCanvas = (): HTMLCanvasElement => {
	const canvas = document.createElement('canvas') as HTMLCanvasElement
	canvas.width = PPU.WIDTH
	canvas.height = PPU.HEIGHT
	return canvas
}