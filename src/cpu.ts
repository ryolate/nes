import * as Opcode from './opcode'
import { uint8, uint16, uint8ToSigned, UINT8_MAX, UINT16_MAX, hasBit, checkUint16, assertUint8, assertUint16 } from './num'
import { Cartridge } from './cartridge'
import { PPU } from './ppu/ppu'
import { NMI } from './nmi'
import { Controller } from './controller'
import { APU } from './apu'
import { Logger } from './logger'

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
            case "": // imp
                return 0
            case "imm":
            case "zp":
            case "zpx":
            case "zpy":
            case "izx":
            case "izy":
                return 2
            case "abs":
            case "abx":
            case "aby":
            case "ind":
            case "rel":
                return 4
        }
    })()

    const addr = `$${op.arg.toString(16).padStart(n, "0")}`

    return op.opcode + " " + ((): string => {
        switch (op.mode) {
            case "": // imp
                return ""
            case "imm":
                return `#${addr}`
            case "zp":
                return `${addr}`
            case "zpx":
                return `${addr},X`
            case "zpy":
                return `${addr},Y`
            case "izx":
                return `(${addr},X)`
            case "izy":
                return `(${addr}),Y`
            case "abs":
                return `${addr}`
            case "abx":
                return `${addr},X`
            case "aby":
                return `${addr},Y`
            case "ind":
                return `(${addr})`
            case "rel":
                return `${addr} (PC-relative)`
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

function dec16(x: uint16): uint16 {
    return (x + UINT16_MAX) & UINT16_MAX
}
function inc16(x: uint16): uint16 {
    return (x + 1) & UINT16_MAX
}

export class CPU {
    private _A: uint8 = 0

    private set A(x: uint8) {
        assertUint8(x)
        this._A = x
    }
    private get A(): uint8 {
        return this._A
    }

    private X: uint8 = 0
    private Y: uint8 = 0
    private S: uint8
    private _PC: uint16 = 0
    private cycle = 0
    debugMode = false

    private set PC(x: uint16) {
        while (x > UINT16_MAX) {
            x -= UINT16_MAX
        }
        this._PC = x
    }

    private get PC(): uint16 {
        return this._PC
    }

    getPC(): uint16 {
        return this.PC
    }

    // https://wiki.nesdev.com/w/index.php/User:Karatorian/6502_Instruction_Set#The_X_Index_Register
    // Status flags: https://wiki.nesdev.com/w/index.php/Status_flags
    private N: uint8 = 0 // negative
    private V: uint8 = 0 // overflow
    private D: uint8 = 0 // decimal
    private I: uint8 // interrupt
    private Z: uint8 = 0 // zero
    private C: uint8 = 0 // carry

    private halt = false
    private nmi: NMI

    private stallCount = 6 // number of cycles consumed ahead of time

    constructor(cartridge: Cartridge, ppu: PPU, nmi: NMI, controller: Controller, apu: APU) {
        this.nmi = nmi
        // https://wiki.nesdev.com/w/index.php/CPU_power_up_state
        this.S = 0xFD
        this.I = 1

        this.CPURAM = new Uint8Array(0x800)
        this.cartridge = cartridge
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
        } else {
            op = Opcode.opcodes[this.fetch()]
        }
        const x = (() => {
            switch (op.mode) {
                case "": // imp
                    return 0
                case "imm":
                case "zp":
                case "zpx":
                case "zpy":
                case "izx":
                case "izy":
                case "rel":
                    return this.fetch()
                case "abs":
                case "abx":
                case "aby":
                case "ind":
                    return this.fetch16()
            }
        })()
        return {
            ...op,
            arg: x,
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
    private getP(): uint8 {
        return this.N << 7 | this.V << 6 | 1 << 5 | 0 << 4 | this.D << 3 | this.I << 2 | this.Z << 1 | this.C
    }

    private execute(instr: Operation): void {
        this.stallCount += instr.cycle - 1
        // https://wiki.nesdev.com/w/index.php/CPU_addressing_modes
        let pageBoundaryCrossed = false
        const addr = ((): uint16 => {
            switch (instr.mode) {
                case "":
                    return 0
                case "imm":
                    return dec16(this.PC)
                case "zp":
                    // absolute addressing of the first 256 bytes
                    return instr.arg
                case "zpx": // d,x
                    return (instr.arg + this.X) & UINT8_MAX
                case "zpy": // d,y
                    return (instr.arg + this.Y) & UINT8_MAX
                case "izx": // (d,x)
                    return this.read16((instr.arg + this.X) & UINT8_MAX)
                case "izy": {// (d), y
                    const base = this.read16(instr.arg)
                    const p = (base + this.Y) & UINT16_MAX
                    pageBoundaryCrossed = (p >> 8) != (base >> 8)
                    return p
                }
                case "abs":
                    return instr.arg
                case "abx": { // a,x
                    const p = (instr.arg + this.X) & UINT16_MAX
                    pageBoundaryCrossed = (p >> 8) != (instr.arg >> 8)
                    return p
                }
                case "aby": {// a,y
                    const p = (instr.arg + this.Y) & UINT16_MAX
                    pageBoundaryCrossed = (p >> 8) != (instr.arg >> 8)
                    return p
                }
                case "ind":
                    return this.read16(instr.arg)
                case "rel": {
                    return (this.PC + uint8ToSigned(instr.arg)) & UINT16_MAX
                }
            }
        })()

        function sign(x: uint8): boolean { // true -> negative
            return hasBit(x, 7)
        }

        let branched = false
        switch (instr.opcode) {
            // Fake opcodes
            case "_NMI":
                this.push16(this.PC)
                this.push(this.getP())
                this.PC = this.read16(0xFFFA)
                this.I = 1
                break
            case "_IRQ":
                this.push16(this.PC)
                this.push(this.getP())
                this.PC = this.read16(0xFFFE)
                this.I = 1
                break
            // Logical and arithmetic commands
            case "ORA":
                this.A = this.setNZ(this.A | this.read(addr))
                break
            case "AND":
                this.A = this.setNZ(this.A & this.read(addr))
                break
            case "EOR":
                this.A = this.setNZ(this.A ^ this.read(addr))
                break
            case "ADC": {
                const a = this.A
                const m = this.read(addr)
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "SBC": {
                const a = this.A
                const m = this.read(addr) ^ UINT8_MAX
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "CMP": {
                this.setNZC(this.A + comp(this.read(addr)))
                break
            }
            case "CPX": {
                this.setNZC(this.X + comp(this.read(addr)))
                break
            }
            case "CPY": {
                this.setNZC(this.Y + comp(this.read(addr)))
                break
            }
            case "DEC": {
                this.write(addr, this.setNZ(dec(this.read(addr))))
                break
            }
            case "DEX": {
                this.X = this.setNZ(dec(this.X))
                break
            }
            case "DEY": {
                this.Y = this.setNZ(dec(this.Y))
                break
            }
            case "INC": {
                this.write(addr, this.setNZ(inc(this.read(addr))))
                break
            }
            case "INX": {
                this.X = this.setNZ(inc(this.X))
                break
            }
            case "INY": {
                this.Y = this.setNZ(inc(this.Y))
                break
            }
            case "ASL": {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m * 2)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case "ROL": {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m * 2 + this.C)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case "LSR": {
                const m = instr.mode ? this.read(addr) : this.A
                const v = this.setNZC(m >> 1 | (m & 1) << 8)
                if (instr.mode) {
                    this.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case "ROR": {
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
            case "LDA": {
                this.A = this.setNZ(this.read(addr))
                break
            }
            case "STA": {
                this.write(addr, this.A)
                break
            }
            case "LDX": {
                this.X = this.setNZ(this.read(addr))
                break
            }
            case "STX": {
                this.write(addr, this.X)
                break
            }
            case "LDY": {
                this.Y = this.setNZ(this.read(addr))
                break
            }
            case "STY": {
                this.write(addr, this.Y)
                break
            }
            case "TAX": {
                this.X = this.setNZ(this.A)
                break
            }
            case "TXA": {
                this.A = this.setNZ(this.X)
                break
            }
            case "TAY": {
                this.Y = this.setNZ(this.A)
                break
            }
            case "TYA": {
                this.A = this.setNZ(this.Y)
                break
            }
            case "TSX": {
                this.X = this.setNZ(this.S)
                break
            }
            case "TXS": {
                this.S = this.X
                break
            }
            case "PLA": {
                this.A = this.setNZ(this.pop())
                break
            }
            case "PHA": {
                this.push(this.A)
                break
            }
            case "PLP": {
                this.setP(this.pop())
                break
            }
            case "PHP": {
                this.push(this.getP() | 1 << 4 | 1 << 5)
                break
            }
            // Jump/Flag commands
            case "BPL": {
                if (!this.N) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BMI": {
                if (this.N) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BVC": {
                if (!this.V) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BVS": {
                if (this.V) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BCC": {
                if (!this.C) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BCS": {
                if (this.C) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BNE": {
                if (!this.Z) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BEQ": {
                if (this.Z) {
                    pageBoundaryCrossed = addr >> 8 != this.PC >> 8
                    this.PC = addr
                    branched = true
                }
                break
            }
            case "BRK": {
                this.push16(this.PC)
                this.push(this.getP())
                this.PC = this.read16(0xFFFE)
                break
            }
            case "RTI": {
                this.setP(this.pop())
                this.PC = this.pop16()
                break
            }
            case "JSR": {
                this.push16(dec16(this.PC))
                this.PC = addr
                break
            }
            case "RTS": {
                this.PC = inc16(this.pop16())
                break
            }
            case "JMP": {
                this.PC = addr
                break
            }
            case "BIT": {
                const m = this.read(addr)
                this.Z = (m & this.A) == 0 ? 1 : 0
                this.N = m >> 7 & 1
                this.V = m >> 6 & 1
                break
            }
            case "CLC": {
                this.C = 0
                break
            }
            case "SEC": {
                this.C = 1
                break
            }
            case "CLD": {
                this.D = 0
                break
            }
            case "SED": {
                this.D = 1
                break
            }
            case "CLI": {
                this.I = 0
                break
            }
            case "SEI": {
                this.I = 1
                break
            }
            case "CLV": {
                this.V = 0
                break
            }
            case "NOP": {
                break
            }
            // Illegal opcodes
            case "SLO": {
                const m = this.setNZC(this.read(addr) << 1)
                this.write(addr, m)
                this.A = this.setNZ(this.A | m)
                break
            }
            case "RLA": {
                const m = this.setNZC(this.read(addr) * 2 + this.C)
                this.write(addr, m)
                this.A = this.setNZ(this.A & m)
                break
            }
            case "SRE": {
                let m = this.read(addr)
                this.C = m & 1
                m = this.setNZ(m >> 1)
                this.write(addr, m)
                this.A = this.setNZ(this.A ^ m)
                break
            }
            case "RRA": {
                let m = this.read(addr)
                m = this.setNZC(((m & 1) << 8) | m >> 1 | this.C << 7)
                this.write(addr, m)
                const a = this.A
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "SAX": {
                this.write(addr, this.A & this.X)
                break
            }
            case "LAX": {
                this.A = this.X = this.setNZ(this.read(addr))
                break
            }
            case "DCP": { // DEC + CMP
                const m = this.setNZ(dec(this.read(addr)))
                this.write(addr, m)
                this.setNZC(this.A + comp(m))
                break
            }
            case "ISC": { // INC + SBC
                this.write(addr, this.setNZ(inc(this.read(addr))))
                const a = this.A
                const m = this.read(addr) ^ UINT8_MAX
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "ANC": {
                this.A = this.setNZ(this.A & this.read(addr))
                this.C = (this.A >> 7) & 1
                break
            }
            case "ALR": { // AND + LSR(imp)
                const m = this.A & this.read(addr)
                this.A = this.setNZ(m >> 1)
                this.C = m & 1
                break
            }
            case "ARR": { // AND + ROR(imp)
                const m = this.read(addr)
                this.A = this.setNZ(this.A & m)
                const sum = this.A + m
                this.V = sign(this.A) == sign(m) && sign(this.A) != sign(sum) ? 1 : 0
                const c = (this.A >> 7) & 1
                this.A = this.setNZ(this.A >> 1 | this.C << 7)
                this.C = c
                break
            }
            case "XAA": {
                this.A = this.setNZ(this.X & this.read(addr))
                break
            }
            case "AXS": {
                this.X = this.setNZC((this.A & this.X) + comp(this.read(addr)))
                break
            }
            case "AHX": {
                this.write(addr, this.A & this.X & inc(addr >> 8))
                break
            }
            case "SHY": {
                this.write(addr, this.Y & inc(addr >> 8))
                break
            }
            case "SHX": {
                this.write(addr, this.X & inc(addr >> 8))
                break
            }
            case "TAS": {
                this.S = this.A & this.X
                this.write(addr, this.S & inc(addr >> 8))
                break
            }
            case "LAS": {
                this.A = this.X = this.S = this.setNZ(this.read(addr) & this.S)
                break
            }
            // Halt
            case "KIL": {
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
    tick(): void {
        if (this.halt) {
            throw new CPUHaltError("CPU halt")
        }

        this.cycle++
        if (this.stallCount > 0) {
            this.stallCount--
            return
        }

        this.instructionCount++

        this.logger?.setPrefix(`${this.PC.toString(16).toUpperCase()} ${this.instructionCount}`)
        this.debugCallbacks.forEach(x => {
            x[0](this.cpuStatus())
        });

        const instr = this.fetchInstruction()
        this.execute(instr)

        return
    }

    ////////////////////////////// BUS //////////////////////////////
    private CPURAM: Uint8Array // 2KB internal RAM
    private cartridge: Cartridge // Cartridge space
    private ppu: PPU

    private controller: Controller
    private apu: APU

    logger?: Logger

    // https://wiki.nesdev.com/w/index.php/CPU_memory_map
    private read(pc: uint16): uint8 {
        if (pc < 0x2000) {
            return this.CPURAM[pc & 0x7FF]
        } else if (pc < 0x4000) {
            this.logger?.log(`CPU.read($$${pc.toString(16)})`)
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
            return this.cartridge.readCPU(pc)
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
        if (pc === 0x511) {
            this.logger?.log(`0x${pc.toString(16).toUpperCase()} <- ${x}`)
        }
        checkUint16(pc)
        if (pc < 0x2000) {
            if (pc % 0x800 === 0x200) {
                this.logger?.log(`0x${pc.toString(16)} <- ${x}`)
            }
            this.CPURAM[pc % 0x800] = x
        } else if (pc < 0x4000) {
            // PPU
            this.ppu.writeCPU(pc, x)
        } else if (pc === 0x4014) {
            this.logger?.log(`CPU.write(0x${x.toString(16)}) OAMDMA`)
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
            // APU
            this.apu.write(pc, x)
        } else if (pc < 0x4020) {
            // CPU Test Mode
            throw new Error(`Unsupported write(0x${pc.toString(16)}, ${x}) to CPU Test Mode`)
        } else {
            this.cartridge.writeCPU(pc, x)
        }
    }

    ////////////////////////////// Debug //////////////////////////////
    private instructionCount = 0
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
