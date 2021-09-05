import { assertInRange, assertUint8, uint16, uint8, uint8Reverse } from '../num'
import { NMI } from '../cpu/nmi'
import * as Color from './color'
import { Logger } from '../logger'
import { Mapper } from '../mappers/mapper'

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
- power up state https://wiki.nesdev.com/w/index.php/PPU_power_up_state
*/

// Display resolution
export const WIDTH = 256
export const HEIGHT = 240

// NTCS
export class PPU {
    // PPUCTRL $2000 > write
    // Various flags controlling PPU operation
    ctrlNMIEnable = 0 // cause NMI on VBlank
    ctrlSpriteHeight = 0 // Sprite size; 0:8x8, 1:8x16
    ctrlBackgroundTileSelect = 0 // Background pattern table address 0:$0000, 1: $1000
    ctrlSpriteTileSelect = 0 // Sprite pattern table address 0:$0000, 1: $1000
    ctrlIncrementMode = 0 // VRAM address increment per CPU read/write of PPUDATA (0: add 1, going across; 1: add 32, going down)

    private setCtrl(x: uint8) {
        const oldCtrlNMIEnable = this.ctrlNMIEnable

        this.ctrlNMIEnable = x >> 7 & 1
        this.ctrlSpriteHeight = x >> 5 & 1
        this.ctrlBackgroundTileSelect = x >> 4 & 1
        this.ctrlSpriteTileSelect = x >> 3 & 1
        this.ctrlIncrementMode = x >> 2 & 1

        this.internalT = this.internalT & ~(3 << 10) | ((x & 3) << 10)

        // If the PPU is currently in vertical blank, and the PPUSTATUS ($2002)
        // vblank flag is still set (1), changing the NMI flag in bit 7 of $2000
        // from 0 to 1 will immediately generate an NMI.
        if (this.vblank && (this.ctrlNMIEnable > oldCtrlNMIEnable)) {
            this.nmi.set()
        }

        if (this.ctrlNMIEnable !== oldCtrlNMIEnable) {
            this.logger?.log(`ctroNMIEnable <- ${this.ctrlNMIEnable}`)
        }
    }

    // PPUMASK $2001 > write
    colorEmphasis = 0 // Emphasize color BGR
    spriteEnable = 0 // 1: Show sprites
    backgroundEnable = 0 // 1: Show background
    spriteLeftColumnEnable = 0 // 1: Show sprites in leftmost 8 pixels of screen, 0: Hide
    backgroundLeftColumnEnable = 0 // 1: Show background in leftmost 8 pixels of screen, 0: Hide
    grayscale = 0 // Greyscale (0: normal color, 1: produce a greyscale display)

    private setMask(x: uint8) {
        assertUint8(x)

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
    private readStatus(): number {
        const res = this.vblank << 7 | this.spriteZeroHit << 6 | this.spriteOverflow << 5
        // Reading the status register will clear bit 7
        this.vblank = 0
        // And also the address latch used by PPUSCROLL and PPUADDR
        // https://wiki.nesdev.com/w/index.php/PPU_scrolling#.242002_read
        this.internalW = 0
        return res
    }

    // OAMADDR $2003 > write
    oamAddr: uint8 = 0

    // PPUSCROLL $2005 >> write x2
    // PPUADDR $2006 >> write x2
    // https://wiki.nesdev.com/w/index.php?title=PPU_scrolling
    // See internal*

    // PPUDATA $2007 <> read/write
    private setData(x: uint8) {
        // During rendering (on the pre-render line and the visible lines
        // 0-239, provided either background or sprite rendering is enabled),
        // it will update v in an odd way, ...
        if (this.renderingEnabled() && (this.scanline === 261 || this.scanline < HEIGHT)) {
            throw new Error(`Data write while rendering`)
        }
        this.bus.write(this.internalV & 0x3FFF, x)
        // Outside of rendering, reads from or writes to $2007 will add either
        // 1 or 32 to v depending on the VRAM increment bit set via $2000.
        this.incrementInternalV()
    }
    private readData(): uint8 {
        if (this.renderingEnabled() && (this.scanline === 261 || this.scanline < HEIGHT)) {
            throw new Error(`Data read while rendering`)
        }

        let res
        // When reading while the VRAM address is in the range 0-$3EFF (i.e.,
        // before the palettes), the read will return the contents of an
        // internal read buffer. This internal buffer is updated only when
        // reading PPUDATA, and so is preserved across frames. After the CPU
        // reads and gets the contents of the internal buffer, the PPU will
        // immediately update the internal buffer with the byte at the current
        // VRAM address. Thus, after setting the VRAM address, one should first
        // read this register to prime the pipeline and discard the result.
        if (this.internalV <= 0x3EFF) {
            res = this.internalReadBuffer
            this.internalReadBuffer = this.bus.read(this.internalV)
        } else {
            // Reading palette data from $3F00-$3FFF works differently. The
            // palette data is placed immediately on the data bus, and hence no
            // priming read is required. Reading the palettes still updates the
            // internal buffer though, but the data placed in it is the mirrored
            // nametable data that would appear "underneath" the palette.
            // (Checking the PPU memory map should make this clearer.)
            res = this.bus.read(this.internalV)
            this.internalReadBuffer = this.bus.read(this.internalV - 0x1000)
        }
        this.incrementInternalV()
        return res
    }
    private incrementInternalV() {
        this.internalV = (this.internalV + (this.ctrlIncrementMode ? 32 : 1)) & 0x7FFF
    }

    // PPU internal registers
    // https://wiki.nesdev.com/w/index.php/PPU_scrolling

    // yyy NN YYYYY XXXXX
    // ||| || ||||| +++++-- coarse X scroll
    // ||| || +++++-------- coarse Y scroll
    // ||| ++-------------- nametable select
    // +++----------------- fine Y scroll
    // current VRAM address (15 bits)
    private internalV = 0
    // Temporary VRAM address (15 bits); can also be thought of as the address
    // of the top left onscreen tile.
    private internalT = 0
    // Fine X scroll (3 bits)
    // This fine X value does not change during rendering.
    private internalX = 0
    // First or second write toggle (1 bit)
    private internalW = 0
    // 2 16-bit shift registers - These contain the pattern table data for two
    // tiles. Every 8 cycles, the data for the next tile is loaded into the
    // upper 8 bits of this shift register. Meanwhile, the pixel to render is
    // fetched from one of the lower 8 bits.
    private patternTableData = 0
    // 2 8-bit shift registers - These contain the palette attributes for the
    // lower 8 pixels of the 16-bit shift register. These registers are fed by a
    // latch which contains the palette attribute for the next tile. Every 8
    // cycles, the latch is loaded with the palette attribute for the next tile.
    private paletteAttributes = 0
    // 2-bit Palette Attribute for next tile
    private paletteAttributesNext = 0

    // The PPUDATA read buffer (post-fetch)
    private internalReadBuffer = 0

    bus: PPUBus

    scanline = 0 // [0,261]
    scanlineCycle = 0 // [0,340]
    frameCount = 0

    nmi: NMI

    logger?: Logger

    constructor(mapper: Mapper, nmi: NMI) {
        this.bus = new PPUBus(mapper)
        this.nmi = nmi
    }

    private updateIndices() {
        if (++this.scanlineCycle >= 341) {
            this.scanlineCycle = 0
            if (++this.scanline >= 262) {
                this.scanline = 0
                this.frameCount++

                const tmp = this.frontView
                this.frontView = this.backView
                this.backView = tmp
                const tmp2 = this.frontBuffer
                this.frontBuffer = this.backBuffer
                this.backBuffer = tmp2
            }
        }
    }

    // inc hori(v) in https://wiki.nesdev.com/w/images/d/d1/Ntsc_timing.png
    private coarseXIncrement() {
        if ((this.scanline <= 239 || this.scanline === 261) &&
            (this.scanlineCycle & 7) === 0 &&
            (this.scanlineCycle >= 8 && this.scanlineCycle <= 256 ||
                this.scanlineCycle >= 328 && this.scanlineCycle <= 336)) {
            // OK.
            // scanline: -1 ~ 239
            // tick: 8, 16, ..., 256, 328, 336
        } else {
            throw new Error(`inc hori(v) at (${this.scanline}, ${this.scanlineCycle})`)
        }
        // https://wiki.nesdev.com/w/index.php/PPU_scrolling#Wrapping_around
        // Coarse X increment
        if ((this.internalV & 0x001F) === 31) { // if coarse X == 31
            this.internalV &= ~0x001F          // coarse X = 0
            this.internalV ^= 0x0400           // switch horizontal nametable
        } else {
            this.internalV += 1                // increment coarse X
        }
    }

    // inc vert(v) in https://wiki.nesdev.com/w/images/d/d1/Ntsc_timing.png
    private yIncrement() {
        if ((this.scanline <= 239 || this.scanline === 261) &&
            (this.scanlineCycle === 256)) {
            // OK.
            // scanline: -1 ~ 239
            // tick: 256
        } else {
            throw new Error(`inc ver(v) at (${this.scanline}, ${this.scanlineCycle})`)
        }

        // https://wiki.nesdev.com/w/index.php/PPU_scrolling#Wrapping_around
        // Y increment
        if ((this.internalV & 0x7000) != 0x7000) {       // if fine Y < 7
            this.internalV += 0x1000                     // increment fine Y
        } else {
            this.internalV &= ~0x7000                    // fine Y = 0
            let y = (this.internalV & 0x03E0) >> 5       // let y = coarse Y
            if (y === 29) {
                y = 0                          // coarse Y = 0
                this.internalV ^= 0x0800       // switch vertical nametable
            } else if (y === 31) {
                y = 0                          // coarse Y = 0, nametable not switched
            } else {
                y += 1                         // increment coarse Y
            }
            this.internalV = (this.internalV & ~0x03E0) | (y << 5)     // put coarse Y back into v
        }
    }

    // either background or sprite rendering is enabled
    private renderingEnabled(): boolean {
        return !!(this.backgroundEnable || this.spriteEnable)
    }

    private patternByteLatch = 0
    private paletteAttributesNextLatch = 0

    // Tile and attribute fetching
    // https://wiki.nesdev.com/w/index.php/PPU_scrolling#At_dot_256_of_each_scanline
    //
    // NT byte, AT byte, Low BG tile byte, High BG tile byte in https://wiki.nesdev.com/w/images/d/d1/Ntsc_timing.png
    private fetchTileData() {
        const fineY = this.internalV >> 12
        // Name table address.
        const tileAddress = 0x2000 | (this.internalV & 0xFFF)
        const tileIndex = this.bus.mapper.readNametable(tileAddress)

        const patternByte0 = this.bus.mapper.readCHR(this.ctrlBackgroundTileSelect << 12 |
            tileIndex << 4 | 0 | fineY)
        const patternByte1 = this.bus.mapper.readCHR(this.ctrlBackgroundTileSelect << 12 |
            tileIndex << 4 | 8 | fineY) << 1

        this.patternByteLatch = 0
        for (let i = 0; i < 8; i++) {
            this.patternByteLatch |= ((patternByte0 >> i & 1) | (patternByte1 >> i & 2)) << ((7 - i) << 1)
        }

        // NN 1111 YYY XXX
        // || |||| ||| +++-- high 3 bits of coarse X (x/4)
        // || |||| +++------ high 3 bits of coarse Y (y/4)
        // || ++++---------- attribute offset (960 bytes)
        // ++--------------- nametable select
        const attributeAddress = 0x23C0 | (this.internalV & 0x0C00) |
            ((this.internalV >> 4) & 0b111000) | ((this.internalV >> 2) & 0b111)
        const attrByte = this.bus.mapper.readNametable(attributeAddress)

        // --- -- ---Y- ---X- -> YX0
        this.paletteAttributesNextLatch = attrByte >> ((this.internalV >> 4) & 4 | this.internalV & 2) & 3
    }
    private reloadShifters() {
        this.patternTableData |= this.patternByteLatch << 16
        this.paletteAttributesNext = this.paletteAttributesNextLatch
    }
    // Returns 0-63 or -1 (transparent).
    private fetchBackgroundColorIndex(): number {
        // Every cycle, a bit is fetched from the 4 background shift registers
        // in order to create a pixel on screen. Exactly which bit is fetched
        // depends on the fine X scroll, set by $2005 (this is how fine X
        // scrolling is possible). Afterwards, the shift registers are shifted
        // once, to the data for the next pixel.
        const bgPixel = (this.patternTableData >> (this.internalX << 1)) & 3
        const bgAttr = (this.paletteAttributes >> (this.internalX << 1)) & 3
        const bgColorIndex = bgPixel === 0 ? -1 : this.bus.backgroundPalettes[bgAttr * 3 + bgPixel - 1]

        this.patternTableData >>>= 2
        this.paletteAttributes = (this.paletteAttributes >> 2) | ((this.paletteAttributesNext & 3) << 14)
        return bgColorIndex
    }

    tickPPU(): void {
        this.updateIndices()

        // Scroll
        // See https://wiki.nesdev.com/w/images/d/d1/Ntsc_timing.png
        let bgColorIndex = -1
        if (this.renderingEnabled() && (this.scanline === 261 || this.scanline <= 239)) {
            // y in [0,239]  [261]

            // Event happen when x is in
            // 7, 8, 9,
            // 15, 16, 17,
            // ...
            // 247, 248, 249,
            // 255
            // 256, 257
            // 327, 328, 329
            // 335, 336, 337

            if (this.scanlineCycle === 256) {
                // If rendering is enabled, the PPU increments the vertical
                // position in v.
                this.yIncrement()
            } else if (this.scanlineCycle === 257) {
                // hori(v) = hori(t)
                const mask = 0b10000011111
                this.internalV &= ~mask
                this.internalV |= this.internalT & mask
            } else if ((this.scanlineCycle >= 327 ||
                this.scanlineCycle >= 1 && this.scanlineCycle <= 255)) {
                switch (this.scanlineCycle & 7) {
                    case 7:
                        // 327, 335, 7, 15, 23, ..., 247, 255
                        // The data fetched from these accesses is placed into internal
                        // latches, and then fed to the appropriate shift registers when
                        // it's time to do so (every 8 cycles). Because the PPU can only
                        // fetch an attribute byte every 8 cycles, each sequential
                        // string of 8 pixels is forced to have the same palette
                        // attribute.
                        this.fetchTileData()
                        break
                    case 0:
                        // 328, 336, 8, 16, 24, ..., 248
                        // If rendering is enabled, the PPU increments the
                        // horizontal position in v many times across the
                        // scanline.
                        // increment on tick 256 is not visible since hori(v) is
                        // reloaded right after (tick 257).
                        this.coarseXIncrement()
                        break
                    case 1:
                        // 329, 337, 9, 17, 25, ..., 249
                        this.reloadShifters()
                }
            }

            if (this.scanlineCycle >= 329 && this.scanlineCycle <= 336 ||
                this.scanlineCycle >= 1 && this.scanlineCycle <= 256) {
                // 329-336, 1-8, 9-17, ..., 249-256
                bgColorIndex = this.fetchBackgroundColorIndex()
            }
        }

        if (this.scanline < HEIGHT) { // Visible scanline (0-239)
            if (this.scanlineCycle === 261) {
                // Sprite evaluation does not happen on the pre-render scanline.
                // Because evaluation applies to the next line's sprite
                // rendering, no sprites will be rendered on the first scanline,
                // and this is why there is a 1 line offset on a sprite's Y
                // coordinate.
                this.spriteLine(this.scanline)
            }
            if (this.scanlineCycle >= 1 && this.scanlineCycle <= WIDTH) { // Cycles 1-256
                const x = (this.scanlineCycle - 1), y = this.scanline

                let colorIndex = -1
                if (this.backgroundEnable && (x >= 8 || this.backgroundLeftColumnEnable)) {
                    colorIndex = bgColorIndex
                }
                const spritePixel = this.spriteLineBuffer[x]
                if (this.spriteEnable && spritePixel >= 0) {
                    const spriteColorIndex = spritePixel & 63
                    const priority = (spritePixel >> 6) & 1
                    const spriteZero = (spritePixel >> 7) & 1

                    if (colorIndex !== -1 && spriteZero) {
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
            } else if (this.scanlineCycle >= 257 && this.scanlineCycle <= 320) {
                // TODO: cycle accurate OAM eveluation.
            } else if (this.scanlineCycle >= 337 && this.scanlineCycle <= 340) {
                // Two bytes are fetched, but the purpose for this is unknown.
            }
        } else if (this.scanline === HEIGHT) { // Post-render scanline (240)
            // The PPU just idles during this scanline. Even though accessing
            // PPU memory from the program would be safe here, the VBlank flag
            // isn't set until after this scanline.
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
            } else if (this.scanlineCycle >= 280 && this.scanlineCycle <= 304) {
                // If rendering is enabled, at the end of vblank, shortly after
                // the horizontal bits are copied from t to v at dot 257, the
                // PPU will repeatedly copy the vertical bits from t to v from
                // dots 280 to 304, completing the full initialization of v from t:
                if (this.renderingEnabled()) {
                    // vert(v) = vert(t)
                    const mask = 0b111101111100000
                    this.internalV &= ~mask
                    this.internalV |= this.internalT & mask
                }
            }
        }
    }

    private frontBuffer = new ArrayBuffer(WIDTH * HEIGHT * 4)
    private backBuffer = new ArrayBuffer(WIDTH * HEIGHT * 4)
    private frontView = new Uint32Array(this.frontBuffer)
    private backView = new Uint32Array(this.backBuffer)

    private putPixel(x: number, y: number, colorIndex: number) {
        const rgba = Color.get(colorIndex)
        const i = y * WIDTH + x
        this.backView[i] = rgba
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



    // get the value at the (x,y) position of the i-th tile in the pattern table.
    // the return value can be used for indexing a palette.
    // h specifies whether to use left(0) or right(1) pattern table.
    private patternValue(h: number, i: number, x: number, y: number): number {
        if (h < 0 || h > 1 || i < 0 || i >= 256 || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
            throw new Error("BUG: patternValue")
        }
        const upper = this.bus.mapper.readCHR(h << 12 | i << 4 | 8 | (y & 7))
        const lower = this.bus.mapper.readCHR(h << 12 | i << 4 | 0 | (y & 7))
        return (((upper >> (7 - (x & 7))) & 1) << 1) | ((lower >> (7 - (x & 7))) & 1)
    }

    render(ctx: CanvasRenderingContext2D): void {
        const img = new ImageData(this.buffer(), WIDTH, HEIGHT)
        ctx.putImageData(img, 0, 0)
    }
    buffer(): Uint8ClampedArray {
        return new Uint8ClampedArray(this.frontBuffer)
    }

    readCPU(pc: uint16): uint8 {
        if (this.internalV === undefined) {
            throw new Error(`this.internalV === undefined`)
        }
        switch (pc & 7) {
            case 0: return 0
            case 1: return 0
            case 2: {
                return this.readStatus()
            }
            case 3: return 0
            case 4: return this.bus.oam[this.oamAddr]
            case 5: return 0
            case 6: return 0
            case 7: return this.readData()
        }
        throw new Error('Impossible')
    }

    // writeCPU write x to the PPU register pc indicates.
    writeCPU(pc: uint16, x: uint8): void {
        assertUint8(x)
        if (pc < 0x2000 || pc > 0x3FFF) {
            throw new Error(`Out of range PPC.writeCPU(${pc}, ${x})`)
        }
        switch (pc & 7) {
            case 0: // $2000 write
                this.setCtrl(x)
                return
            case 1: // $2001
                this.setMask(x)
                return
            case 2: // status is read only
                return
            case 3: // $2003
                this.oamAddr = x
                return
            case 4:
                // For emulation purposes, it is probably best to completely
                // ignore writes during rendering.
                if (this.scanline === 261 || this.scanline < HEIGHT) {
                    return
                }
                this.bus.oam[this.oamAddr] = x
                this.oamAddr = (this.oamAddr + 1) & 0xFF
                return
            // OAMDATA
            case 5:
                if (this.internalW === 0) {
                    this.internalT = this.internalT & ~0b11111 | (x >> 3)
                    this.internalX = x & 0b111
                    this.internalW = 1
                } else {
                    this.internalT &= ~0b111001111100000
                    this.internalT |= (x & 0b111) << 12 | (x >> 3) << 5
                    this.internalW = 0
                }
                return
            // PPUADDR
            case 6:
                if (this.internalW === 0) {
                    this.internalT &= ~0x7F00
                    this.internalT |= (x & 0x3F) << 8
                    this.internalW = 1
                } else {
                    this.internalT &= ~0b11111111
                    this.internalT |= x
                    this.internalV = this.internalT
                    this.internalW = 0
                }
                return
            // PPUDATA
            case 7:
                this.setData(x)
                return
        }
        throw new Error(`Unsupported PPU.writeCPU(0x${pc.toString(16)}, ${x})`)
    }

    sendDMA(buf: Array<uint8>): void {
        // The DMA transfer will begin at the current OAM write address. It is
        // common practice to initialize it to 0 with a write to OAMADDR before
        // the DMA transfer. Different starting addresses can be used for a
        // simple OAM cycling technique, to alleviate sprite priority conflicts
        // by flickering. If using this technique, after the DMA OAMADDR should
        // be set to 0 before the end of vblank to prevent potential OAM
        // corruption (See: Errata). However, due to OAMADDR writes also having
        // a "corruption" effect[3] this technique is not recommended.
        for (let i = 0; i < 256; i++) {
            this.bus.oam[(i + this.oamAddr) & 0xFF] = buf[i]
        }
    }

    ////////////////////////////// Debug //////////////////////////////
    coarseX(): number {
        return this.internalV & 31
    }
    coarseY(): number {
        return this.internalV >> 5 & 31
    }
    nametableSelect(): number {
        return this.internalV >> 10 & 3
    }
    fineX(): number {
        return this.internalX
    }
    fineY(): number {
        return this.internalV >> 12
    }

    private renderNametableBuffer = new Uint8ClampedArray(HEIGHT * WIDTH * 4 * 4)
    renderNametable(canvas: HTMLCanvasElement): void {
        canvas.width = WIDTH * 2
        canvas.height = HEIGHT * 2

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            return
        }

        const cursorX = (this.nametableSelect() & 1) * WIDTH + this.coarseX() * 8 + this.fineX()
        const cursorY = (this.nametableSelect() >> 1) * HEIGHT + this.coarseY() * 8 + this.fineY()

        for (let h = 0; h < 4; h++) {
            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    const i = (x >> 3) | ((y >> 3) << 5)
                    const pt = this.bus.mapper.readNametable(0x2000 + h * 0x400 + i)
                    // const pt = this.bus.mapper.vram[(h << 10 | i) & (this.bus.mapper.vram.length - 1)]
                    const pi = this.patternValue(this.ctrlBackgroundTileSelect, pt, x, y)
                    assertInRange(pi, 0, 3)

                    let colorIndex
                    if (pi === 0) {
                        colorIndex = this.bus.universalBackgroundColor
                    } else {
                        const j = (y >> 5) << 3 | (x >> 5)
                        const b = this.bus.mapper.readNametable(0x2000 + h * 0x400 | (0x3C0 + j))
                        // const b = this.bus.mapper.vram[h << 10 | (0x3C0 + j)] & (this.bus.mapper.vram.length - 1)
                        const x2 = (x >> 4 & 1) << 1, y2 = (y >> 4 & 1) << 1
                        const at = b >> (y2 << 1 | x2) & 3

                        const ci = this.bus.backgroundPalettes[at * 3 + pi - 1]
                        colorIndex = ci
                    }

                    const color32 = Color.get(colorIndex)
                    let color = [color32 & 0xFF, color32 >> 8 & 0xFF, color32 >> 16 & 0xFF]

                    const x2 = x + (h & 1) * WIDTH
                    const y2 = y + (h >> 1) * HEIGHT

                    const dist = Math.abs(x2 - cursorX) + Math.abs(y2 - cursorY)
                    if (dist <= 1) {
                        color = [255, 0, 0] // red
                    }

                    for (let k = 0; k < 4; k++) {
                        this.renderNametableBuffer[(y2 * 2 * WIDTH + x2) * 4 + k] = k === 3 ? 255 : color[k]
                    }
                }
            }
        }
        const img = new ImageData(this.renderNametableBuffer, WIDTH * 2, HEIGHT * 2)
        ctx.putImageData(img, 0, 0)
    }

    getNametableTileInfo(i: number, j: number): {
        addr: number,
        nameTable: number,
        location: [number, number],
        tileIndex: number,
        tileAddr: number,
        attributeData: number,
        attributeAddr: number,
        paletteAddr: number,
    } {
        const nameTable = Math.floor(i / 32) + Math.floor(j / 30) * 2
        const location: [number, number] = [i % 32, j % 30]
        const addr = 0x2000 + nameTable * 0x400 + (location[0] + location[1] * 32)
        const tileIndex = this.bus.read(addr)
        const tileAddr = this.ctrlBackgroundTileSelect * 0x1000 + tileIndex * 16

        const attributeAddr = 0x2000 + nameTable * 0x400 + 960 + Math.floor(location[0] / 4) + Math.floor(location[1] / 4) * 8
        const attributeData = this.bus.read(attributeAddr)

        const [i2, j2] = [Math.floor((location[0] % 4 / 2)), Math.floor(location[1] % 4 / 2)]
        const paletteAddr = 0x3F01 + ((attributeData >> (i2 + j2 * 2) * 2) & 3) * 4

        return {
            addr,
            nameTable,
            location,
            tileIndex,
            tileAddr,
            attributeData,
            attributeAddr,
            paletteAddr,
        }
    }

    // render pattern table using predefined colors.
    renderCharacters(canvas: HTMLCanvasElement): void {
        const pixelSize = 2
        canvas.setAttribute('width', `${2 * 16 * 8 * pixelSize}`)
        canvas.setAttribute('height', `${16 * 8 * pixelSize}`)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            return
        }
        for (let h = 0; h < 2; h++) { // (0: "left"; 1: "right")
            for (let y = 0; y < 16; y++) { // tile row
                for (let x = 0; x < 16; x++) { // tile column
                    for (let r = 0; r < 8; r++) { // fine Y offset, the row number within a tile
                        const lowerBits = this.bus.mapper.readCHR(h << 12 | y << 8 | x << 4 | r)
                        const upperBits = this.bus.mapper.readCHR(h << 12 | y << 8 | x << 4 | 8 | r)
                        for (let c = 0; c < 8; c++) {
                            const colorIndex = (((upperBits >> 7 - c) & 1) << 1) | ((lowerBits >> 7 - c) & 1)
                            const gray = (3 - colorIndex) * 80
                            ctx.fillStyle = `rgb(${gray},${gray},${gray})`
                            ctx.fillRect((h * 16 * 8 + x * 8 + c) * pixelSize, (y * 8 + r) * pixelSize, pixelSize, pixelSize)
                        }
                    }
                }
            }
        }
    }

    static registerNames = new Map([
        [0x2000, "PPUCTRL"],
        [0x2001, "PPUMASK"],
        [0x2002, "PPUSTATUS"],
        [0x2003, "OAMADDR"],
        [0x2004, "OAMDATA"],
        [0x2005, "PPUSCROLL"],
        [0x2006, "PPUADDR"],
        [0x2007, "PPUDATA"],
        [0x4014, "OAMDMA"],
    ])
}

export type Palette = [uint8, uint8, uint8]

class PPUBus {
    mapper: Mapper

    // PPU palettes
    universalBackgroundColor = 9 // $3F00

    // (i * 3 + j)-th element contains palette[i]'s j-th color.
    backgroundPalettes = new Uint8Array([
        1, 0, 1,       // $3F01-$3F03
        2, 2, 0xD,     // $3F05-$3F07
        0x10, 8, 0x24, // $3F09-$3F0B
        0, 4, 0x2C     // $3F0D-$3F0F
    ])
    spritePalettes: Array<Palette> = [
        [1, 0x34, 3],    // $3F11-$3F13
        [4, 0, 0x14],    // $3F15-$3F17
        [0x3A, 0, 2],    // $3F19-$3F1B
        [0x20, 0x2C, 8], // $3F1D-$3F1F
    ]
    // $3F04, $3F08, $3F0C
    unusedData: Array<uint8> = [0, 8, 0]

    // The OAM (Object Attribute Memory) is internal memory inside the PPU that
    // contains a display list of up to 64 sprites, where each sprite's
    // information occupies 4 bytes.
    oam: Array<uint8> = new Array(256)

    constructor(mapper: Mapper) {
        this.mapper = mapper
        this.oam.fill(0)
    }
    // Read PPU memory map.
    read(pc: uint16): uint8 {
        assertInRange(pc, 0, 0x3FFF)
        if (pc <= 0x1FFF) {
            // Pattern table
            return this.mapper.readCHR(pc)
        } else if (pc <= 0x3EFF) {
            let i = pc
            if (i >= 0x3000) {
                i -= 0x1000
            }
            return this.mapper.readNametable(i)
        } else { // Palette RAM $3F00-$3F1F. Mirrors $3F20-$3FFF
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
            if ((k & 3) === 0) {// 4, 8, 12
                return this.unusedData[(k - 4) >> 2]
            }
            const i = k >> 2, j = (k & 3) - 1
            if (i < 4) {
                return this.backgroundPalettes[i * 3 + j]
            } else {
                return this.spritePalettes[i - 4][j]
            }
        }
    }
    write(pc: uint16, x: uint8) {
        assertInRange(pc, 0, 0x3FFF)
        assertUint8(x)
        if (pc <= 0x1FFF) { // Pattern tables $0000 - $1FFF
            this.mapper.writeCHR(pc, x)
            return
        } else if (pc <= 0x3EFF) { // Name tables $2000 - $2FFF. Mirrors $3000-$3EFF
            let i = pc
            if (i >= 0x3000) {
                i -= 0x1000
            }
            this.mapper.writeNametable(i, x)
            return
        } else { // Palette RAM $3F00-$3F1F. Mirrors $3F20-$3FFF
            let k = pc & 0x1F
            if (k === 0x10 || k === 0x14 || k === 0x18 || k === 0x1C) {
                k -= 0x10
            }
            // values in the NES palette: 6, 7 bits unimplemented, reads back as 0
            // https://wiki.nesdev.com/w/index.php?title=PPU_palettes
            if (k === 0) {
                this.universalBackgroundColor = x & 63
                return
            }
            if ((k & 3) === 0) {
                this.unusedData[(k - 4) >> 2] = x & 63
                return
            }
            const i = k >> 2
            if (i < 4) {
                this.backgroundPalettes[i * 3 + (k & 3) - 1] = x & 63
            } else {
                this.spritePalettes[i - 4][(k & 3) - 1] = x & 63
            }
        }
    }
}

export function to2DPalettes(palettes1D: Uint8Array): Array<Palette> {
    const p = palettes1D
    return [
        [p[0], p[1], p[2]],
        [p[3], p[4], p[5]],
        [p[6], p[7], p[8]],
        [p[9], p[10], p[11]],
    ]
}
