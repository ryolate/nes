import { Cartridge } from './cartridge'
import * as fs from 'fs'

test("Parse iNES", () => {
    const data = fs.readFileSync("testdata/nestest.nes")

    const cartridge = Cartridge.parseINES(data)

    expect(cartridge.header.mapper).toBe(0)
    expect(cartridge.header.prgROMSize).toBe(16384)
    expect(cartridge.header.chrROMSize).toBe(8192)
})
