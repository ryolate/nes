/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { PPU } from "./ppu/ppu";
import { CPU, CPUHaltError, CPUStatus } from "./cpu/cpu";
import { APU } from "./apu";
import { NMI } from "./cpu/nmi";
import { Controller, ControllerId } from "./controller";
import { uint8 } from "./num";
import { Logger } from "./logger";
import { AudioEvent, AudioEventDeque } from "./audio_util";
import { Mapper, MapperFactory } from "./mappers/mapper";

// NTSC CPU clock frequency = 1.789773 MHz
const CPUHz = 1.789773 * 1000 * 1000
const CPUMillisPerCycle = 1000 / CPUHz

export class NES {
	readonly mapper: Mapper
	private readonly controller: Controller

	apu: APU
	ppu: PPU
	cpu: CPU

	private cycleCount = 0
	private nextAudioSampleCount = 0.0
	private readonly audioSampleBuffer = new AudioEventDeque()
	private readonly audioSampleRate

	constructor(mapper: Mapper) {
		this.mapper = mapper
		this.audioSampleRate = typeof AudioContext === 'undefined' ? 44100 : new AudioContext().sampleRate
		this.controller = new Controller()

		const nmi = new NMI()

		this.apu = new APU(this.mapper)
		this.ppu = new PPU(this.mapper, nmi)
		this.cpu = new CPU(this.mapper, this.ppu, nmi, this.controller, this.apu)
	}


	// Example:
	//     const data = fs.readFileSync("testdata/nestest.nes")
	//     const nes = NES.fromCartridgeData(data)
	static fromCartridgeData(cartridgeData: Uint8Array): NES {
		return new NES(MapperFactory.parseINES(cartridgeData))
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
		this.ppu.tickPPU()
		this.ppu.tickPPU()
		this.ppu.tickPPU()
		this.cpu.tickCPU()
		this.apu.tickAPU()

		this.cycleCount++
		if (this.nextAudioSampleCount < this.cycleCount) {
			this.nextAudioSampleCount += CPUHz / this.audioSampleRate
			this.audioSampleBuffer.pushBack({
				value: this.apu.output(),
				cycle: this.cycleCount,
			})
			this.audioSampleBuffer.ensureCapacity(1024)
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

	// Output audio data
	// currentTime: BaseAudioContext.currentTime
	// playbackTime: The time when the audio will be played, as defined by the
	//     time of AudioContext.currentTime.
	// sampleRate: sampling rate of the audio.
	processAudio(outputBuffer: Float32Array): void {
		const n = outputBuffer.length

		// TODO: deal with underflow.

		let event: AudioEvent | null = null
		for (let i = 0; i < n; i++) {
			const e = this.audioSampleBuffer.peek()
			if (e === null) {
				if (event) {
					outputBuffer[i] = event.value
				}
				continue
			}
			event = e
			outputBuffer[i] = e.value
			this.audioSampleBuffer.pop()
		}
		return
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
		this.ppu = new PPU(this.mapper, nmi)
		this.cpu = new CPU(this.mapper, this.ppu, nmi, this.controller, new APU(this.mapper))

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
	private logger?: Logger
	setLogger(logger?: Logger): void {
		this.logger = logger
		this.ppu.logger = logger?.newLogger("PPU")
		this.cpu.logger = logger?.newLogger("CPU")
		this.apu.logger = logger?.newLogger("APU")
	}
}
