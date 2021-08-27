import { uint16, uint8 } from "../nes/num";
import { Cartridge } from "./cartridge";
import { Mapper, MapperState } from "./mapper";

// https://wiki.nesdev.com/w/index.php?title=NROM
export class Mapper0 implements Mapper {
	readonly cartridge: Cartridge
	readonly vram = new Uint8Array(0x800) // 2KB nametable
	constructor(cartridge: Cartridge) {
		this.cartridge = cartridge
	}

	readCPU(pc: uint16): uint8 {
		if (pc < 0x4020) {
			throw new Error(`Outside cartridge space ${pc.toString(16)}`)
		}
		if (pc < 0x6000) {
			return 0
		} else if (pc < 0x8000) {
			if (this.cartridge.prgRAM.length) {
				return this.cartridge.prgRAM[(pc - 0x6000) % this.cartridge.prgRAM.length]
			}
			return 0
		} else {
			return this.cartridge.prgROM[(pc - 0x8000) % this.cartridge.prgROM.length]
		}
	}

	writeCPU(pc: uint16, x: uint8): void {
		if (pc < 0x4020) {
			throw new Error(`Outside cartridge space ${pc.toString(16)}`)
		}
		if (pc < 0x6000) {
			return
		} else if (pc < 0x8000) {
			// Family Basic only: PRG RAM, mirrored as necessary to fill entire
			// 8 KiB window, write protectable with an external switch
			if (this.cartridge.prgRAM.length) {
				this.cartridge.prgRAM[(pc - 0x8000) % this.cartridge.prgRAM.length] = x
			}
			return
		} else {
			// ROM Space
			return
		}
	}
	// Pattern table $0000 - $1FFF
	// https://wiki.nesdev.com/w/index.php?title=PPU_memory_map
	readCHR(pc: uint16): uint8 {
		if (pc < 0 || pc >= 0x2000) {
			throw new Error(`Cartridge.readPPU(${pc})`)
		}
		return this.cartridge.readCHR(pc)
	}
	writeCHR(pc: uint16, x: uint8): void {
		this.cartridge.writeCHR(pc, x)
	}

	private nametableIndex(pc: number): number {
		if (this.cartridge.header.mirroring) {
			// vertical
			return pc & 0x7FF
		} else {
			// horizontal
			return (pc >> 1 & 0x400) | (pc & 0x3FF)
		}
	}
	readNametable(pc: number): number {
		return this.vram[this.nametableIndex(pc)]
	}
	writeNametable(pc: number, x: number): void {
		this.vram[this.nametableIndex(pc)] = x
	}
	state(): MapperState {
		return []
	}
}