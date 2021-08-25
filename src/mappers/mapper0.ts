import { uint16, uint8 } from "../num";
import { Cartridge } from "./cartridge";
import { Mapper } from "./mapper";

// Implements Mapper
export class Mapper0 implements Mapper {
	cartridge: Cartridge
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
	readPPU(pc: uint16): uint8 {
		if (pc < 0 || pc >= 0x2000) {
			throw new Error(`Cartridge.readPPU(${pc})`)
		}
		return this.cartridge.chrROM[pc & 0x1FFF]
	}
	writePPU(pc: uint16, x: uint8): void {
		if (this.cartridge.header.chrROMSize > 0) {
			return
		}
		this.cartridge.chrROM[pc & 0x1FFF] = x
	}
}