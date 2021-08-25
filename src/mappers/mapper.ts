import { uint16, uint8 } from "../num";
import { Cartridge } from "./cartridge";

export interface Mapper {
	readCPU(pc: uint16): uint8
	writeCPU(pc: uint16, x: uint8): void
	readPPU(pc: uint16): uint8
	writePPU(pc: uint16, x: uint8): void
	////////////////////////////// Debug //////////////////////////////
	cartridge: Cartridge
}
