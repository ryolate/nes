import { Cartridge } from './cartridge'
import { CPU, CPUBus, CPUStatus } from './cpu'
import { Instruction } from './opcode'
import * as fs from 'fs'

const data = fs.readFileSync("testdata/nestest.nes")
const cartridge = Cartridge.parseINES(data)

test("Parse iNES", () => {
    const cpu = new CPU(new CPUBus(cartridge))

    cpu.setPCForTest(0xc000)

    const wants: Array<Instruction> = ["JMP", "RTS", "SEI", "CLD", "LDX"]
    for (const want of wants) {
        const got = cpu.fetchInstruction()
        expect(got.opcode).toBe(want)
    }
})


test("nestest", () => {
    const wantLog = parseNesTestLog()

    const bus = new CPUBus(cartridge)
    const cpu = new CPU(bus)

    cpu.setPCForTest(0xc000)
    {
        let i = 0
        cpu.setDebugCallback((got: CPUStatus) => {
            if (i >= wantLog.length) {
                return
            }
            const want = wantLog[i++]
            expect(state2Obj(got)).toEqual(state2Obj(want[0]))
        })
    }

    while (cpu.tick()) {
    }
})

function state2Obj(state: CPUStatus): Object {
    return {
        pc: state.pc.toString(16),
        a: state.a.toString(16),
        x: state.x.toString(16),
        y: state.y.toString(16),
        p: state.p.toString(16),
        s: state.s.toString(16),
        cyc: state.cyc
    }
}


function parseNesTestLog(): Array<[CPUStatus, string]> {
    // https://www.qmtpro.com/~nes/misc/nestest.log
    const data = fs.readFileSync("testdata/nestest.log")
    // 0         1         2         3         4         5         6         7         8         9
    // 0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890
    // C000  4C F5 C5  JMP $C5F5                       A:00 X:00 Y:00 P:24 SP:FD PPU:  0, 21 CYC:7
    const logs = String(data).split('\r\n')
    return logs.map((s): [CPUStatus, string] => {
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