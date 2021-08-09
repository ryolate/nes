/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { uint8 } from "../num";

export type RGB = [uint8, uint8, uint8]

// 2C02 color pallete
// https://wiki.nesdev.com/w/index.php/PPU_palettes
const palette: Array<RGB> = (() => {
    const rawData = [
        84, 84, 84, 0, 30, 116, 8, 16, 144, 48, 0, 136, 68, 0, 100, 92, 0, 48, 84, 4, 0, 60, 24, 0, 32, 42, 0, 8, 58, 0, 0, 64, 0, 0, 60, 0, 0, 50, 60, 0, 0, 0,
        152, 150, 152, 8, 76, 196, 48, 50, 236, 92, 30, 228, 136, 20, 176, 160, 20, 100, 152, 34, 32, 120, 60, 0, 84, 90, 0, 40, 114, 0, 8, 124, 0, 0, 118, 40, 0, 102, 120, 0, 0, 0,
        236, 238, 236, 76, 154, 236, 120, 124, 236, 176, 98, 236, 228, 84, 236, 236, 88, 180, 236, 106, 100, 212, 136, 32, 160, 170, 0, 116, 196, 0, 76, 208, 32, 56, 204, 108, 56, 180, 204, 60, 60, 60,
        236, 238, 236, 168, 204, 236, 188, 188, 236, 212, 178, 236, 236, 174, 236, 236, 174, 212, 236, 180, 176, 228, 196, 144, 204, 210, 120, 180, 222, 120, 168, 226, 144, 152, 226, 180, 160, 214, 228, 160, 162, 160
    ]
    const res: Array<RGB> = []
    let i = 0
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 16; x++) {
            if (x < 14) {
                res.push([rawData[i++], rawData[i++], rawData[i++]])
            } else {
                res.push([0, 0, 0])
            }
        }
    }
    return res
})()

export const get = (index: number): RGB => {
    return palette[index]
}

export const render = (canvas: HTMLCanvasElement): void => {
    const sz = 15
    canvas.width = 16 * sz
    canvas.height = 4 * sz
    const ctx = canvas.getContext('2d')!
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 4; y++) {
            const [r, g, b] = palette[y * 16 | x]
            ctx.fillStyle = `rgb(${r},${g},${b})`
            ctx.fillRect(x * sz, y * sz, sz, sz)
        }
    }
}

const sameColor = (c1: RGB, c2: RGB): boolean => {
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2]
}

export function indexOf(c: RGB): number {
    for (let i = 0; i < 64; i++) {
        if (sameColor(c, palette[i])) {
            return i
        }
    }
    throw new Error(`Unknown color ${c}`)
}
