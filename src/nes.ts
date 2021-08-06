import { Cartridge } from "./cartridge";
import { PPU } from "./ppu";
import { CPU } from "./cpu";
import { NMI } from "./nmi";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

export class NES {
	ppu: PPU
	cpu: CPU
	constructor(cartridgeData: Uint8Array) {
		const cartridge = Cartridge.parseINES(cartridgeData)
		const nmi = new NMI()
		this.ppu = new PPU(cartridge, nmi)
		this.cpu = new CPU(cartridge, this.ppu, nmi)
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

	// Render the game.
	render(ctx: CanvasRenderingContext2D) {
		this.ppu.render(ctx)
	}
}
