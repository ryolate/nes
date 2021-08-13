import { NES } from "./nes"
import { Cartridge } from "./cartridge"
import { operation2str } from "./cpu"

export const disasm = (cartridge: Cartridge): Array<[number, string]> => {
	const nes = new NES(cartridge)

	const start = 0x8000
	const end = start + cartridge.prgROM.length

	const res: Array<[number, string]> = []
	nes.cpu.setPC(0x8000)
	while (start <= nes.cpu.getPC() && nes.cpu.getPC() < end) {
		const pc = nes.cpu.getPC()
		const op = nes.cpu.fetchInstruction()
		res.push([pc, operation2str(op)])
	}
	return res
}