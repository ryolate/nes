import { Cartridge } from "./cartridge";
import { PPU } from "./ppu/ppu";
import { CPU, CPUHaltError, CPUStatus } from "./cpu";
import { NMI } from "./nmi";
import * as Debug from "./debug"

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

		try {
			this.step(numCPUSteps)
		} catch (e) {
			if (!(e instanceof CPUHaltError)) {
				throw e
			}
		}
	}

	// throw error on CPU halt
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

	// throw CPUHaltError on CPU halt
	stepToNextInstruction(): DebugInfo {
		let cpuStatus: CPUStatus | null = null
		let id = this.cpu.addDebugCallback((s) => {
			cpuStatus = s
		})

		try {
			while (cpuStatus === null) {
				this.step(1)
			}
		} finally {
			this.cpu.removeDebugCallback(id)
		}

		return {
			cpuStatus: cpuStatus!,
		}
	}
	debugInfo(): DebugInfo {
		return {
			cpuStatus: this.cpu.cpuStatus()
		}
	}
	setDebugMode(debugMode: boolean) {
		Debug.setDebugMode(debugMode)
	}
}

export interface DebugInfo {
	cpuStatus: CPUStatus
}