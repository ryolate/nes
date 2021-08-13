/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Cartridge } from "./cartridge";
import { PPU } from "./ppu/ppu";
import { CPU, CPUHaltError, CPUStatus } from "./cpu";
import { APU } from "./apu";
import { NMI } from "./nmi";
import * as Debug from "./debug"
import { Controller, ControllerId } from "./controller";
import { uint8 } from "./num";
import { Logger } from "./logger";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

export class NES {
	cartridge: Cartridge
	private controller: Controller

	ppu: PPU
	cpu: CPU

	constructor(cartridge: Cartridge) {
		this.cartridge = cartridge
		this.controller = new Controller()

		const nmi = new NMI()

		this.ppu = new PPU(this.cartridge, nmi)
		this.cpu = new CPU(this.cartridge, this.ppu, nmi, this.controller, new APU())
	}

	static fromCartridgeData(cartridgeData: Uint8Array): NES {
		return new NES(Cartridge.parseINES(cartridgeData))
	}

	play(elapsedMillis: number): void {
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
			this.tick()
		}
	}

	private tick() {
		this.ppu.tick()
		this.ppu.tick()
		this.ppu.tick()
		this.cpu.tick()
	}

	// Render the game.
	render(ctx: CanvasRenderingContext2D): void {
		this.ppu.render(ctx)
	}

	// Example
	//   setControllerState(1, Controller.ButtonA | Controller.ButtonRight)
	setControllerState(c: ControllerId, data: uint8): void {
		this.controller.setControllerData(c, data)
	}

	////////////////////////////// Debug //////////////////////////////
	frame(n?: number): void {
		const iter = n ?? 1
		for (let i = 0; i < iter; i++) {
			const c = this.ppu.frameCount
			while (c === this.ppu.frameCount) {
				this.tick()
			}
		}
	}

	buffer(): Uint8ClampedArray {
		return this.ppu.buffer()
	}
	resetAll(): void {
		const nmi = new NMI()
		this.ppu = new PPU(this.cartridge, nmi)
		this.cpu = new CPU(this.cartridge, this.ppu, nmi, this.controller, new APU())

		this.setLogger(this.logger)
		console.clear()
	}

	// throw CPUHaltError on CPU halt
	stepToNextInstruction(): void {
		let cpuStatus: CPUStatus | null = null
		const id = this.cpu.addDebugCallback((s) => {
			cpuStatus = s
		})
		try {
			while (cpuStatus === null) {
				this.step(1)
			}
		} finally {
			this.cpu.removeDebugCallback(id)
		}
	}
	debugInfo(): DebugInfo {
		return {
			cpuStatus: this.cpu.cpuStatus(),
			nes: this,
		}
	}
	setDebugMode(debugMode: boolean): void {
		Debug.setDebugMode(debugMode)
	}
	private logger?: Logger
	setLogger(logger?: Logger): void {
		this.logger = logger
		this.ppu.logger = logger?.newLogger("PPU")
		this.cpu.bus.logger = logger?.newLogger("CPU")
	}
}

export interface DebugInfo {
	cpuStatus: CPUStatus
	nes: NES
}