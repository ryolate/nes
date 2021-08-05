import { Cartridge } from "./cartridge";
import { PPU } from "./ppu";
import { CPU } from "./cpu";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

export class Console {
	ppu: PPU
	cpu: CPU
	constructor(cartridgeData: Uint8Array) {
		const cartridge = Cartridge.parseINES(cartridgeData)
		this.ppu = new PPU(cartridge)
		this.cpu = new CPU(cartridge, this.ppu)
	}

	step(elapsedMillis: number) {
		const numCPUSteps = Math.round(elapsedMillis / CPUMillisPerCycle)
		for (let i = 0; i < numCPUSteps; i++) {
			this.ppu.tick()
			this.ppu.tick()
			this.ppu.tick()
			this.cpu.tick()
		}
	}

	render(ctx: CanvasRenderingContext2D) {
		this.ppu.render(ctx)
	}
}
