import { uint8, uint16, hasBit } from './num'

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
        let res = new Uint8Array(n)
        for (let i = 0; i < n; i++) res[i] = this.read()
        return res
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
    sc.expect(0x4E)
    sc.expect(0x45)
    sc.expect(0x53)
    sc.expect(0x1A)
    const prgROMSize = sc.read() * 16 * 1024
    const chrROMSize = sc.read() * 8 * 1024 // 0 means the board uses CHR RAM
    const flag6 = sc.read() // Mapper, mirroring, battery, trainer
    const flag7 = sc.read() // Mapper, VS/Playchoice, NES 2.0
    const flag8 = sc.read() // PRG-RAM size (rarely used extension)
    const flag9 = sc.read()
    const flag10 = sc.read()
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
    private trainer: Uint8Array
    readonly prgROM: Uint8Array
    readonly chrROM: Uint8Array
    private prgRAM: Uint8Array

    constructor(header: Header, trainer: Uint8Array, prgROM: Uint8Array, chrROM: Uint8Array, prgRAMSize: number) {
        this.header = header
        this.trainer = trainer
        this.prgROM = prgROM
        this.chrROM = chrROM
        this.prgRAM = new Uint8Array(prgRAMSize)
    }

    readCPU(pc: uint16): uint8 {
        if (pc < 0x6000) {
            return 0
        } else if (pc < 0x8000) {
            if (this.prgRAM.length) {
                return this.prgRAM[(pc - 0x6000) % this.prgRAM.length]
            }
            return 0
        } else {
            return this.prgROM[(pc - 0x8000) % this.prgROM.length]
        }
    }

    writeCPU(pc: uint16, x: uint8) {
        if (pc < 0x6000) {
            return
        } else if (pc < 0x8000) {
            if (this.prgRAM.length) {
                this.prgRAM[(pc - 0x8000) % this.prgRAM.length] = x
            }
            return
        } else {
            return
        }
    }

    static parseINES(data: Uint8Array) {
        const sc = new Scanner(data)
        const header = parseHeader(sc)

        const trainer = sc.readArray(header.hasTrainer ? 512 : 0)
        const prgROM = sc.readArray(header.prgROMSize)
        const chrROM = sc.readArray(header.chrROMSize)

        if (header.playChoice10) {
            throw new Error('PlayChoice is not supported')
        }

        const suppotedMappers = [0]
        if (!suppotedMappers.includes(header.mapper)) {
            throw new Error(`unsupported mapper ${header.mapper}`)
        }

        return new Cartridge(header, trainer, prgROM, chrROM, header.prgRAMSize)
    }
}
