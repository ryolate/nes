import { NES } from "./nes"
import { operation2str } from "./cpu"
import { Mapper } from "./mappers/mapper"

export const disasm = (mapper: Mapper): Array<[number, string]> => {
	const nes = new NES(mapper)

	const start = 0x8000
	const end = start + mapper.cartridge.prgROM.length

	const res: Array<[number, string]> = []
	nes.cpu.setPC(0x8000)
	while (start <= nes.cpu.getPC() && nes.cpu.getPC() < end) {
		const pc = nes.cpu.getPC()
		const op = nes.cpu.fetchInstruction()
		res.push([pc, operation2str(op)])
	}
	return res
}