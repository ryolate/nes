import { assertInRange, assertUint8, uint16, uint8 } from "./num";
/*
References
- Basics: https://wiki.nesdev.com/w/index.php?title=APU_basics
- Registers https://wiki.nesdev.com/w/index.php?title=APU_registers
- Pulse https://wiki.nesdev.com/w/index.php?title=APU_Pulse
- Sweep https://wiki.nesdev.com/w/index.php?title=APU_Sweep
- Frame Counter https://wiki.nesdev.com/w/index.php?title=APU_Frame_Counter
- Envelope https://wiki.nesdev.com/w/index.php?title=APU_Envelope
*/

class Pulse {
	// Duty (D), envelope loop / length counter halt (L), constant volume (C), volume/envelope (V)
	// DDLCVVVV
	setR1(x: number) {
		this.sequencer.duty = x >> 6 & 3
		this.envelope.loop = this.lengthCounter.halt = x >> 5 & 1
		this.envelope.constantVolume = x >> 4 & 1
		this.envelope.volume = x & 15
	}

	// Sweep unit: enabled (E), period (P), negate (N), shift (S)
	// EPPPNSSS
	setR2(x: number) {
		this.sweep.enabled = x >> 7 & 1
		this.sweep.dividerPeriod = x >> 4 & 7
		this.sweep.negate = x >> 3 & 1
		this.sweep.shiftCount = x & 7
	}

	// TTTTTTTT
	// Timer low (T)
	setR3(x: number) {
		this.sweep.timerValue = this.sweep.timerValue & 0x700 | x
	}

	// Length counter load (L), timer high (T)
	// LLLLLTTT
	setR4(x: number) {
		this.lengthCounter.load = x >> 3
		this.sweep.timerValue = ((x & 7) << 8) | this.sweep.timerValue & 0xFF

		// Writing to $4003/4007 reloads the length counter, restarts the
		// envelope, and resets the phase of the pulse generator.
		this.lengthCounter.reload()
		this.envelope.restart()
		// TODO: The sequencer is immediately restarted at the first value of the current sequence
	}

	envelope: Envelope
	sweep: Sweep
	sequencer: Sequencer
	lengthCounter: LengthCounter

	constructor(isPulse1: boolean) {
		this.envelope = new Envelope()
		this.sweep = new Sweep(isPulse1)
		this.sequencer = new Sequencer(this.sweep)
		this.lengthCounter = new LengthCounter()
	}

	// APU cycle
	tickAPU() {
		this.sequencer.tickAPU()
	}

	tickHalfFrame() {
		this.sweep.tickHalfFrame()
		this.lengthCounter.tickHalfFrame()
	}

	tickQuarterFrame() {
		this.envelope.tickQuarterFrame()
	}

	output(): number {
		if (this.sequencer.output() === 0 ||
			this.sweep.muted() ||
			(!this.lengthCounter.output())) {
			return 0
		}
		return this.envelope.output()
	}
}

class Triangle {
	// Length counter halt / linear counter control (C), linear counter load (R)
	r1 = 0
	// Timer low (T)
	r2 = 0
	// Length counter load (L), timer high (T)
	r3 = 0
}

class Noise {
	r1 = 0
	r2 = 0
	r3 = 0
}

class DMC {
	r1 = 0
	r2 = 0
	r3 = 0
	r4 = 0
}

// Outputs a clock periodically
class Divider {
	// Period value. Divider's period is p + 1.
	p = 0
	counter = 0

	onClock?: () => void
	constructor(onClock?: () => void) {
		this.onClock = onClock
		this.reload()
	}

	tick(): void {
		if (this.counter === 0) {
			if (this.onClock) {
				this.onClock()
			}
			this.counter = this.p
		} else {
			this.counter--
		}
	}
	reload(): void {
		this.counter = this.p
	}
	setP(p: number): void {
		this.p = p
	}
}

class Envelope {
	loop = 0
	constantVolume = 0
	volume = 0

	private startFlag = false
	private divider: Divider
	private decayLevelCounter = 0

	constructor() {
		this.divider = new Divider(this.onDividerClock.bind(this))
	}
	// clocked by the frame counter
	tickQuarterFrame() {
		// When clocked by the frame counter, one of two actions occurs: if the
		// start flag is clear, the divider is clocked, otherwise the start
		// flag is cleared, the decay level counter is loaded with 15, and the
		// divider's period is immediately reloaded.
		if (!this.startFlag) {
			this.divider.tick()
			return
		}
		this.startFlag = false
		this.decayLevelCounter = 15
		this.divider.reload()
	}

	private onDividerClock() {
		// When the divider is clocked while at 0, it is loaded with V and
		// clocks the decay level counter. Then one of two actions occurs: If
		// the counter is non-zero, it is decremented, otherwise if the loop
		// flag is set, the decay level counter is loaded with 15.
		this.divider.setP(this.volume)
		this.divider.reload()
		if (this.decayLevelCounter > 0) {
			this.decayLevelCounter--
		} else {
			if (this.loop) {
				this.decayLevelCounter = 15
			}
		}
	}
	output(): number {
		if (this.constantVolume) {
			return this.volume
		}
		return this.decayLevelCounter
	}

	restart() {
		this.startFlag = true
	}
}

// Sweep unit
// https://wiki.nesdev.com/w/index.php?title=APU_Sweep
class Sweep {
	// Each sweep unit contains the following: divider, reload flag.
	divider: Divider
	reloadFlag = false

	// $4001
	enabled = 0
	dividerPeriod = 0
	negate = 0
	shiftCount = 0
	// $4002-$4003
	timerValue = 0

	isPulse1: boolean

	constructor(isPulse1: boolean) {
		this.divider = new Divider()
		this.isPulse1 = isPulse1
	}

	private targetPeriod(): number {
		// The sweep unit continuously calculates each channel's target period
		// in this way:
		// 1. A barrel shifter shifts the channel's 11-bit raw timer period
		//    right by the shift count, producing the change amount.
		// 2. If the negate flag is true, the change amount is made negative.
		// 3. The target period is the sum of the current period and the change
		//    amount.
		let changeAmount = this.timerValue >> this.shiftCount
		if (this.negate) {
			if (this.isPulse1) {
				changeAmount = -changeAmount - 1
			} else {
				changeAmount = -changeAmount
			}
		}
		return changeAmount + this.timerValue
	}

	private isEnabled(): boolean {
		return this.enabled === 1 && this.shiftCount > 0
	}

	muted(): boolean {
		// Muting
		//
		// Two conditions cause the sweep unit to mute the channel:
		// 1. If the current period is less than 8, the sweep unit mutes the
		//    channel.
		// 2. If at any time the target period is greater than $7FF, the sweep
		//    unit mutes the channel.
		if (this.timerValue < 8) {
			return true
		}
		if (this.targetPeriod() > 0x7FF) {
			return true
		}
		return false
	}

	// half-frame clock
	tickHalfFrame(): void {
		// Update the period
		//
		// 1. If the divider's counter is zero, the sweep is enabled, and the
		//    sweep unit is not muting the channel: The pulse's period is
		//    adjusted.
		if (this.divider.counter === 0 && this.isEnabled() && !this.muted()) {
			this.timerValue = this.targetPeriod()
		}
		// 2. If the divider's counter is zero or the reload flag is true: The
		//    counter is set to P and the reload flag is cleared. Otherwise, the
		//    counter is decremented.
		if (this.divider.counter === 0 || this.reloadFlag) {
			this.divider.setP(this.dividerPeriod)
			this.reloadFlag = false
		} else {
			this.divider.counter--
		}
	}
}

class Sequencer {
	// $4000 6-7
	duty = 0

	// To get access to timerValue.
	private sweep: Sweep

	private timer = 0
	private index = 0

	private static outputWaveform = [
		[0, 1, 0, 0, 0, 0, 0, 0],
		[0, 1, 1, 0, 0, 0, 0, 0],
		[0, 1, 1, 1, 1, 0, 0, 0],
		[1, 0, 0, 1, 1, 1, 1, 1],
	]

	constructor(sweep: Sweep) {
		this.sweep = sweep
	}

	// Tick with APU cycle
	tickAPU(): void {
		if (this.timer === 0) {
			this.timer = this.sweep.timerValue
			this.index = (this.index + 1) & 7
		} else {
			this.timer--
		}
	}

	output(): number {
		return Sequencer.outputWaveform[this.duty][this.index]
	}
}

class LengthCounter {
	private enabled = 0
	halt = 0
	// lengthTable index
	load = 0

	private lengthCounter = 0

	private static lengthTable = [
		10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14,
		12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30
	]

	setEnabled(x: number) {
		assertInRange(x, 0, 1)
		// When the enabled bit is cleared (via $4015), the length counter is
		// forced to 0 and cannot be changed until enabled is set again (the
		// length counter's previous value is lost). There is no immediate
		// effect when enabled is set.
		this.enabled = x
		if (!this.enabled) {
			this.lengthCounter = 0
		}
	}

	tickHalfFrame() {
		// When clocked by the frame counter, the length counter is decremented
		// except when:
		//
		// * The length counter is 0, or
		// * The halt flag is set
		if (this.lengthCounter === 0 || this.halt) {
			return
		}
		this.lengthCounter--
	}

	output(): boolean {
		return this.lengthCounter > 0
	}

	reload(): void {
		this.lengthCounter = LengthCounter.lengthTable[this.load]
	}
}

export class APU {
	pulse1 = new Pulse(true)
	pulse2 = new Pulse(false)
	triangle = new Triangle()
	noise = new Noise()
	dmc = new DMC()

	control = 0 // $4015 (read)
	status = 0 // $4015 (write)
	interruptInhibit = 0 // bit 6 of $4017
	fiveStepSequence = 0 // bit 7 of $4017

	frameInteruptFlag = 0 // TODO: CPU should read it.

	oddCPUCycle = false
	frameCounter = 0
	// Call it at the same rate as the CPU clock cycle.
	tick(): void {
		if (this.oddCPUCycle) {
			this.tickAPU()
		}
		this.oddCPUCycle = !this.oddCPUCycle

		this.tickFrameCounterSequencer()
	}
	// Ticked on every CPU cycle
	private tickFrameCounterSequencer() {
		this.frameCounter += 0.5
		// The sequencer keeps track of how many APU cycles have
		// elapsed in total, and each step of the sequence will occur once that
		// total has reached the indicated amount. Once the last
		// step has executed, the count resets to 0 on the next APU cycle.
		if (this.fiveStepSequence) {
			// Mode 0: 4-Step Sequence
			switch (this.frameCounter) {
				case 3728.5:
					this.tickQuarterFrame()
					break
				case 7456.5:
					this.tickQuarterFrame()
					this.tickHalfFrame()
					break
				case 11185.5:
					this.tickQuarterFrame()
					break
				case 14914:
					this.updateFrameInterruptFlag()
					break
				case 14914.5:
					this.tickQuarterFrame()
					this.tickHalfFrame()
					this.updateFrameInterruptFlag()
					break
				case 14915:
					this.updateFrameInterruptFlag()
					this.frameCounter = 0
					break
			}
			assertInRange(this.frameCounter, 0, 14914.5)
		} else {
			// Mode 1: 5-Step Sequence
			// In this mode, the frame interrupt flag is never set.
			switch (this.frameCounter) {
				case 3728.5:
					this.tickQuarterFrame()
					break
				case 7456.5:
					this.tickQuarterFrame()
					this.tickHalfFrame()
					break
				case 11185.5:
					this.tickQuarterFrame()
					break
				case 14914.5:
					// Do nothing
					break
				case 18640.5:
					this.tickQuarterFrame()
					this.tickHalfFrame()
					break
				case 18641:
					this.frameCounter = 0
			}
			assertInRange(this.frameCounter, 0, 18640.5)
		}
	}
	private updateFrameInterruptFlag() {
		if (this.interruptInhibit) {
			return
		}
		this.frameInteruptFlag = 1
	}
	private resetFrameCounter() {
		this.frameCounter = 0
	}
	// Tick APU cycle
	private tickAPU() {
		this.pulse1.tickAPU()
		this.pulse2.tickAPU()
	}
	// Tick half frame
	private tickHalfFrame() {
		this.pulse1.tickHalfFrame()
		this.pulse2.tickHalfFrame()
	}
	// Tick quarter frame
	private tickQuarterFrame() {
		this.pulse1.tickQuarterFrame()
		this.pulse2.tickQuarterFrame()
	}

	read(pc: uint16): uint8 {
		switch (pc) {
			case 0x4015: {
				// TODO: DMC interrupt, DMC active, Noise, Triangle
				const p1 = this.pulse1.lengthCounter.output() ? 1 : 0
				const p2 = this.pulse2.lengthCounter.output() ? 1 : 0
				return this.frameInteruptFlag << 6 | p2 << 1 | p1
			}
		}
		// They are write-only except $4015.
		throw new Error(`APU.read($${pc.toString(16)}) not implemented`)
	}

	write(pc: uint16, x: uint8): void {
		assertInRange(pc, 0x4000, 0x4017)
		assertUint8(x)
		switch (pc & 0x1F) {
			case 0x00:
				this.pulse1.setR1(x)
				return
			case 0x01:
				this.pulse1.setR2(x)
				return
			case 0x02:
				this.pulse1.setR3(x)
				return
			case 0x03:
				this.pulse1.setR4(x)
				return
			case 0x04:
				this.pulse2.setR1(x)
				return
			case 0x05:
				this.pulse2.setR2(x)
				return
			case 0x06:
				this.pulse2.setR3(x)
				return
			case 0x07:
				this.pulse2.setR4(x)
				return
			case 0x08:
				this.triangle.r1 = x
				return
			case 0x09:
				throw new Error(`$4009 is unused`)
			case 0x0A:
				this.triangle.r2 = x
				return
			case 0x0B:
				this.triangle.r3 = x
				return
			case 0x0C:
				this.noise.r1 = x
				return
			case 0x0D:
				throw new Error(`$400D is unused`)
			case 0x0E:
				this.noise.r2 = x
				return
			case 0x0F:
				this.noise.r3 = x
				return
			case 0x10:
				this.dmc.r1 = x
				return
			case 0x11:
				this.dmc.r2 = x
				return
			case 0x12:
				this.dmc.r3 = x
				return
			case 0x13:
				this.dmc.r4 = x
				return
			case 0x14:
				throw new Error(`BUG: $4014 should be handled by PPU`)
			case 0x15:
				this.pulse1.lengthCounter.setEnabled(x >> 0 & 1)
				this.pulse2.lengthCounter.setEnabled(x >> 1 & 1)
				// TODO: triangle, noise, DMC
				return
			case 0x16:
				throw new Error(`BUG: $4016 should be handled by Controller`)
			case 0x17:
				this.fiveStepSequence = x >> 7 & 1
				this.interruptInhibit = x >> 6 & 1
				// TODO: make it cycle accurate (2-3 delay); see Frame Counter.
				this.resetFrameCounter()
				this.tickHalfFrame()
				this.tickQuarterFrame()
				return
		}
		throw new Error(`APU.write not implemented. 0x${pc.toString(16)}, ${x}`);
	}

	output(): number {
		// output = pulse_out + tnd_out
		//
		// 							95.88
		// pulse_out = ------------------------------------
		// 			 (8128 / (pulse1 + pulse2)) + 100
		//
		// 									   159.79
		// tnd_out = -------------------------------------------------------------
		// 									1
		// 		   ----------------------------------------------------- + 100
		// 			(triangle / 8227) + (noise / 12241) + (dmc / 22638)
		const pulseOut = 95.88 / (8128 / (this.pulse1.output() + this.pulse2.output()) + 100)
		// TODO: implement tnd_out
		return pulseOut
	}
}
