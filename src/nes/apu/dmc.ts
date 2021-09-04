import { Mapper } from "../mappers/mapper"
import { assertInRange, uint8 } from "../num"

export class DMC {
    readonly mapper
    constructor(mapper: Mapper) {
        this.mapper = mapper
    }
    setR1(x: uint8): void {// $4010
        this.irqEnabled = x >> 7 & 1
        this.loop = x >> 6 & 1
        this.rateIndex = x & 15

        if (!this.irqEnabled) {
            this.interruptFlag = 0
        }
    }
    setR2(x: uint8): void {// $4011
        this.outputLevel = x & 0x7F
    }
    setR3(x: uint8): void {// $4012
        this.sampleAddress = 0xC000 + x * 64
    }
    setR4(x: uint8): void {// $4013
        this.sampleLength = x * 16 + 1
    }
    // IRQ enabled flag. If clear, the interrupt flag is cleared.
    irqEnabled = 0
    // Loop flag
    loop = 0
    // Rate index
    rateIndex = 0
    // The rate determines for how many CPU cycles happen between changes in the
    // output level during automatic delta-encoded sample playback.
    private static rateTable = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54]

    outputLevel = 0
    sampleAddress = 0xC000
    sampleLength = 1

    interruptFlag = 0
    // The sample buffer either holds a single 8-bit sample byte or is empty.
    // It is filled by the reader and can only be emptied by the output unit;
    // once loaded with a sample byte it will be played back.
    sampleBuffer: uint8 | null = null

    // When the sample buffer is emptied, the memory reader fills the sample
    // buffer with the next byte from the currently playing sample. It has an
    // address counter and a bytes remaining counter.
    readAddress = 0
    readBytesRemaining = 0

    cpuStallCount = 0

    // https://wiki.nesdev.com/w/index.php/APU_DMC#Memory_reader
    private fillBuffer() { // idempotent
        if (this.sampleBuffer !== null) {
            return
        }
        if (this.readBytesRemaining === 0) {
            return
        }

        // TODO: implement CPU stall
        this.cpuStallCount = 4

        // The sample buffer is filled with the next sample byte read from the
        // current address, subject to whatever mapping hardware is present.
        this.sampleBuffer = this.mapper.readCPU(this.readAddress)

        // The address is incremented; if it exceeds $FFFF, it is wrapped around
        // to $8000.
        if (this.readAddress === 0xFFFF) {
            this.readAddress = 0x8000
        } else {
            this.readAddress++
        }
        // The bytes remaining counter is decremented; if it becomes zero and
        // the loop flag is set, the sample is restarted (see above); otherwise,
        // if the bytes remaining counter becomes zero and the IRQ enabled flag
        // is set, the interrupt flag is set.
        this.readBytesRemaining--
        if (this.readBytesRemaining === 0) {
            if (this.loop) {
                this.restart()
            } else if (this.irqEnabled) {
                this.interruptFlag = 1
            }
        }
    }

    timer = 0
    tickAPU(): void {
        if (this.timer === 0) {
            this.timer = DMC.rateTable[this.rateIndex] / 2
            this.timerClock()
        } else {
            this.timer--
        }
    }

    restart(): void {
        this.readAddress = this.sampleAddress
        this.readBytesRemaining = this.sampleLength
        this.fillBuffer()
    }

    // https://wiki.nesdev.com/w/index.php/APU_DMC#Output_unit
    private timerClock() {
        this.fillBuffer()

        // The bits-remaining counter is updated whenever the timer outputs a
        // clock, regardless of whether a sample is currently playing. When this
        // counter reaches zero, we say that the output cycle ends. The DPCM
        // unit can only transition from silent to playing at the end of an
        // output cycle.

        // When the timer outputs a clock, the following actions occur in order:
        //
        // * If the silence flag is clear, the output level changes based on bit
        //   0 of the shift register. If the bit is 1, add 2; otherwise,
        //   subtract 2. But if adding or subtracting 2 would cause the output
        //   level to leave the 0 - 127 range, leave the output level unchanged.
        //   This means subtract 2 only if the current level is at least 2, or
        //   add 2 only if the current level is at most 125.
        // * The right shift register is clocked.
        // * As stated above, the bits-remaining counter is decremented. If it
        //   becomes zero, a new output cycle is started.
        if (!this.outputSilence) {
            if (this.outputShiftRegister & 1) {
                if (this.outputLevel + 2 <= 127) {
                    this.outputLevel += 2
                }
            } else {
                if (this.outputLevel - 2 >= 0) {
                    this.outputLevel -= 2
                }
            }
            this.outputShiftRegister >>= 1
        }
        this.outputBitsRemainingCounter--

        // When an output cycle ends, a new cycle is started as follows:
        //
        // * The bits-remaining counter is loaded with 8.
        // * If the sample buffer is empty, then the silence flag is set;
        //   otherwise, the silence flag is cleared and the sample buffer is
        //   emptied into the shift register.
        if (this.outputBitsRemainingCounter === 0) {
            this.outputBitsRemainingCounter = 8
            if (this.sampleBuffer === null) {
                this.outputSilence = 1
            } else {
                this.outputSilence = 0
                this.outputShiftRegister = this.sampleBuffer
                this.sampleBuffer = null
            }
        }
    }

    outputShiftRegister = 0
    outputBitsRemainingCounter = 1
    outputSilence = 0
    output(): number {
        assertInRange(this.outputLevel, 0, 127)
        return this.outputLevel
    }
}
