import { uint16, uint8 } from "./num";
/*
References
- registers https://wiki.nesdev.com/w/index.php?title=APU_registers
- Pulse https://wiki.nesdev.com/w/index.php?title=APU_Pulse
- Sweep https://wiki.nesdev.com/w/index.php?title=APU_Sweep
*/
export class APU {
	// Pulse 2 channel
	pulse2D = 0 // $4004
	sweep2 = 0 // $4005

	control = 0

	constructor() { }

	read(pc: uint16): uint8 {
		switch (pc) {
			case 0x4015:
				return this.control
		}
		// They are write-only except $4015.
		return 0
	}

	write(pc: uint16, x: uint8) {
		switch (pc) {
			case 0x4004:
				this.pulse2D = x
				return
			case 0x4005:
				this.sweep2 = x
				return
			case 0x4006:
				// FIXME
				return
			case 0x4007:
				// FIXME
				return
			case 0x4015:
				this.control = x
				return
		}

		throw new Error(`APU.write not implemented. 0x${pc.toString(16)}, ${x}`);
	}
}
