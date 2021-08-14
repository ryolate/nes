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

export function checkUint16(x: uint16): void {
    if (x < 0 || x > UINT16_MAX) {
        throw new Error(`${x} is not in uint16 range`)
    }
}

export function checkUint8(x: uint8): void {
    if (x < 0 || x > UINT8_MAX) {
        throw new Error(`${x} is not in uint8 range`)
    }
}

export const assertUint8 = (x: number): void => {
    if (0 <= x && x <= UINT8_MAX) {
        return
    }
    throw new Error(`${x} not uint8`)
}

export const assertUint16 = (x: number): void => {
    if (0 <= x && x <= UINT16_MAX) {
        return
    }
    throw new Error(`${x} not uint16`)
}
