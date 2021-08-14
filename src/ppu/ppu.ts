import { Cartridge } from '../cartridge'
import { uint16, UINT16_MAX, uint8 } from '../num'
import { NMI } from '../nmi'
import * as Color from './color'
import { Logger } from '../logger'

/*
Reference:
- registers https://wiki.nesdev.com/w/index.php?title=PPU_registers
- memory map https://wiki.nesdev.com/w/index.php?title=CPU_memory_map
- pattern tables https://wiki.nesdev.com/w/index.php?title=PPU_pattern_tables
- palettes https://wiki.nesdev.com/w/index.php?title=PPU_palettes
- name tables https://wiki.nesdev.com/w/index.php?title=PPU_nametables
- attribute tables https://wiki.nesdev.com/w/index.php?title=PPU_attribute_tables
- OAM https://wiki.nesdev.com/w/index.php?title=PPU_OAM
- NMI https://wiki.nesdev.com/w/index.php?title=NMI
- rendering https://wiki.nesdev.com/w/index.php?title=PPU_rendering
- scrolling https://wiki.nesdev.com/w/index.php?title=PPU_scrolling
*/

// Display resolution
export const WIDTH = 256
export const HEIGHT = 240

// NTCS
export class PPU {
    // PPUCTRL $2000 > write
    // Various flags controlling PPU operation
    ctrlNMIEnable = 0 // cause NMI on VBlank
    ctrlPPUMaster = 1 // always 1
    ctrlSpriteHeight = 0 // Sprite size; 0:8x8, 1:8x16
    ctrlBackgroundTileSelect = 0 // Background pattern table address 0:$0000, 1: $1000
    ctrlSpriteTileSelect = 0 // Sprite pattern table address 0:$0000, 1: $1000
    ctrlIncrementMode = 0 // VRAM address increment per CPU read/write of PPUDATA (0: add 1, going across; 1: add 32, going down)
    ctrlNametableSelect = 0 // Base nametable address (0 = $2000; 1 = $2400; 2 = $2800; 3 = $2C00)

    private set ctrl(x: uint8) {
        this.ctrlNMIEnable = x >> 7 & 1
        this.ctrlPPUMaster = x >> 6 & 1
        this.ctrlSpriteHeight = x >> 5 & 1
        this.ctrlBackgroundTileSelect = x >> 4 & 1
        this.ctrlSpriteTileSelect = x >> 3 & 1
        this.ctrlIncrementMode = x >> 2 & 1
        this.ctrlNametableSelect = x & 3
    }

    // PPUMASK $2001 > write
    colorEmphasis = 0 // Emphasize color BGR
    spriteEnable = 0 // 1: Show sprites
    backgroundEnable = 0 // 1: Show background
    spriteLeftColumnEnable = 0 // 1: Show sprites in leftmost 8 pixels of screen, 0: Hide
    backgroundLeftColumnEnable = 0 // 1: Show background in leftmost 8 pixels of screen, 0: Hide
    grayscale = 0 // Greyscale (0: normal color, 1: produce a greyscale display)

    private set mask(x: uint8) {
        this.colorEmphasis = x >> 5
        this.spriteEnable = x >> 4 & 1
        this.backgroundEnable = x >> 3 & 1
        this.spriteLeftColumnEnable = x >> 2 & 1
        this.backgroundLeftColumnEnable = x >> 1 & 1
        this.grayscale = x & 1

        if (this.colorEmphasis) throw new Error('Unimplemented colorEmphasis')
        if (this.grayscale) throw new Error('Unimplemented grayscale')
    }

    // PPUSTATUS $2002 < read
    vblank = 0 // Vertical blank has started (0: not in vblank; 1: in vblank).
    spriteZeroHit = 0 // Sprite 0 Hit.
    spriteOverflow = 0 // Sprite overflow.
    private get status(): number {
        const res = this.vblank << 7 | this.spriteZeroHit << 6 | this.spriteOverflow << 5
        this.vblank = 0
        return res
    }

    // OAMADDR $2003 > write
    oamAddr: uint8 = 0

    // OAMDATA $2004 <> read/write
    oamData: uint8 = 0

    // PPUSCROLL $2005 >> write x2
    // https://wiki.nesdev.com/w/index.php?title=PPU_scrolling
    scrollX: uint8 = 0
    scrollY: uint8 = 0

    // PPUADDR $2006 >> write x2
    addr: uint16 = 0

    // PPUDATA $2007 <> read/write
    _data: uint8 = 0
    private set data(x: uint8) {
        // FIXME.
        // VRAM read/write data register. After access, the video memory address
        // will increment by an amount determined by ctrlIncrementMode.
        // 


        this._data = x
        if (x > 0) throw new Error('Unimplemented data')
    }
    private get data() {
        return this._data
    }

    // PPU internal registers
    // https://wiki.nesdev.com/w/index.php/PPU_scrolling
    // current VRAM address (15 bits)
    private internalV = 0
    // Temporary VRAM address (15 bits); can also be thought of as the address
    // of the top left onscreen tile.
    private internalT = 0
    // Fine X scroll (3 bits)
    private internalX = 0
    // First or second write toggle (1 bit)
    private internalW = 0

    bus: PPUBus

    scanline = 0 // [0,261]
    scanlineCycle = 0 // [0,340]
    frameCount = 0

    nmi: NMI

    logger?: Logger

    constructor(cartridge: Cartridge, nmi: NMI) {
        this.bus = new PPUBus(cartridge)
        this.nmi = nmi

        for (let i = 0; i < this.buffers.length; i++) {
            for (let j = 0; j < this.buffers[i].length; j += 4) {
                this.buffers[i][j + 3] = 255 // opaque
            }
        }
    }

    private updateIndices() {
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
    }

    tick(): void {
        this.updateIndices()

        if (this.scanline < HEIGHT) { // Visible scanline (0-239)
            // TODO: make sprite line evaluation cycle accurate.
            if (this.scanlineCycle === 261) {
                // Sprite evaluation does not happen on the pre-render scanline.
                // Because evaluation applies to the next line's sprite
                // rendering, no sprites will be rendered on the first scanline,
                // and this is why there is a 1 line offset on a sprite's Y
                // coordinate.
                this.spriteLine(this.scanline)
            }
            if (1 <= this.scanlineCycle && this.scanlineCycle <= WIDTH) { // Cycles 1-256
                const x = (this.scanlineCycle - 1), y = this.scanline

                let colorIndex = -1
                if (this.backgroundEnable && (x >= 8 || this.backgroundLeftColumnEnable)) {
                    const bgColorIndex = this.backgroundPixelColorIndex(x + this.scrollX, y + this.scrollY)
                    colorIndex = bgColorIndex
                }
                const spritePixel = this.spriteLineBuffer[x]
                if (this.spriteEnable && spritePixel >= 0) {
                    const spriteColorIndex = spritePixel & 63
                    const priority = (spritePixel >> 6) & 1
                    const spriteZero = (spritePixel >> 7) & 1

                    if (colorIndex >= 0 && spriteZero) {
                        this.spriteZeroHit = 1
                    }
                    if (priority === 0 || colorIndex === -1) {
                        colorIndex = spriteColorIndex
                    }
                }
                if (colorIndex === -1) {
                    colorIndex = this.bus.universalBackgroundColor
                }
                this.putPixel(x, y, colorIndex)
            }
        } else if (this.scanline === HEIGHT) { // Post-render scanline (240)
        } else if (this.scanline <= 260) { // Vertical blanking lines (241-260)
            // The VBlank flag of the PPU is set at tick 1 (the second tick) of
            // scanline 241, where the VBlank NMI also occurs.
            if (this.scanline === 241 && this.scanlineCycle === 1) {
                this.vblank = 1
                if (this.ctrlNMIEnable) {
                    this.nmi.set()
                }
            }
        } else { // Pre-render scanline (-1 or 261)
            if (this.scanlineCycle === 1) {
                // https://wiki.nesdev.com/w/index.php?title=PPU_registers#Status_.28.242002.29_.3C_read
                // cleared at dot 1 (the second dot) of the pre-render line.
                this.spriteOverflow = 0
                this.spriteZeroHit = 0
                this.vblank = 0
            }
        }
    }

    private buffers = [new Uint8ClampedArray(WIDTH * HEIGHT * 4), new Uint8ClampedArray(WIDTH * HEIGHT * 4)]
    private frontBufferIndex = 0
    private putPixel(x: number, y: number, colorIndex: number) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || colorIndex < 0 || colorIndex >= 64) {
            throw new Error(`BUG`)
        }
        const c = Color.get(colorIndex)
        const i = y * WIDTH + x
        this.buffers[1 - this.frontBufferIndex][i * 4 + 0] = c[0] // R
        this.buffers[1 - this.frontBufferIndex][i * 4 + 1] = c[1] // G
        this.buffers[1 - this.frontBufferIndex][i * 4 + 2] = c[2] // B
    }

    // Holds the result of spriteLine.
    // Stores color index 0-63, or -1 for no pixel.
    // If pixel exists the bit 64 (1<<6) represents its priority.
    // If the pixel is from sprite 0, the bit 128 (1<<7) is set for sprite zero hit detection.
    private spriteLineBuffer = new Array(WIDTH)
    // Computes sprite pixels for scanline and stores the result to spriteLineBuffer.
    //
    // References
    // - https://wiki.nesdev.com/w/index.php?title=PPU_sprite_evaluation
    // - https://wiki.nesdev.com/w/index.php/PPU_sprite_priority
    private spriteLine(scanline: number) {
        this.spriteLineBuffer.fill(-1)
        // Find 8 sprites.
        const ids = []
        const spriteHeight = this.ctrlSpriteHeight ? 16 : 8
        for (let i = 0; i < 256; i += 4) { // 64 sprites
            const y = this.bus.oam[i]
            if (scanline < y || scanline >= y + spriteHeight) {
                continue
            }
            if (ids.length === 8) {
                this.spriteOverflow = 1
                break
            }
            ids.push(i)
        }

        for (const i of ids) {
            const y = this.bus.oam[i] // Y position of top of sprite

            // For 8x8 sprites, this is the tile number of this sprite within
            // the pattern table selected in bit 3 of PPUCTRL ($2000).
            // For 8x16 sprites, the PPU ignores the pattern table selection and
            // selects a pattern table from bit 0 of this number.
            //
            // 76543210
            // ||||||||
            // |||||||+- Bank ($0000 or $1000) of tiles
            // +++++++-- Tile number of top of sprite (0 to 254; bottom half gets the next tile)
            const tileIndexNumber = this.bus.oam[i + 1]

            const attributes = this.bus.oam[i + 2]
            const pi = attributes & 3 // Palette (4 to 7) of sprite
            // 2,3,4 unimplemented
            const priority = attributes >> 5 & 1 // Priority (0: in front of background; 1: behind background)
            const flipHorizontally = attributes >> 6 & 1 // Flip sprite horizontally
            const flipVertically = attributes >> 7 & 1 // Flip sprite vertically

            const x = this.bus.oam[i + 3] // X position of left side of sprite

            const palette = this.bus.spritePalettes[pi]
            for (let xi = 0; xi < 8; xi++) {
                if (x + xi < 8 && !this.spriteLeftColumnEnable || x + xi >= WIDTH || this.spriteLineBuffer[x + xi] >= 0) {
                    continue
                }
                const yi = scanline - y

                const xi2 = flipHorizontally ? 7 - xi : xi
                const yi2 = flipVertically ? spriteHeight - 1 - yi : yi

                let pv
                if (this.ctrlSpriteHeight === 0) {
                    pv = this.patternValue(this.ctrlSpriteTileSelect, tileIndexNumber, xi2, yi2)
                } else {
                    const h = tileIndexNumber & 1
                    const ti = yi2 < 8 ? (tileIndexNumber & ~1) : (tileIndexNumber | 1)
                    pv = this.patternValue(h, ti, xi2, yi2 & 7)
                }

                if (pv === 0) {
                    continue
                }
                const ci = palette[pv - 1]
                this.spriteLineBuffer[x + xi] = ci | priority << 6 | (i === 0 ? 1 : 0) << 7
            }
        }
    }

    // Returns color index 0-63, or -1 if transparent.
    // Use Color.get for the result to get the actual color.
    private backgroundPixelColorIndex(x: number, y: number): number {
        // Compute which background palete to use from the attribute table.
        // https://wiki.nesdev.com/w/index.php?title=PPU_attribute_tables

        let nametableId = this.ctrlNametableSelect
        if (x >= WIDTH) {
            x -= WIDTH
            nametableId = (nametableId ^ 1)
        }
        if (y >= HEIGHT) {
            y -= HEIGHT
            nametableId = (nametableId ^ 2)
        }

        // Each byte controls the palette of a 32×32 pixel.
        const i = (y >> 5) << 3 | (x >> 5)
        const b = this.bus.nametable[nametableId][0x3C0 + i]
        const x2 = (x >> 4 & 1) << 1, y2 = (y >> 4 & 1) << 1
        const at = b >> (y2 << 1 | x2) & 3

        // Compute which color to use in the palette.
        const pi = this.backgroundPixelPaletteIndex(x, y)
        if (pi === 0) {
            return -1
        }
        const ci = this.bus.backgroundPalettes[at][pi - 1]
        return ci
    }

    // Compute the pattern index 0-3.
    private backgroundPixelPaletteIndex(x: number, y: number): number {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
            throw new Error(`Out of range (${x},${y})`)
        }

        // Compute the pattern index (which tile to select from pattern table)
        const i = (x >> 3) | ((y >> 3) << 5)
        // pattern table index
        const pt = this.bus.nametable[this.ctrlNametableSelect][i]

        // read pattern table
        return this.patternValue(this.ctrlBackgroundTileSelect, pt, x, y)
    }

    // get the value at the (x,y) position of the i-th tile in the pattern table.
    // the return value can be used for indexing a palette.
    // h specifies whether to use left(0) or right(1) pattern table.
    private patternValue(h: number, i: number, x: number, y: number): number {
        if (h < 0 || h > 1 || i < 0 || i >= 256 || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
            throw new Error("BUG: patternValue")
        }
        const upper = this.bus.cartridge.readPPU(h << 12 | i << 4 | 8 | (y & 7))
        const lower = this.bus.cartridge.readPPU(h << 12 | i << 4 | 0 | (y & 7))
        return (((upper >> (7 - (x & 7))) & 1) << 1) | ((lower >> (7 - (x & 7))) & 1)
    }

    render(ctx: CanvasRenderingContext2D): void {
        const img = new ImageData(this.buffers[this.frontBufferIndex], WIDTH, HEIGHT)
        ctx.putImageData(img, 0, 0)
    }
    buffer(): Uint8ClampedArray {
        return this.buffers[this.frontBufferIndex]
    }

    readCPU(pc: uint16): uint8 {
        if (this.data === undefined) {
            throw new Error(`this.data === undefined`)
        }
        switch (pc & 7) {
            case 0: return 0
            case 1: return 0
            case 2: return this.status
            case 3: return 0
            case 4: return this.oamData
            case 5: return 0
            case 6: return 0
            case 7: return this.data
        }
        throw new Error('Impossible')
    }

    // writeCPU write x to the PPU register pc indicates.
    writeCPU(pc: uint16, x: uint8): void {
        if (pc < 0x2000 || pc > 0x3FFF) {
            throw new Error(`Out of range PPC.writeCPU(${pc}, ${x})`)
        }
        switch (pc & 7) {
            case 0:
                this.ctrl = x
                return
            case 1:
                this.mask = x
                return
            case 2: // status is read only
                return
            case 3:
                this.oamAddr = x
                this.logger?.log(`OAMADDR <- $${this.oamAddr.toString(16)}`)
                return
            case 4:
                // For emulation purposes, it is probably best to completely
                // ignore writes during rendering.
                if (this.scanline === 261 || this.scanline < HEIGHT) {
                    return
                }
                this.bus.write(this.oamData, x)
                this.oamAddr++
                this.logger?.log(`OAMADDR(++) <- $${this.oamAddr.toString(16)}`)
                return
            // OAMDATA
            case 5:
                this.scrollX = this.scrollY
                this.scrollY = x
                return
            case 6:
                this.addr = (this.addr << 8 | x) & 0xFFFF
                return
            case 7:
                this.bus.write(this.addr, x)
                // After access, the video memory address will increment by an
                // amount determined by bit 2 of $2000.
                if (this.ctrlIncrementMode === 0) {
                    this.addr += 1
                } else {
                    this.addr += 32
                }
                this.addr &= UINT16_MAX
                return
        }
        throw new Error(`Unsupported PPU.writeCPU(0x${pc.toString(16)}, ${x})`)
    }

    sendDMA(buf: Array<uint8>): void {
        this.logger?.log("OAM <- " + buf.toString())
        for (let i = 0; i < 256; i++) {
            this.bus.oam[i] = buf[i]
        }
    }

    ////////////////////////////// Debug //////////////////////////////
    drawAllNametables(canvas: HTMLCanvasElement): void {
        canvas.width = WIDTH * 2
        canvas.height = HEIGHT * 2
        const ctx = canvas.getContext('2d')

    }
}

export type Palette = [uint8, uint8, uint8]

const newPalette = (): Palette => { return [0, 0, 0] }

class PPUBus {
    cartridge: Cartridge
    // nametable $2000 - $3EFF
    nametable = [new Uint8Array(0x400), new Uint8Array(0x400), new Uint8Array(0x400), new Uint8Array(0x400)]

    // PPU palettes
    universalBackgroundColor = 0
    backgroundPalettes: Array<Palette> = [0, 0, 0, 0].map(() => {
        return newPalette()
    })
    spritePalettes: Array<Palette> = [0, 0, 0, 0].map(() => {
        return newPalette()
    })

    // The OAM (Object Attribute Memory) is internal memory inside the PPU that
    // contains a display list of up to 64 sprites, where each sprite's
    // information occupies 4 bytes.
    oam: Array<uint8> = new Array(256)

    constructor(cartridge: Cartridge) {
        this.cartridge = cartridge
        this.oam.fill(0)
    }
    // Read PPU memory map.
    read(pc: uint16): uint8 {
        if (pc < 0x2000) {
            // Pattern table
            return this.cartridge.readPPU(pc)
        } else if (pc < 0x3F00) {
            // Nametable (VRAM)
            return this.nametable[pc / 0x400 & 3][pc & 0x3FF]
        } else {
            let k = pc & 0x1F
            // Palette RAM

            // Addresses $3F10 / $3F14 / $3F18 / $3F1C are
            // mirrors of $3F00 / $3F04 / $3F08 / $3F0C
            if (k === 0x10 || k === 0x14 || k === 0x18 || k === 0x1C) {
                k -= 0x10
            }
            if (k === 0) {
                return this.universalBackgroundColor
            }
            const i = k >> 2, j = k & 3
            if (i < 4) {
                return this.backgroundPalettes[i][j]
            } else {
                return this.spritePalettes[i - 4][j]
            }
        }
    }
    write(pc: uint16, x: uint8) {
        if (pc < 0x2000) { // Pattern tables $0000 - $1FFF
            this.cartridge.writePPU(pc, x)
            return
        } else if (pc < 0x3F00) { // Name tables $2000 - $2FFF. Mirrors $3000-$3EFF
            this.nametable[pc / 0x400 & 3][pc & 0x3FF] = x
            return
        } else { // Palette RAM $3F00-$3F1F. Mirrors $3F20-$3FFF
            let k = pc & 0x1F
            if (k === 0x10 || k === 0x14 || k === 0x18 || k === 0x1C) {
                k -= 0x10
            }
            if (k === 0) {
                this.universalBackgroundColor = x
                return
            }
            const i = k >> 2
            if (i < 4) {
                this.backgroundPalettes[i][(k & 3) - 1] = x
            } else {
                this.spritePalettes[i - 4][(k & 3) - 1] = x
            }
        }
    }
}
