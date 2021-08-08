import { uint16, uint8 } from "./num";
/*
References
- registers https://wiki.nesdev.com/w/index.php?title=APU_registers
- Pulse https://wiki.nesdev.com/w/index.php?title=APU_Pulse
- Sweep https://wiki.nesdev.com/w/index.php?title=APU_Sweep
*/

class Pulse {
	r1 = 0
	r2 = 0
	r3 = 0
	r4 = 0
	constructor() { }
}

export class APU {
	pulse1 = new Pulse()
	pulse2 = new Pulse()

	control = 0 // $4015
	frameCounter = 0 // $4017

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
			case 0x4000:
				this.pulse1.r1 = x
				return
			case 0x4001:
				this.pulse1.r2 = x
				return
			case 0x4002:
				this.pulse1.r3 = x
				return
			case 0x4003:
				this.pulse1.r4 = x
				return
			case 0x4004:
				this.pulse2.r1 = x
				return
			case 0x4005:
				this.pulse2.r2 = x
				return
			case 0x4006:
				this.pulse2.r3 = x
				return
			case 0x4007:
				this.pulse2.r4 = x
				return
			case 0x4015:
				this.control = x
				return
			case 0x4017:
				this.frameCounter = x
				return
		}

		throw new Error(`APU.write not implemented. 0x${pc.toString(16)}, ${x}`);
	}
}
