import { Cartridge } from "./cartridge";
import { PPU } from "./ppu";
import { CPU, CPUStatus } from "./cpu";
import { NMI } from "./nmi";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

export class NES {
	ppu: PPU
	cpu: CPU
	cartridge: Cartridge

	constructor(cartridgeData: Uint8Array) {
		const cartridge = Cartridge.parseINES(cartridgeData)
		const nmi = new NMI()

		this.ppu = new PPU(cartridge, nmi)
		this.cpu = new CPU(cartridge, this.ppu, nmi)
		this.cartridge = cartridge
	}

	play(elapsedMillis: number) {
		const numCPUSteps = Math.round(elapsedMillis / CPUMillisPerCycle)
		this.step(numCPUSteps)
	}

	private step(numCPUSteps: number) {
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

	////////////////////////////// Debug //////////////////////////////
	resetAll() {
		const nmi = new NMI()
		this.ppu = new PPU(this.cartridge, nmi)
		this.cpu = new CPU(this.cartridge, this.ppu, nmi)
	}

	stepToNextInstruction(): DebugInfo {
		let cpuStatus: CPUStatus | null = null
		let id = this.cpu.addDebugCallback((s) => {
			cpuStatus = s
		})

		while (cpuStatus === null) {
			this.step(1)
		}

		this.cpu.removeDebugCallback(id)

		return {
			cpuStatus: cpuStatus!,
		}
	}
	debugInfo(): DebugInfo {
		return {
			cpuStatus: this.cpu.cpuStatus()
		}
	}
}

export interface DebugInfo {
	cpuStatus: CPUStatus
}