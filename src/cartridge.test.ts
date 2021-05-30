import { Cartridge } from './cartridge'
import * as fs from 'fs'

test("Parse iNES", () => {
    const data = fs.readFileSync("testdata/nestest.nes")

    const c = Cartridge.parseINES(data)

    expect(c.header.mapper).toBe(0)
    expect(c.header.prgROMSize).toBe(16384)
    expect(c.header.chrROMSize).toBe(8192)
})
