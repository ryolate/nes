/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Cartridge } from "./cartridge";
import { PPU, PPUStatus } from "./ppu/ppu";
import { CPU, CPUHaltError, CPUStatus } from "./cpu";
import { APU } from "./apu";
import { NMI } from "./nmi";
import * as Debug from "./debug"
import { Controller } from "./controller";
import { uint8 } from "./num";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

export class NES {
	cartridge: Cartridge
	private controller: Controller

	private ppu: PPU
	cpu: CPU

	constructor(cartridgeData: Uint8Array) {
		this.cartridge = Cartridge.parseINES(cartridgeData)
		this.controller = new Controller()

		const nmi = new NMI()

		this.ppu = new PPU(this.cartridge, nmi)
		this.cpu = new CPU(this.cartridge, this.ppu, nmi, this.controller, new APU())
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

	// 0 = A, B, Select, Start, Up, Down, Left, Right = 7
	setControllerState(data: uint8): void {
		this.controller.setController1Data(data)
	}

	////////////////////////////// Debug //////////////////////////////
	frame(): void {
		const c = this.ppu.frameCount
		while (c === this.ppu.frameCount) {
			this.tick()
		}
	}

	buffer(): Uint8ClampedArray {
		return this.ppu.buffer()
	}
	resetAll(): void {
		const nmi = new NMI()
		this.ppu = new PPU(this.cartridge, nmi)
		this.cpu = new CPU(this.cartridge, this.ppu, nmi, this.controller, new APU())
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
			ppuStatus: this.ppu.getStatus(),
		}
	}
	setDebugMode(debugMode: boolean): void {
		Debug.setDebugMode(debugMode)
	}
}

export interface DebugInfo {
	cpuStatus: CPUStatus
	ppuStatus: PPUStatus
}