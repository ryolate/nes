declare module '*.nes';

// For test
declare module "jsnes" {
	class NES {
		constructor(opts: Options)
		loadROM(data: string)
		frame()
		buttonDown(controller: number, buttonId: number)
		buttonUp(controller: number, buttonId: number)
		ppu: PPU
	}
	class PPU {
		clipToTvSize: boolean
	}
	interface Options {
		// 256 * 240 size array, each represents a color code 0xRRGGBB.
		onFrame?: (buffer_24: Array<number>) => void
	}
}
