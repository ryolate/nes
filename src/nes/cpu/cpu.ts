import * as Opcode from './opcode'
import { uint8, uint16, uint8ToSigned, UINT8_MAX, UINT16_MAX, hasBit, assertUint8, assertUint16 } from '../num'
import { PPU } from '../ppu/ppu'
import { NMI } from './nmi'
import { Controller } from '../controller'
import { APU } from '../apu'
import { Logger } from '../logger'
import { Mapper } from '../mappers/mapper'

/*

References
- memory map https://wiki.nesdev.com/w/index.php/CPU_memory_map
- I/O registers https://wiki.nesdev.com/w/index.php?title=2A03
- NMI https://wiki.nesdev.com/w/index.php?title=NMI
*/

export interface Operation extends Opcode.Opcode {
    arg: uint8 | uint16 // value used for addressing
}

export class CPUHaltError extends Error { }

export function operation2str(op: Operation): string {
    const n = (() => {
        switch (op.mode) {
            case Opcode.Mode.IMP: // imp
                return 0
            case Opcode.Mode.IMM:
            case Opcode.Mode.ZP:
            case Opcode.Mode.ZPX:
            case Opcode.Mode.ZPY:
            case Opcode.Mode.IZX:
            case Opcode.Mode.IZY:
                return 2
            case Opcode.Mode.ABS:
            case Opcode.Mode.ABX:
            case Opcode.Mode.ABY:
            case Opcode.Mode.IND:
            case Opcode.Mode.REL:
                return 4
        }
    })()

    const addr = `$${op.arg.toString(16).toUpperCase().padStart(n, "0")}`

    return op.opcode + " " + ((): string => {
        switch (op.mode) {
            case Opcode.Mode.IMP: // imp
                return ""
            case Opcode.Mode.IMM:
                return `#${addr}`
            case Opcode.Mode.ZP:
                return `${addr}`
            case Opcode.Mode.ZPX:
                return `${addr},X`
            case Opcode.Mode.ZPY:
                return `${addr},Y`
            case Opcode.Mode.IZX:
                return `(${addr},X)`
            case Opcode.Mode.IZY:
                return `(${addr}),Y`
            case Opcode.Mode.ABS:
                return `${addr}`
            case Opcode.Mode.ABX:
                return `${addr},X`
            case Opcode.Mode.ABY:
                return `${addr},Y`
            case Opcode.Mode.IND:
                return `(${addr})`
            case Opcode.Mode.REL:
                return `${addr} (relative)`
        }
    })()
}

function dec(x: uint8): uint8 {
    return (x + UINT8_MAX) & UINT8_MAX
}
function inc(x: uint8): uint8 {
    return (x + 1) & UINT8_MAX
}
function comp(x: uint8): uint8 {
    return (x ^ UINT8_MAX) + 1
}
function sign(x: uint8): boolean { // true -> negative
    return hasBit(x, 7)
}

function dec16(x: uint16): uint16 {
    return (x + UINT16_MAX) & UINT16_MAX
}
function inc16(x: uint16): uint16 {
    return (x + 1) & UINT16_MAX
}

export class CPU {
    A: uint8 = 0
    X: uint8 = 0
    Y: uint8 = 0
    S: uint8
    PC: uint16 = 0
    cycle = 0
    debugMode = false

    // https://wiki.nesdev.com/w/index.php/User:Karatorian/6502_Instruction_Set#The_X_Index_Register
    // Status flags: https://wiki.nesdev.com/w/index.php/Status_flags
    private N: uint8 = 0 // negative
    private V: uint8 = 0 // overflow
    private D: uint8 = 0 // decimal
    // I: Interrupt Disable
    // When set, all interrupts except the NMI are inhibited.
    private I: number
    private Z: uint8 = 0 // zero
    private C: uint8 = 0 // carry

    private halt = false
    private nmi: NMI

    private stallCount = 6 // number of cycles consumed ahead of time

    constructor(mapper: Mapper, ppu: PPU, nmi: NMI, controller: Controller, apu: APU) {
        this.nmi = nmi
        // https://wiki.nesdev.com/w/index.php/CPU_power_up_state
        this.S = 0xFD
        this.I = 1

        this.CPURAM = new Uint8Array(0x800)
        this.mapper = mapper
        this.ppu = ppu
        this.controller = controller
        this.apu = apu

        this.reset()
    }
    private reset(): void {
        // reset vector at $FFFC
        this.PC = this.read16(0xFFFC)
    }

    private postIncPC(): uint16 {
        const res = this.PC++
        if (this.PC > UINT16_MAX) {
            this.PC = 0
        }
        return res
    }

    private fetch(): uint8 {
        return this.read(this.postIncPC())
    }

    private fetch16(): uint16 {
        return this.fetch() | this.fetch() << 8
    }

    fetchInstruction(): Operation {
        let op: Opcode.Opcode
        if (this.nmi.handle()) {
            op = Opcode.nmi
        } else if (!this.I && this.apu.irq()) {
            op = Opcode.irq
        } else {
            op = Opcode.opcodes[this.fetch()]
        }
        let arg = 0
        if (op.mode === Opcode.Mode.IMP) {
            arg = 0
        } else if (op.mode <= Opcode.Mode.REL) {
            arg = this.fetch()
        } else {
            arg = this.fetch16()
        }
        return {
            ...op,
            arg,
        }
    }

    private setNZ(x: uint8): uint8 {
        assertUint8(x)
        this.N = hasBit(x, 7) ? 1 : 0
        this.Z = x == 0 ? 1 : 0
        return x
    }

    private setNZC(x: number): uint8 {
        this.C = hasBit(x, 8) ? 1 : 0
        return this.setNZ(x & UINT8_MAX)
    }

    private push(x: uint8) {
        assertUint8(x)
        this.write(0x100 + this.S, x)
        this.S = dec(this.S)
    }

    private push16(x: uint16) {
        assertUint16(x)
        this.push(x >> 8)
        this.push(x & UINT8_MAX)
    }

    private pop(): uint8 {
        this.S = inc(this.S)
        assertUint8(this.S)
        return this.read(0x100 + this.S)
    }

    private pop16(): uint16 {
        return this.pop() | this.pop() << 8
    }

    private setP(p: uint8): void {
        this.N = (p >> 7) & 1
        this.V = (p >> 6) & 1
        this.D = (p >> 3) & 1
        this.I = (p >> 2) & 1
        this.Z = (p >> 1) & 1
        this.C = (p >> 0) & 1
    }
    getP(): uint8 {
        return this.N << 7 | this.V << 6 | 1 << 5 | 0 << 4 | this.D << 3 | this.I << 2 | this.Z << 1 | this.C
    }

    private execute(instr: Operation): void {
        this.stallCount += instr.cycle - 1
        // https://wiki.nesdev.com/w/index.php/CPU_addressing_modes
        let pageBoundaryCrossed = false

        let addr = 0
        switch (instr.mode) {
            case Opcode.Mode.IMM:
                addr = dec16(this.PC)
                break
            case Opcode.Mode.ZP:
                // absolute addressing of the first 256 bytes
                addr = instr.arg
                break
            case Opcode.Mode.ZPX: // d,x
                addr = (instr.arg + this.X) & UINT8_MAX
                break
            case Opcode.Mode.ZPY: // d,y
                addr = (instr.arg + this.Y) & UINT8_MAX
                break
            case Opcode.Mode.IZX: // (d,x)
                addr = this.read16((instr.arg + this.X) & UINT8_MAX)
                break
            case Opcode.Mode.IZY: {// (d), y
                const base = this.read16(instr.arg)
                const p = (base + this.Y) & UINT16_MAX
                pageBoundaryCrossed = (p >> 8) != (base >> 8)
                addr = p
                break
            }
            case Opcode.Mode.ABS:
                addr = instr.arg
                break
            case Opcode.Mode.ABX: { // a,x
                addr = (instr.arg + this.X) & UINT16_MAX
                pageBoundaryCrossed = (addr >> 8) != (instr.arg >> 8)
                break
            }
            case Opcode.Mode.ABY: {// a,y
                addr = (instr.arg + this.Y) & UINT16_MAX
                pageBoundaryCrossed = (addr >> 8) != (instr.arg >> 8)
                break
            }
            case Opcode.Mode.IND:
                addr = this.read16(instr.arg)
                break
            case Opcode.Mode.REL:
                addr = (this.PC + uint8ToSigned(instr.arg)) & UINT16_MAX
                break
        }

        let branched = false
        switch (instr.opcode) {
            // Fake opcodes
            case Opcode.Instruction._NMI:
                this.push16(this.PC)
                this.push(this.getP())
                this.PC = this.read16(0xFFFA)
                this.I = 1
                break
            case Opcode.Instruction._IRQ:
                this.push16(this.PC)
                this.push(this.getP())
                this.PC = this.read16(0xFFFE)
                this.I = 1
                break
            // Logical and arithmetic commands
            case Opcode.Instruction.ORA:
                this.A = this.setNZ(this.A | this.read(addr))
                break
            case Opcode.Instruction.AND:
                this.A = this.setNZ(this.A & this.read(addr))
                break
            case Opcode.Instruction.EOR:
                this.A = this.setNZ(this.A ^ this.read(addr))
                break
            case Opcode.Instruction.ADC: {
                const a = this.A
                const m = this.read(addr)
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case Opcode.Instruction.SBC: {
                const a = this.A
                const m = this.read(addr) ^ UINT8_MAX
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case Opcode.Instruction.CMP: {
                this.setNZC(this.A + comp(this.read(addr)))
                break
            }
            case Opcode.Instruction.CPX: {
                this.setNZC(this.X + comp(this.read(addr)))
                break
            }
            case Opcode.Instruction.CPY: {
                this.setNZC(this.Y + comp(this.read(addr)))
                break
            }
            case Opcode.Instruction.DEC: {
                this.write(addr, this.setNZ(dec(this.read(addr))))
                break
            }
            case Opcode.Instruction.DEX: {
                this.X = this.setNZ(dec(this.X))
                break
            }
            case Opcode.Instruction.DEY: {
                this.Y = this.setNZ(dec(this.Y))
                break
            }
            case Opcode.Instruction.INC: {
                this.write(addr, this.setNZ(inc(this.read(addr))))
                break
            }
            case Opcode.Instruction.INX: {
                this.X = this.setNZ(inc(this.X))
                break
            }
            case Opcode.Instruction.INY: {
                this.Y = this.setNZ(inc(this.Y))
                break
            }
            case Opcode.Instruction.ASL: {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m * 2)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case Opcode.Instruction.ROL: {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m * 2 + this.C)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case Opcode.Instruction.LSR: {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m >> 1 | (m & 1) << 8)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case Opcode.Instruction.ROR: {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m >> 1 | this.C << 7 | (m & 1) << 8)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            // Move commands
            case Opcode.Instruction.LDA: {
                this.A = this.setNZ(this.read(addr))
                break
            }
            case Opcode.Instruction.STA: {
                this.write(addr, this.A)
                break
            }
            case Opcode.Instruction.LDX: {
                this.X = this.setNZ(this.read(addr))
                break
            }
            case Opcode.Instruction.STX: {
                this.write(addr, this.X)
                break
            }
            case Opcode.Instruction.LDY: {
                this.Y = this.setNZ(this.read(addr))
                break
            }
            case Opcode.Instruction.STY: {
                this.write(addr, this.Y)
                break
            }
            case Opcode.Instruction.TAX: {
                this.X = this.setNZ(this.A)
                break
            }
            case Opcode.Instruction.TXA: {
                this.A = this.setNZ(this.X)
                break
            }
            case Opcode.Instruction.TAY: {
                this.Y = this.setNZ(this.A)
                break
            }
            case Opcode.Instruction.TYA: {
                this.A = this.setNZ(this.Y)
                break
            }
            case Opcode.Instruction.TSX: {
                this.X = this.setNZ(this.S)
                break
            }
            case Opcode.Instruction.TXS: {
                this.S = this.X
                break
            }
            case Opcode.Instruction.PLA: {
                this.A = this.setNZ(this.pop())
                break
            }
            case Opcode.Instruction.PHA: {
                this.push(this.A)
                break
            }
            case Opcode.Instruction.PLP: {
                this.setP(this.pop())
                break
            }
            case Opcode.Instruction.PHP: {
                this.push(this.getP() | 1 << 4 | 1 << 5)
                break
            }
            // Jump/Flag commands
            case Opcode.Instruction.BPL: {
                if (!this.N) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BMI: {
                if (this.N) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BVC: {
                if (!this.V) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BVS: {
                if (this.V) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BCC: {
                if (!this.C) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BCS: {
                if (this.C) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BNE: {
                if (!this.Z) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BEQ: {
                if (this.Z) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case Opcode.Instruction.BRK: {
                this.push16(this.PC)
                this.push(this.getP())
                this.PC = this.read16(0xFFFE)
                break
            }
            case Opcode.Instruction.RTI: {
                this.setP(this.pop())
                this.PC = this.pop16()
                break
            }
            case Opcode.Instruction.JSR: {
                this.push16(dec16(this.PC))
                this.PC = addr
                break
            }
            case Opcode.Instruction.RTS: {
                this.PC = inc16(this.pop16())
                break
            }
            case Opcode.Instruction.JMP: {
                this.PC = addr
                break
            }
            case Opcode.Instruction.BIT: {
                const m = this.read(addr)
                this.Z = (m & this.A) == 0 ? 1 : 0
                this.N = m >> 7 & 1
                this.V = m >> 6 & 1
                break
            }
            case Opcode.Instruction.CLC: {
                this.C = 0
                break
            }
            case Opcode.Instruction.SEC: {
                this.C = 1
                break
            }
            case Opcode.Instruction.CLD: {
                this.D = 0
                break
            }
            case Opcode.Instruction.SED: {
                this.D = 1
                break
            }
            case Opcode.Instruction.CLI: {
                this.I = 0
                break
            }
            case Opcode.Instruction.SEI: {
                this.I = 1
                break
            }
            case Opcode.Instruction.CLV: {
                this.V = 0
                break
            }
            case Opcode.Instruction.NOP: {
                break
            }
            // Illegal opcodes
            case Opcode.Instruction.SLO: {
                const m = this.setNZC(this.read(addr) << 1)
                this.write(addr, m)
                this.A = this.setNZ(this.A | m)
                break
            }
            case Opcode.Instruction.RLA: {
                const m = this.setNZC(this.read(addr) * 2 + this.C)
                this.write(addr, m)
                this.A = this.setNZ(this.A & m)
                break
            }
            case Opcode.Instruction.SRE: {
                let m = this.read(addr)
                this.C = m & 1
                m = this.setNZ(m >> 1)
                this.write(addr, m)
                this.A = this.setNZ(this.A ^ m)
                break
            }
            case Opcode.Instruction.RRA: {
                let m = this.read(addr)
                m = this.setNZC(((m & 1) << 8) | m >> 1 | this.C << 7)
                this.write(addr, m)
                const a = this.A
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case Opcode.Instruction.SAX: {
                this.write(addr, this.A & this.X)
                break
            }
            case Opcode.Instruction.LAX: {
                this.A = this.X = this.setNZ(this.read(addr))
                break
            }
            case Opcode.Instruction.DCP: { // DEC + CMP
                const m = this.setNZ(dec(this.read(addr)))
                this.write(addr, m)
                this.setNZC(this.A + comp(m))
                break
            }
            case Opcode.Instruction.ISC: { // INC + SBC
                this.write(addr, this.setNZ(inc(this.read(addr))))
                const a = this.A
                const m = this.read(addr) ^ UINT8_MAX
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case Opcode.Instruction.ANC: {
                this.A = this.setNZ(this.A & this.read(addr))
                this.C = (this.A >> 7) & 1
                break
            }
            case Opcode.Instruction.ALR: { // AND + LSR(imp)
                const m = this.A & this.read(addr)
                this.A = this.setNZ(m >> 1)
                this.C = m & 1
                break
            }
            case Opcode.Instruction.ARR: { // AND + ROR(imp)
                const m = this.read(addr)
                this.A &= m
                this.A = this.setNZ(this.A >> 1 | this.C << 7)
                this.C = this.A >> 6 & 1
                this.V = this.C ^ (this.A >> 5 & 1)
                break
            }
            case Opcode.Instruction.XAA: {
                this.A = this.setNZ(this.X & this.read(addr))
                break
            }
            case Opcode.Instruction.AXS: {
                this.X = this.setNZC((this.A & this.X) + comp(this.read(addr)))
                break
            }
            case Opcode.Instruction.AHX: {
                this.write(addr, this.A & this.X & inc(addr >> 8))
                break
            }
            case Opcode.Instruction.SHY: {
                // SHX and SHY are bizzare
                // https://csdb.dk/forums/?roomid=11&topicid=94460

                // High byte of the address written to
                let H = addr >> 8
                if (pageBoundaryCrossed) {
                    H = inc(addr >> 8) & this.Y
                }
                const value = this.Y & inc(addr >> 8)
                this.write((H << 8) | (addr & 0xFF), value)
                break
            }
            case Opcode.Instruction.SHX: {
                let H = addr >> 8
                if (pageBoundaryCrossed) {
                    H = inc(addr >> 8) & this.X
                }
                const value = this.X & inc(addr >> 8)
                this.write((H << 8) | (addr & 0xFF), value)
                break
            }
            case Opcode.Instruction.TAS: {
                this.S = this.A & this.X
                this.write(addr, this.S & inc(addr >> 8))
                break
            }
            case Opcode.Instruction.LAS: {
                this.A = this.X = this.S = this.setNZ(this.read(addr) & this.S)
                break
            }
            // Halt
            case Opcode.Instruction.KIL: {
                this.halt = true
                break
            }
            default: {
                throw new Error(`BUG: unimplemented opcode ${instr.opcode}`)
            }
        }
        if (branched) {
            this.stallCount++
        }
        if (pageBoundaryCrossed && instr.extra) {
            this.stallCount++
        }
    }

    // throw error on CPU halt.
    tickCPU(): void {
        if (this.halt) {
            throw new CPUHaltError("CPU halt")
        }

        this.cycle++
        if (this.stallCount > 0) {
            this.stallCount--
            return
        }

        this.instructionCount++

        this.debugCallbacks.forEach(x => {
            x[0](this.cpuStatus())
        });

        const instr = this.fetchInstruction()
        this.execute(instr)

        return
    }

    ////////////////////////////// BUS //////////////////////////////
    private CPURAM: Uint8Array // 2KB internal RAM
    private mapper: Mapper // Cartridge space
    private ppu: PPU

    private controller: Controller
    private apu: APU

    logger?: Logger

    // https://wiki.nesdev.com/w/index.php/CPU_memory_map
    private read(pc: uint16): uint8 {
        if (pc < 0x2000) {
            return this.CPURAM[pc & 0x7FF]
        } else if (pc < 0x4000) {
            return this.ppu.readCPU(pc)
        } else if (pc < 0x4016) {
            return this.apu.read(pc)
        } else if (pc === 0x4016) {
            return this.controller.read4016()
        } else if (pc === 0x4017) {
            return this.controller.read4017()
        } else if (pc < 0x4020) {
            // CPU Test Mode
        } else {
            return this.mapper.readCPU(pc)
        }
        throw new Error(`Unsupported CPU.read 0x${pc.toString(16)}`)
    }
    private read16(pc: uint16): uint16 {
        let np = pc + 1
        if ((np >> 8) > (pc >> 8)) np -= 0x100
        return this.read(pc) | this.read(np) << 8
    }

    private dmaBuf: Array<uint8> = new Array(256)
    private write(pc: uint16, x: uint8) {
        assertUint16(pc)
        assertUint8(x)
        if (pc < 0x2000) {
            this.CPURAM[pc % 0x800] = x
        } else if (pc < 0x4000) {
            // PPU
            this.ppu.writeCPU(pc, x)
        } else if (pc === 0x4014) {
            // OAMDMA
            // upload 256 bytes of data from CPU page $XX00-$XXFF to the
            // internal PPU OAM
            for (let i = 0; i < 256; i++) {
                this.dmaBuf[i] = this.read(x << 8 | i)
            }
            this.ppu.sendDMA(this.dmaBuf)
            // The CPU is suspended during the transfer, which will take 513 or
            // 514 cycles after the $4014 write tick. (1 wait state cycle while
            // waiting for writes to complete, +1 if on an odd CPU cycle, then
            // 256 alternating read/write cycles.)
            this.stallCount += 513 + (this.cycle & 1)
        } else if (pc === 0x4016) {
            // Controller
            this.controller.write4016(x)
        } else if (pc < 0x4018) {
            if (pc >= 0x4010) {
                this.logger?.log(`${this.cycle}: $${pc.toString(16)} <- 0x${x.toString(16).toUpperCase()}`)
            }
            // APU
            this.apu.write(pc, x)
        } else if (pc < 0x4020) {
            // CPU Test Mode
            throw new Error(`Unsupported write(0x${pc.toString(16)}, ${x}) to CPU Test Mode`)
        } else {
            this.mapper.writeCPU(pc, x)
        }
    }

    ////////////////////////////// Debug //////////////////////////////
    instructionCount = 0
    setPC(pc: uint16): void {
        this.PC = pc
    }

    private debugCallbackID = 0
    private debugCallbacks: Array<[(c: CPUStatus) => void, number]> = []
    addDebugCallback(f: (c: CPUStatus) => void): number {
        this.debugCallbacks.push([f, this.debugCallbackID])

        if (this.debugCallbacks.length >= 2) {
            console.error("debugcallback >= 2")
        }

        return this.debugCallbackID++
    }
    removeDebugCallback(id: number): void {
        for (let i = 0; i < this.debugCallbacks.length; i++) {
            if (this.debugCallbacks[i][1] !== id) {
                continue
            }
            this.debugCallbacks.splice(i, 1)
        }
    }

    cpuStatus(): CPUStatus {
        return {
            registers: {
                pc: this.PC,
                a: this.A,
                x: this.X,
                y: this.Y,
                p: this.getP(),
                s: this.S,
            },
            cyc: this.cycle,
            instr: this.instructionCount,
        }
    }

    // Gets instruction without side effect.
    // Returns next pc too.
    getInstruction(pc: uint16): [Operation, number] {
        const op = Opcode.opcodes[this.read(pc++)]
        const x = (() => {
            switch (op.mode) {
                case Opcode.Mode.IMP: // imp
                    return 0
                case Opcode.Mode.IMM:
                case Opcode.Mode.ZP:
                case Opcode.Mode.ZPX:
                case Opcode.Mode.ZPY:
                case Opcode.Mode.IZX:
                case Opcode.Mode.IZY:
                case Opcode.Mode.REL:
                    return this.read(pc++)
                case Opcode.Mode.ABS:
                case Opcode.Mode.ABX:
                case Opcode.Mode.ABY:
                case Opcode.Mode.IND: {
                    const res = this.read16(pc)
                    pc += 2
                    return res
                }
            }
        })()
        return [{
            ...op,
            arg: x,
        }, pc]
    }

    // disasm next n instructions without side effect.
    disasm(n: number): Array<[number, string]> {
        let pc = this.PC
        const res = new Array<[number, string]>()
        for (let i = 0; i < n && pc < 0xFFFC; i++) {
            const [op, nextPC] = this.getInstruction(pc)
            res.push([pc, operation2str(op)])
            pc = nextPC
        }
        return res
    }
}

export interface CPUStatus {
    registers: {
        pc: uint16
        a: uint8
        x: uint8
        y: uint8
        p: uint8
        s: uint8
    }
    cyc: number
    instr: number
}
