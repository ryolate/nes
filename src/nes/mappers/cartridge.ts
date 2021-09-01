/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { uint8, hasBit, assertInRange, assertUint8 } from '../num'

/*
Reference:
- INES format https://wiki.nesdev.com/w/index.php?title=INES
- NROM (mapper 0) https://wiki.nesdev.com/w/index.php?title=INES_Mapper_000
*/
class Scanner {
    private p: number
    private data: Uint8Array

    constructor(data: Uint8Array) {
        this.p = 0
        this.data = data
    }

    read(): uint8 {
        return this.data[this.p++]
    }
    expect(x: uint8) {
        const got = this.read()
        if (got != x) {
            throw new Error(`data[${this.p - 1}] = ${got}, want ${x}`)
        }
    }
    readArray(n: number): Uint8Array {
        const res = new Uint8Array(n)
        for (let i = 0; i < n; i++) res[i] = this.read()
        return res
    }
    isEOF(): boolean {
        return this.data.length === this.p
    }
    assertEOF() {
        if (this.isEOF()) {
            return
        }
        throw new Error(`EOF is not reached data.length = ${this.data.length} p = ${this.p}`)
    }
}

interface Header {
    prgROMSize: number
    chrROMSize: number

    mirroring: boolean // 0: horizontal, 1: vertical
    hasBatteryPackedPRGRAM: boolean
    hasTrainer: boolean
    ignoreMirroring: boolean

    vsUnisystem: boolean
    playChoice10: boolean
    nes2format: boolean

    mapper: uint8

    prgRAMSize: number

    // Ignore flag9 and flag10; relatively few emulators honor it.
}

function parseHeader(sc: Scanner): Header {
    // 0-3: Constant $4E $45 $53 $1A ("NES" followed by MS-DOS end-of-file)
    sc.expect(0x4E)
    sc.expect(0x45)
    sc.expect(0x53)
    sc.expect(0x1A)
    const prgROMSize = sc.read() * 16 * 1024 // Size of PRG ROM in 16 KB units
    const chrROMSize = sc.read() * 8 * 1024 // Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
    const flag6 = sc.read() // Mapper, mirroring, battery, trainer
    const flag7 = sc.read() // Mapper, VS/Playchoice, NES 2.0
    const flag8 = sc.read() // PRG-RAM size (rarely used extension)
    sc.read() // TV system (rarely used extension)
    sc.read() // TV system, PRG-RAM presence (unofficial, rarely used extension)
    sc.read() // 11-15: Unused padding
    sc.read() // 12
    sc.read() // 13
    sc.read() // 14
    sc.read() // 15

    const mirroring = hasBit(flag6, 0)
    const hasBatteryPackedPRGRAM = hasBit(flag6, 1)
    const hasTrainer = hasBit(flag6, 2)
    const ignoreMirroring = hasBit(flag6, 3)
    const vsUnisystem = hasBit(flag7, 0)
    const playChoice10 = hasBit(flag7, 1)
    const nes2format = hasBit(flag7, 3) && (!hasBit(flag7, 2))
    const mapper = (flag7 & 0xF0) | (flag6 >> 4)
    const prgRAMSize = flag8

    if (nes2format) {
        throw new Error("NES 2.0 is not supported")
    }

    return {
        prgROMSize,
        chrROMSize,
        mirroring,
        hasBatteryPackedPRGRAM,
        hasTrainer,
        ignoreMirroring,
        vsUnisystem,
        playChoice10,
        nes2format,
        mapper,
        prgRAMSize,
    }
}

export class Cartridge {
    readonly header: Header
    readonly trainer: Uint8Array
    readonly prgROM: Uint8Array
    readonly prgRAM: Uint8Array
    private readonly chrROM: Uint8Array
    private readonly chrRAM: Uint8Array

    constructor(header: Header, trainer: Uint8Array, prgROM: Uint8Array, chrROM: Uint8Array, chrRAM: Uint8Array, prgRAMSize: number) {
        this.header = header
        this.trainer = trainer
        this.prgROM = prgROM
        this.prgRAM = new Uint8Array(prgRAMSize)
        this.chrROM = chrROM
        this.chrRAM = chrRAM
    }

    readCHR(pc: number): uint8 {
        if (this.chrROM.length) {
            assertInRange(pc, 0, this.chrROM.length)
            return this.chrROM[pc]
        } else {
            assertInRange(pc, 0, this.chrRAM.length)
            return this.chrRAM[pc]
        }
    }

    writeCHR(pc: number, x: uint8): void {
        assertUint8(x)
        if (this.header.chrROMSize) {
            return
        }
        assertInRange(pc, 0, this.chrRAM.length)
        this.chrRAM[pc] = x
    }

    // parses INES data.
    static parseINES(data: Uint8Array): Cartridge {
        const sc = new Scanner(data)
        const header = parseHeader(sc)

        const trainer = sc.readArray(header.hasTrainer ? 512 : 0)
        const prgROM = sc.readArray(header.prgROMSize)
        const chrROM = sc.readArray(header.chrROMSize)
        const chrRAM = header.chrROMSize ? new Uint8Array(0) : new Uint8Array(8 * 1024)

        if (header.playChoice10) {
            throw new Error('PlayChoice is not supported')
        }

        sc.assertEOF()

        return new Cartridge(header, trainer, prgROM, chrROM, chrRAM, header.prgRAMSize)
    }
}
