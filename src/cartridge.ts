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
    isEOF(): boolean {
        return this.data.length == this.p
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
    const flag9 = sc.read() // TV system (rarely used extension)
    const flag10 = sc.read() // TV system, PRG-RAM presence (unofficial, rarely used extension)
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

    // Pattern table $0000 - $1FFF
    // https://wiki.nesdev.com/w/index.php?title=PPU_memory_map
    readPPU(pc: uint16): uint8 {
        if (pc < 0 || pc >= 0x2000) {
            throw new Error(`Cartridge.readPPU(${pc})`)
        }
        return this.chrROM[pc & 0x1FFF]
    }
    writePPU(pc: uint16, x: uint8) {
        this.chrROM[pc & 0x1FFFF] = x
    }

    // parses INES data.
    //
    // Example:
    //     const data = fs.readFileSync("testdata/nestest.nes")
    //     const cartridge = Cartridge.parseINES(data)
    //
    // Reference: https://wiki.nesdev.com/w/index.php?title=INES
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
            throw new Error(`unsupported mapper ${header.mapper} `)
        }

        sc.assertEOF()

        return new Cartridge(header, trainer, prgROM, chrROM, header.prgRAMSize)
    }

    // render pattern table 0 (4K) using predefined colors.
    renderCharacters(canvas: HTMLCanvasElement) {
        const pixelSize = 2
        canvas.setAttribute('width', `${16 * 8 * pixelSize}`)
        canvas.setAttribute('height', `${16 * 8 * pixelSize}`)
        const ctx = canvas.getContext('2d')!
        for (let y = 0; y < 16; y++) { // tile row
            for (let x = 0; x < 16; x++) { // tile column
                const i = y << 8 | x << 4

                for (let r = 0; r < 8; r++) { // fine Y offset, the row number within a tile
                    const lowerBits = this.readPPU(i | r)
                    const upperBits = this.readPPU(i | 8 | r)
                    for (let c = 0; c < 8; c++) {
                        const colorIndex = (((upperBits >> 7 - c) & 1) << 1) | ((lowerBits >> 7 - c) & 1)

                        if (colorIndex < 0 || colorIndex > 3) {
                            throw new Error(`!!! ${colorIndex}`)
                        }

                        const gray = (3 - colorIndex) * 80
                        ctx.fillStyle = `rgb(${gray},${gray},${gray})`

                        ctx.fillRect((x * 8 + c) * pixelSize, (y * 8 + r) * pixelSize, pixelSize, pixelSize)
                    }
                }
            }
        }
    }
}
