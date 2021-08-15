export type uint8 = number
export type uint16 = number

export const UINT8_MAX = (1 << 8) - 1
export const UINT16_MAX = (1 << 16) - 1

export function hasBit(x: uint8, i: number): boolean {
    return ((x >> i) & 1) == 1
}

export function uint8ToSigned(x: uint8): number {
    if (hasBit(x, 7)) {
        return -((x ^ UINT8_MAX) + 1)
    }
    return x
}

export const assertUint8 = (x: number, f?: () => void): void => {
    if (0 <= x && x <= UINT8_MAX) {
        return
    }
    if (f) {
        f()
    }
    throw new Error(`${x} not uint8`)
}

export const assertUint16 = (x: number): void => {
    if (0 <= x && x <= UINT16_MAX) {
        return
    }
    throw new Error(`${x} not uint16`)
}

export const assertInRange = (x: number, minimum: number, maximum: number): void => {
    if (minimum <= x && x <= maximum) {
        return
    }
    throw new Error(`$${x.toString(16)} not in range [$${minimum.toString(16)}, $${maximum.toString(16)}]`)
}

export const uint8Reverse = (x: uint8): uint8 => {
    let res = 0
    for (let i = 0; i < 8; i++) {
        res |= (x >> i & 1) << 7 - i
    }
    return res
}
