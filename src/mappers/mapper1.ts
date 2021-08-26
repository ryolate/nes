import { assertInRange, uint16, uint8 } from "../num";
import { Cartridge } from "./cartridge";
import { Mapper, MapperState } from "./mapper";

// https://wiki.nesdev.com/w/index.php/MMC1
export class Mapper1 implements Mapper {
	readonly cartridge: Cartridge
	readonly vram = new Uint8Array(0x800) // 2KB nametable
	constructor(cartridge: Cartridge) {
		this.cartridge = cartridge
		this.resetShiftRegister()
	}

	// CPU $8000-$FFFF is connected to a common shift register.
	private shiftRegister = 0
	private resetShiftRegister() {
		this.shiftRegister = 0b10000
	}
	private loadRegister(pc: uint16, x: uint8) {
		if (x >> 7) {
			this.resetShiftRegister()
			return
		}
		const copy = this.shiftRegister & 1
		this.shiftRegister = (this.shiftRegister >> 1) | ((x & 1) << 4)
		if (copy) {
			if (pc <= 0x9FFF) {
				this.setControl(this.shiftRegister)
			} else if (pc <= 0xBFFF) {
				this.chrBank0 = this.shiftRegister
			} else if (pc <= 0xDFFF) {
				this.chrBank1 = this.shiftRegister
			} else {
				this.prgBank = this.shiftRegister & 31
				this.prgRAMChipEnable = this.shiftRegister >> 4
			}
			this.resetShiftRegister()
		}
	}

	private setControl(x: number) {
		this.mirroring = x & 3
		this.prgROMBankMode = x >> 2 & 3
		this.chrROMBankMode = x >> 4 & 1
	}
	// 0: one-screen, lower bank
	// 1: one-screen, upper bank
	// 2: vertical
	// 3: horizontal
	private mirroring = 0
	// 0, 1: switch 32 KB at $8000, ignoring low bit of bank number
	// 2: fix first bank at $8000 and switch 16 KB bank at $C000
	// 3: fix last bank at $C000 and switch 16 KB bank at $8000
	private prgROMBankMode = 0
	// 0: switch 8 KB at a time
	// 1: switch two separate 4 KB banks
	private chrROMBankMode = 0

	// Select 4 KB or 8 KB CHR bank at PPU $0000 (low bit ignored in 8 KB mode)
	private chrBank0 = 0
	// Select 4 KB CHR bank at PPU $1000 (ignored in 8 KB mode)
	private chrBank1 = 0

	// Select 16 KB PRG ROM bank (low bit ignored in 32 KB mode)
	private prgBank = 0
	// PRG RAM chip enable (0: enabled; 1: disabled; ignored on MMC1A)
	// This emulator ignores this bit.
	private prgRAMChipEnable = 0

	readCPU(pc: uint16): uint8 {
		if (pc < 0x6000) {
			return 0
		} else if (pc <= 0x7FFF) {
			// CPU $6000-$7FFF: 8 KB PRG RAM bank, (optional)
			// TODO: implement RAM bank.
			if (this.cartridge.prgRAM.length) {
				return this.cartridge.prgRAM[(pc - 0x6000) % this.cartridge.prgRAM.length]
			}
			return 0
		} else {
			const i = pc - 0x8000
			const prgROM = this.cartridge.prgROM
			switch (this.prgROMBankMode) {
				case 0:
				case 1:
					return prgROM[(this.prgBank >> 1) * 0x8000 + i]
				case 2:
					if (i < 0x4000) {
						return prgROM[i]
					}
					return prgROM[this.prgBank * 0x4000 + (i - 0x4000)]
				case 3:
					if (i < 0x4000) {
						return prgROM[this.prgBank * 0x4000 + i]
					}
					return prgROM[prgROM.length - 0x8000 + i]
			}
			throw new Error(`BUG $${pc.toString(16)} ${this.prgROMBankMode}`)
		}
	}

	writeCPU(pc: uint16, x: uint8): void {
		if (pc < 0x6000) {
			return
		} else if (pc <= 0x7FFF) {
			// $6000-$7FFF: 8 KB PRG RAM bank, (optional)
			if (this.cartridge.prgRAM.length) {
				this.cartridge.prgRAM[(pc - 0x6000) % this.cartridge.prgRAM.length] = x
			}
			return
		} else {
			// Unlike almost all other mappers, the MMC1 is configured through a
			// serial port in order to reduce pin count. CPU $8000-$FFFF is
			// connected to a common shift register.
			this.loadRegister(pc, x)
		}
	}

	private chrROMIndex(pc: number): number {
		if (this.chrROMBankMode === 0) {
			return (this.chrBank0 >> 1) * 0x2000 + pc
		}
		if (pc < 0x1000) {
			return this.chrBank0 * 0x1000 + pc
		} else {
			return this.chrBank1 * 0x1000 + (pc - 0x1000)
		}
	}

	// Pattern table $0000 - $1FFF
	// Name table $2000 - $2FFF
	readCHR(pc: uint16): uint8 {
		return this.cartridge.readCHR(this.chrROMIndex(pc))
	}
	writeCHR(pc: uint16, x: uint8): void {
		this.cartridge.writeCHR(this.chrROMIndex(pc), x)
	}
	private nametableIndex(pc: number): number {
		switch (this.mirroring) {
			case 0:
				return pc & 0x3FF
			case 1:
				return 0x400 + (pc & 0x3FF)
			case 2:
				return pc & 0x7FF
			case 3:
				return (pc >> 1 & 0x400) | pc & 0x3FF
		}
		throw new Error(`BUG: mirroring=${this.mirroring}`)
	}
	readNametable(pc: number): number {
		assertInRange(this.nametableIndex(pc), 0, 0x800)
		return this.vram[this.nametableIndex(pc)]
	}
	writeNametable(pc: number, x: number): void {
		assertInRange(this.nametableIndex(pc), 0, 0x800)
		this.vram[this.nametableIndex(pc)] = x
	}

	state(): MapperState {
		return [
			["mirroring", "" + this.mirroring],
			["prgROMBankMode", "" + this.prgROMBankMode],
			["chrROMBankMode", "" + this.chrROMBankMode],
			["chrBank0", "" + this.chrBank0],
			["chrBank1", "" + this.chrBank1],
			["prgBank", "" + this.prgBank],
			["prgRAMChipEnable", "" + this.prgRAMChipEnable],
		]
	}
}
