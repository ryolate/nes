import { opcodes, Opcode } from './opcode'
import { uint8, uint16, uint8ToSigned, UINT8_MAX, UINT16_MAX, hasBit, checkUint16 } from './num'
import { Cartridge } from './cartridge'

export interface Operation extends Opcode {
    arg: uint8 | uint16 // value used for addressing
}

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

function dec16(x: uint16): uint16 {
    return (x + UINT16_MAX) & UINT16_MAX
}

function inc16(x: uint16): uint16 {
    return (x + 1) & UINT16_MAX
}

function comp(x: uint8): uint8 {
    return (x ^ UINT8_MAX) + 1
}

export class CPU {
    private A: uint8 = 0
    private X: uint8 = 0
    private Y: uint8 = 0
    private S: uint8
    private _PC: uint16 = 0
    private bus: CPUBus
    private cycle: number = 0

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

    private stallCount: number = 6 // number of cycles consumed ahead of time

    constructor(bus: CPUBus) {
        this.bus = bus
        // https://wiki.nesdev.com/w/index.php/CPU_power_up_state
        this.S = 0xFD
        this.I = 1
    }

    postIncPC(): uint16 {
        let res = this.PC++
        if (this.PC > UINT16_MAX) {
            this.PC = 0
        }
        return res
    }

    fetch(): uint8 {
        const res = this.bus.read(this.postIncPC())
        if (this.PC > UINT16_MAX) {
            this.PC = 0
        }
        return res
    }

    fetch16(): uint16 {
        return this.fetch() | this.fetch() << 8
    }

    fetchInstruction(): Operation {
        const op = opcodes[this.fetch()]
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
                    return this.fetch()
                case "abs":
                case "abx":
                case "aby":
                case "ind":
                    return this.fetch16()
                case "rel":
                    return this.fetch()
            }
        })()
        return {
            ...op,
            arg: x,
        }
    }

    setNZ(x: uint8): uint8 {
        this.N = hasBit(x, 7) ? 1 : 0
        this.Z = x == 0 ? 1 : 0
        return x
    }

    setNZC(x: number): uint8 {
        this.C = hasBit(x, 8) ? 1 : 0
        return this.setNZ(x & UINT8_MAX)
    }

    push(x: uint8) {
        this.bus.write(0x100 + this.S, x)
        this.S = dec(this.S)
    }

    push16(x: uint16) {
        this.push(x >> 8)
        this.push(x & UINT8_MAX)
    }

    pop(): uint8 {
        this.S = inc(this.S)
        return this.bus.read(0x100 + this.S)
    }

    pop16(): uint16 {
        return this.pop() | this.pop() << 8
    }

    setP(p: uint8) {
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

    execute(instr: Operation) {
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
                    return this.bus.read16Wrapping((instr.arg + this.X) & UINT8_MAX)
                case "izy": {// (d), y
                    const base = this.bus.read16Wrapping(instr.arg)
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
                    return this.bus.read16Wrapping(instr.arg)
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
            // Logical and arithmetic commands
            case "ORA":
                this.A = this.setNZ(this.A | this.bus.read(addr))
                break
            case "AND":
                this.A = this.setNZ(this.A & this.bus.read(addr))
                break
            case "EOR":
                this.A = this.setNZ(this.A ^ this.bus.read(addr))
                break
            case "ADC": {
                let a = this.A
                const m = this.bus.read(addr)
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "SBC": {
                let a = this.A
                const m = this.bus.read(addr) ^ UINT8_MAX
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "CMP": {
                this.setNZC(this.A + comp(this.bus.read(addr)))
                break
            }
            case "CPX": {
                this.setNZC(this.X + comp(this.bus.read(addr)))
                break
            }
            case "CPY": {
                this.setNZC(this.Y + comp(this.bus.read(addr)))
                break
            }
            case "DEC": {
                this.bus.write(addr, this.setNZ(dec(this.bus.read(addr))))
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
                this.bus.write(addr, this.setNZ(inc(this.bus.read(addr))))
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
                const m = instr.mode ? this.bus.read(addr) : this.A
                const v = this.setNZC(m * 2)
                if (instr.mode) {
                    this.bus.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case "ROL": {
                const m = instr.mode ? this.bus.read(addr) : this.A
                const v = this.setNZC(m * 2 + this.C)
                if (instr.mode) {
                    this.bus.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case "LSR": {
                const m = instr.mode ? this.bus.read(addr) : this.A
                const v = this.setNZC(m >> 1 | (m & 1) << 8)
                if (instr.mode) {
                    this.bus.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            case "ROR": {
                const m = instr.mode ? this.bus.read(addr) : this.A
                const v = this.setNZC(m >> 1 | this.C << 7 | (m & 1) << 8)
                if (instr.mode) {
                    this.bus.write(addr, v)
                } else {
                    this.A = v
                }
                break
            }
            // Move commands
            case "LDA": {
                this.A = this.setNZ(this.bus.read(addr))
                break
            }
            case "STA": {
                this.bus.write(addr, this.A)
                break
            }
            case "LDX": {
                this.X = this.setNZ(this.bus.read(addr))
                break
            }
            case "STX": {
                this.bus.write(addr, this.X)
                break
            }
            case "LDY": {
                this.Y = this.setNZ(this.bus.read(addr))
                break
            }
            case "STY": {
                this.bus.write(addr, this.Y)
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
                let p = this.getP()
                p |= 1 << 5
                p |= 1 << 4
                this.push(p)
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
                this.PC = this.bus.read16(0xFFFE)
                break
            }
            case "RTI": {
                this.setP(this.pop())
                this.PC = this.pop16()
                break
            }
            case "JSR": {
                this.push16(this.PC - 1)
                this.PC = addr
                break
            }
            case "RTS": {
                this.PC = this.pop16() + 1
                break
            }
            case "JMP": {
                this.PC = addr
                break
            }
            case "BIT": {
                const m = this.bus.read(addr)
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
                const m = this.setNZC(this.bus.read(addr) << 1)
                this.bus.write(addr, m)
                this.A = this.setNZ(this.A | m)
                break
            }
            case "RLA": {
                const m = this.setNZC(this.bus.read(addr) * 2 + this.C)
                this.bus.write(addr, m)
                this.A = this.setNZ(this.A & m)
                break
            }
            case "SRE": {
                let m = this.bus.read(addr)
                this.C = m & 1
                m = this.setNZ(m >> 1)
                this.bus.write(addr, m)
                this.A = this.setNZ(this.A ^ m)
                break
            }
            case "RRA": {
                let m = this.bus.read(addr)
                m = this.setNZC(((m & 1) << 8) | m >> 1 | this.C << 7)
                this.bus.write(addr, m)
                const a = this.A
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "SAX": {
                this.bus.write(addr, this.A & this.X)
                break
            }
            case "LAX": {
                this.A = this.setNZ(this.bus.read(addr))
                this.X = this.A
                break
            }
            case "DCP": { // DEC + CMP
                const m = this.setNZ(dec(this.bus.read(addr)))
                this.bus.write(addr, m)
                this.setNZC(this.A + comp(m))
                break
            }
            case "ISC": { // INC + SBC
                this.bus.write(addr, this.setNZ(inc(this.bus.read(addr))))
                let a = this.A
                const m = this.bus.read(addr) ^ UINT8_MAX
                this.A = this.setNZC(a + this.C + m)
                this.V = sign(a) == sign(m) && sign(a) != sign(this.A) ? 1 : 0
                break
            }
            case "ANC": {
                this.A = this.setNZ(this.A & this.bus.read(addr))
                this.C = (this.A >> 7) & 1
                break
            }
            case "ALR": { // AND + LSR(imp)
                const m = this.A & this.bus.read(addr)
                this.A = this.setNZ(m >> 1)
                this.C = m & 1
                break
            }
            case "ARR": { // AND + ROR(imp)
                let m = this.bus.read(addr)
                this.A = this.setNZ(this.A & m)
                const sum = this.A + m
                this.V = sign(this.A) == sign(m) && sign(this.A) != sign(sum) ? 1 : 0
                const c = (this.A >> 7) & 1
                this.A = this.setNZ(this.A >> 1 | this.C << 7)
                this.C = c
                break
            }
            case "XAA": {
                this.A = this.setNZ(this.X & this.bus.read(addr))
                break
            }
            case "LAX": { // LDA + TAX
                this.A = this.X = this.setNZ(this.bus.read(addr))
                break
            }
            case "AXS": {
                this.X = this.setNZC((this.A & this.X) + comp(this.bus.read(addr)))
                break
            }
            case "AHX": {
                const h = inc(addr >> 8)
                this.bus.write(addr, this.A & this.X & h)
                break
            }
            case "SHY": {
                const h = inc(addr >> 8)
                this.bus.write(addr, this.Y & h)
                break
            }
            case "SHX": {
                const h = inc(addr >> 8)
                this.bus.write(addr, this.X & h)
                break
            }
            case "TAS": {
                const h = inc(addr >> 8)
                this.S = this.A & this.X
                this.bus.write(addr, this.S & h)
                break
            }
            case "LAS": {
                this.A = this.X = this.S = this.setNZ(this.bus.read(addr) & this.S)
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

    // tick returns false when CPU is halted
    tick(): boolean {
        if (this.halt) {
            return false
        }
        this.cycle++
        if (this.stallCount > 0) {
            this.stallCount--
            return true
        }

        if (this.debugCallback) {
            this.debugCallback(this.cpuStatus())
        }

        const instr = this.fetchInstruction()
        this.execute(instr)

        return true
    }

    setPCForTest(pc: uint16) {
        this.PC = pc
    }

    private debugCallback?: (c: CPUStatus) => void
    setDebugCallback(f: (c: CPUStatus) => void) {
        this.debugCallback = f
    }

    cpuStatus(): CPUStatus {
        return {
            pc: this.PC,
            a: this.A,
            x: this.X,
            y: this.Y,
            p: this.getP(),
            s: this.S,
            cyc: this.cycle,
        }
    }
}

export interface CPUStatus {
    pc: uint16
    a: uint8
    x: uint8
    y: uint8
    p: uint8
    s: uint8
    cyc: uint8
}

export class CPUBus {
    private CPURAM: Uint8Array // 2KB internal RAM
    private cartridge: Cartridge // Cartridge space

    constructor(cartridge: Cartridge) {
        this.CPURAM = new Uint8Array(0x800)
        this.cartridge = cartridge
    }

    read(pc: uint16): uint8 {
        checkUint16(pc)
        if (pc < 0x2000) {
            return this.CPURAM[pc % 0x800]
        } else if (pc < 0x4000) {
            // PPU
        } else if (pc < 0x4017) {
            // APU
        } else if (pc < 0x4020) {
            // CPU Test Mode
        } else {
            return this.cartridge.readCPU(pc)
        }
        return 0
    }
    read16(pc: uint16): uint16 {
        return this.read(pc) | this.read(pc + 1) << 8
    }
    read16Wrapping(pc: uint16): uint16 {
        let np = pc + 1
        if ((np >> 8) > (pc >> 8)) np -= 0x100
        return this.read(pc) | this.read(np) << 8
    }
    write(pc: uint16, x: uint8) {
        checkUint16(pc)
        if (pc < 0x2000) {
            this.CPURAM[pc % 0x800] = x
        } else if (pc < 0x4000) {
            // PPU
        } else if (pc < 0x4017) {
            // APU
        } else if (pc < 0x4020) {
            // CPU Test Mode
        } else {
            this.cartridge.writeCPU(pc, x)
        }
    }
}