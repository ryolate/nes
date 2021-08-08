/* eslint-disable @typescript-eslint/ban-types */
import { CPUStatus, CPUHaltError } from './cpu'
import { Instruction } from './opcode'
import * as fs from 'fs'
import { NES } from './nes'

const data = fs.readFileSync("testdata/nestest.nes")

test("Parse iNES", () => {
    const nes = new NES(data)
    const cpu = nes.cpu

    cpu.setPCForTest(0xc000)

    const wants: Array<Instruction> = ["JMP", "RTS", "SEI", "CLD", "LDX"]
    for (const want of wants) {
        const got = cpu.fetchInstruction()
        expect(got.opcode).toBe(want)
    }
})

const wantNESTestLog = parseNesTestLog()
test("nestest", () => {
    const nes = new NES(data)
    const cpu = nes.cpu
    cpu.setPCForTest(0xc000)

    let i = 0
    cpu.addDebugCallback(got => {
        if (i >= wantNESTestLog.length) {
            return
        }
        const want = wantNESTestLog[i++]
        expect(state2Obj(got)).toEqual(want[0])
    })

    try {
        for (; ;) {
            cpu.tick()
        }
    } catch (e) {
        expect(e).toBeInstanceOf(CPUHaltError)
    }
    expect(i).toBe(wantNESTestLog.length)
})

function state2Obj(state: CPUStatus): Object {
    return {
        pc: state.registers.pc,
        a: state.registers.a,
        x: state.registers.x,
        y: state.registers.y,
        p: state.registers.p,
        s: state.registers.s,
        cyc: state.cyc
    }
}

function parseNesTestLog(): Array<[Object, string]> {
    // https://www.qmtpro.com/~nes/misc/nestest.log
    const data = fs.readFileSync("testdata/nestest.log")
    // 0         1         2         3         4         5         6         7         8         9
    // 0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890
    // C000  4C F5 C5  JMP $C5F5                       A:00 X:00 Y:00 P:24 SP:FD PPU:  0, 21 CYC:7
    const logs = String(data).split('\r\n')
    return logs.map((s): [Object, string] => {
        return [{
            pc: parseInt(s.slice(0, 4), 16),
            a: parseInt(s.slice(50, 52), 16),
            x: parseInt(s.slice(55, 57), 16),
            y: parseInt(s.slice(60, 62), 16),
            p: parseInt(s.slice(65, 67), 16),
            s: parseInt(s.slice(71, 73), 16),
            cyc: parseInt(s.slice(90), 10),
        }, s]
    })
}
