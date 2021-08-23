/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Cartridge } from "./cartridge";
import { PPU } from "./ppu/ppu";
import { CPU, CPUHaltError, CPUStatus } from "./cpu";
import { APU } from "./apu";
import { NMI } from "./nmi";
import { Controller, ControllerId } from "./controller";
import { uint8 } from "./num";
import { Logger } from "./logger";
import { AudioEvent, AudioEventDeque } from "./audio_util";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

const AUDIOSampleRate = 44100 // 44.1K Hz

export class NES {
	cartridge: Cartridge
	private controller: Controller

	private apu: APU
	ppu: PPU
	cpu: CPU

	private cycleCount = 0
	private nextAudioSampleCount = 0.0
	private audioSampleBuffer = new AudioEventDeque()

	constructor(cartridge: Cartridge) {
		this.cartridge = cartridge
		this.controller = new Controller()

		const nmi = new NMI()

		this.apu = new APU()
		this.ppu = new PPU(this.cartridge, nmi)
		this.cpu = new CPU(this.cartridge, this.ppu, nmi, this.controller, this.apu)
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

	tick(): void {
		this.ppu.tick()
		this.ppu.tick()
		this.ppu.tick()
		this.cpu.tick()
		this.apu.tick()

		this.cycleCount++
		if (this.nextAudioSampleCount < this.cycleCount) {
			this.nextAudioSampleCount += CPUHz / AUDIOSampleRate
			this.audioSampleBuffer.pushBack({
				value: this.apu.output(),
				cycle: this.cycleCount,
				timestampMillis: performance.now(),
			})
		}
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

	tones = [261, 293, 329, 349, 391, 440, 493, 523]
	index = 0
	prevTimeSecond = -1
	toneIndex = -2

	static audioAdditionalDelayMillis = 7 // 7ms

	// Output audio data
	// currentTime: BaseAudioContext.currentTime
	// playbackTime: The time when the audio will be played, as defined by the
	//     time of AudioContext.currentTime.
	// sampleRate: sampling rate of the audio.
	processAudio(outputBuffer: Float32Array, currentTime: number, playbackTime: number, sampleRate: number): void {
		const n = outputBuffer.length

		const now = performance.now()
		// now - 30ms when n = 1024, and sampleRate = 44100
		const currentTimeTimestamp = now - NES.audioAdditionalDelayMillis - n / sampleRate * 1000


		let event: AudioEvent | null = null
		for (let e = this.audioSampleBuffer.peek();
			e && e.timestampMillis < currentTimeTimestamp;
			e = this.audioSampleBuffer.peek()) {
			event = e
			this.audioSampleBuffer.pop()
		}
		if (event) {
			// Next processAudio call might use it, so push front.
			this.audioSampleBuffer.pushFront(event)
		}

		for (let i = 0, j = 0; i < n; i++) {
			const targetTimestamp = currentTimeTimestamp + i / sampleRate

			for (; j + 1 < this.audioSampleBuffer.size(); j++) {
				const nextEvent = this.audioSampleBuffer.get(j + 1)
				if (nextEvent.timestampMillis > targetTimestamp) {
					break
				}
				event = nextEvent
			}
			outputBuffer[i] = event ? event.value : 0
		}
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
	private logger?: Logger
	setLogger(logger?: Logger): void {
		this.logger = logger
		this.ppu.logger = logger?.newLogger("PPU")
		this.cpu.logger = logger?.newLogger("CPU")
	}
}

export interface DebugInfo {
	cpuStatus: CPUStatus
	nes: NES
}