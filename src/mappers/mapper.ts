import { uint16, uint8 } from "../num";
import { Cartridge } from "./cartridge";
import { Mapper0 } from "./mapper0";

export interface Mapper {
	readCPU(pc: uint16): uint8
	writeCPU(pc: uint16, x: uint8): void
	readPPU(pc: uint16): uint8
	writePPU(pc: uint16, x: uint8): void
	////////////////////////////// Debug //////////////////////////////
	cartridge: Cartridge
}

// parses INES data.
//
// Example:
//     const data = fs.readFileSync("testdata/nestest.nes")
//     const mapper = MapperFactory.parseINES(data)
export class MapperFactory {
	static parseINES(data: Uint8Array): Mapper {
		const cartridge = Cartridge.parseINES(data)

		switch (cartridge.header.mapper) {
			case 0:
				return new Mapper0(cartridge)
		}
		throw new Error(`Mapper ${cartridge.header.mapper} not supported`)
	}
}
