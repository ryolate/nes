import { Cartridge } from './cartridge'
import * as fs from 'fs'

test("Parse iNES", () => {
    const data = fs.readFileSync("testdata/nestest.nes")

    const mapper = Cartridge.parseINES(data)

    expect(mapper.cartridge.header.mapper).toBe(0)
    expect(mapper.cartridge.header.prgROMSize).toBe(16384)
    expect(mapper.cartridge.header.chrROMSize).toBe(8192)
})
