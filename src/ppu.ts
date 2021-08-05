import { Cartridge } from './cartridge'
import { uint16, uint8 } from './num'

// Display resolution
const WIDTH = 256
const HEIGHT = 240

type Color = [uint8, uint8, uint8]

// NTCS
export class PPU {
    ctrlNMIEnable = 0 // cause NMI on VBlank
    ctrlPPUMaster = 1 // always 1
    ctrlSpriteHeight = 0 // Sprite size; 0:8x8, 1:8x16
    ctrlBackgroundTileSelect = 0 // Background pattern table address 0:$0000, 1: $1000
    ctrlSpriteTileSelect = 0 // Sprite pattern table address 0:$0000, 1: $1000
    ctrlIncrementMode = 0 // VRAM address increment per CPU read/write of PPUDATA (0: add 1, going across; 1: add 32, going down)
    ctrlNametableSelect = 0 // Base nametable address (0 = $2000; 1 = $2400; 2 = $2800; 3 = $2C00)

    private get ctrl(): uint8 {
        return this.ctrlNMIEnable << 7
            | this.ctrlPPUMaster << 6
            | this.ctrlSpriteHeight << 5
            | this.ctrlBackgroundTileSelect << 4
            | this.ctrlSpriteTileSelect << 3
            | this.ctrlIncrementMode << 2
            | this.ctrlNametableSelect
    }
    private set ctrl(x: uint8) {
        this.ctrlNMIEnable = x >> 7 & 1
        this.ctrlPPUMaster = x >> 6 & 1
        this.ctrlSpriteHeight = x >> 5 & 1
        this.ctrlBackgroundTileSelect = x >> 4 & 1
        this.ctrlSpriteTileSelect = x >> 3 & 1
        this.ctrlIncrementMode = x >> 2 & 1
        this.ctrlNametableSelect = x & 1
    }

    // PPUMask $2001
    colorEmphasis = 0 // BGR
    spriteEnable = 0
    backgroundEnable = 0
    spriteLeftColumnEnable = 0
    backgroundLeftColumnEnable = 0
    grayscale = 0

    private get mask(): uint8 {
        return this.colorEmphasis << 5
            | this.spriteEnable << 4
            | this.backgroundEnable << 3
            | this.spriteLeftColumnEnable << 2
            | this.backgroundLeftColumnEnable << 1
            | this.grayscale
    }
    private set mask(x: uint8) {
        this.colorEmphasis = x >> 5
        this.spriteEnable = x >> 4 & 1
        this.backgroundEnable = x >> 3 & 1
        this.spriteLeftColumnEnable = x >> 2 & 1
        this.backgroundLeftColumnEnable = x >> 1 & 1
        this.grayscale = x & 1
    }

    // Status $2002
    vblank = 0
    spriteZeroHit = 0
    spriteOverflow = 0
    private set status(x: uint8) {
        this.vblank = x >> 7
        this.spriteZeroHit = x >> 6 & 1
        this.spriteOverflow = x >> 5 & 1
    }

    oamAddr: uint8 = 0
    oamData: uint8 = 0
    scroll: uint8 = 0
    addr: uint16 = 0
    data: uint8 = 0
    oamDMA: uint8 = 0

    bus: PPUBus

    scanline: number = 0 // [0,262)
    scanlineCycle: number = 0 // [0,341)
    frameCount: number = 0

    constructor(cartridge: Cartridge) {
        this.bus = new PPUBus(cartridge)

        for (let i = 0; i < this.buffers.length; i++) {
            for (let j = 0; j < this.buffers[i].length; j += 4) {
                this.buffers[i][j + 3] = 255 // opaque
            }
        }
    }

    private buffers = [new Uint8ClampedArray(WIDTH * HEIGHT * 4), new Uint8ClampedArray(WIDTH * HEIGHT * 4)]
    private frontBufferIndex = 0
    tick() {
        this.scanlineCycle++
        if (this.scanlineCycle >= 341) {
            this.scanlineCycle = 0
            this.scanline++
        }
        if (this.scanline >= 262) {
            this.scanline = 0
            this.frameCount++

            this.frontBufferIndex = 1 - this.frontBufferIndex
        }

        if (this.scanline < HEIGHT && 1 <= this.scanlineCycle && this.scanlineCycle <= WIDTH) {
            const i = (this.scanline * WIDTH + (this.scanlineCycle - 1))
            const color = this.backgroundPixelColor(this.scanlineCycle - 1, this.scanline)

            this.buffers[1 - this.frontBufferIndex][i * 4 + 0] = color[0] // R
            this.buffers[1 - this.frontBufferIndex][i * 4 + 1] = color[1] // G
            this.buffers[1 - this.frontBufferIndex][i * 4 + 2] = color[2] // B
        }
    }

    colors: Array<Color> = [[240, 240, 240], [160, 160, 160], [80, 80, 80], [0, 0, 0]]
    private backgroundPixelColor(x: number, y: number): Color {
        const i = this.backgroundPixelColorIndex(x, y)
        return this.colors[i]
    }

    dejavu: Set<number> = new Set()
    // Pixel index at (x,y). Returns a number in range 0 to 3.
    private backgroundPixelColorIndex(x: number, y: number): number {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
            throw new Error(`Out of range (${x},${y})`)
        }
        // Compute the pattern index (which tile to select from pattern table)
        const i = (x >> 3) | ((y >> 3) << 5)
        const pt = this.bus.nametable[0][i] // pattern table index

        const upper = this.bus.cartridge.readPPU(pt << 4 | 8 | (y & 7))
        const lower = this.bus.cartridge.readPPU(pt << 4 | 0 | (y & 7))

        return (((upper >> (7 - (x & 7))) & 1) << 1) | ((lower >> (7 - (x & 7))) & 1)
    }

    render(ctx: CanvasRenderingContext2D) {
        const img = new ImageData(this.buffers[this.frontBufferIndex], WIDTH, HEIGHT)
        ctx.putImageData(img, 0, 0)
    }

    readCPU(pc: uint16): uint8 {
        switch (pc & 7) {
            case 0: return this.ctrl
            case 1: return this.mask
            case 2: return this.status
            case 3: return this.oamAddr
            case 4: return this.oamData
            case 5: return this.scroll
            case 6: return this.addr
            case 7: return this.data
        }
        throw new Error('Impossible')
    }
    // writeCPU write x to the PPU register pc indicates.
    // https://wiki.nesdev.com/w/index.php?title=PPU_registers
    writeCPU(pc: uint16, x: uint8) {
        if (pc < 0x2000 || pc > 0x3FFF) {
            throw new Error(`Out of range PPC.writeCPU(${pc}, ${x})`)
        }
        switch (pc) {
            case 0x2000:
                this.ctrl = pc
                return
            case 0x2001:
                this.mask = pc
                return
            case 0x2005:
                this.scroll = (this.scroll << 8 | x) & 0xFFFF
                return
            case 0x2006:
                this.addr = (this.addr << 8 | x) & 0xFFFF
                return
            case 0x2007:
                this.bus.write(this.addr, x)
                // After access, the video memory address will increment by an amount determined by bit 2 of $2000.
                if (this.ctrlIncrementMode === 0) {
                    this.addr += 1
                } else {
                    this.addr += 32
                }
                return
            default:
                throw new Error(`Unsupported PPU.writeCPU(0x${pc.toString(16)}, ${x})`)
        }
    }
}

class PPUBus {
    cartridge: Cartridge
    nametable = [new Uint8Array(0x400), new Uint8Array(0x400), new Uint8Array(0x400), new Uint8Array(0x400)]
    palettes = new Uint8Array(0x20)

    constructor(cartridge: Cartridge) {
        this.cartridge = cartridge
    }
    // Read PPU memory map.
    // https://wiki.nesdev.com/w/index.php/PPU_memory_map
    read(pc: uint16): uint8 {
        if (pc < 0x2000) {
            // Pattern table
            return this.cartridge.readPPU(pc)
        } else if (pc < 0x3F00) {
            // Nametable (VRAM)
            const res = this.nametable[pc / 0x400 & 3][pc & 0x3FF]
            return res
        } else {
            // Palette RAM
            return this.palettes[pc & 0x1F]
        }
    }
    write(pc: uint16, x: uint8) {
        if (pc < 0x2000) {
            return this.cartridge.writePPU(pc, x)
        } else if (pc < 0x3F00) {
            return this.nametable[pc / 0x400 & 3][pc & 0x3FF] = x
        } else {
            return this.palettes[pc & 0x1F] = x
        }
    }
}
