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
}

class Triangle {
	r1 = 0
	r2 = 0
	r3 = 0
}

class Noise {
	r1 = 0
	r2 = 0
	r3 = 0
}

class DMC {
	r1 = 0
	r2 = 0
	r3 = 0
	r4 = 0
}

export class APU {
	pulse1 = new Pulse()
	pulse2 = new Pulse()
	triangle = new Triangle()
	noise = new Noise()
	dmc = new DMC()

	control = 0 // $4015 (read)
	status = 0 // $4015 (write)
	frameCounter = 0 // $4017

	read(pc: uint16): uint8 {
		switch (pc) {
			case 0x4015:
				return this.control
		}
		// They are write-only except $4015.
		return 0
	}

	write(pc: uint16, x: uint8): void {
		switch (pc & 0x1F) {
			case 0x00:
				this.pulse1.r1 = x
				return
			case 0x01:
				this.pulse1.r2 = x
				return
			case 0x02:
				this.pulse1.r3 = x
				return
			case 0x03:
				this.pulse1.r4 = x
				return
			case 0x04:
				this.pulse2.r1 = x
				return
			case 0x05:
				this.pulse2.r2 = x
				return
			case 0x06:
				this.pulse2.r3 = x
				return
			case 0x07:
				this.pulse2.r4 = x
				return
			case 0x08:
				this.triangle.r1 = x
				return
			case 0x0A:
				this.triangle.r2 = x
				return
			case 0x0B:
				this.triangle.r3 = x
				return
			case 0x0C:
				this.noise.r1 = x
				return
			case 0x0E:
				this.noise.r2 = x
				return
			case 0x0F:
				this.noise.r3 = x
				return
			case 0x10:
				this.dmc.r1 = x
				return
			case 0x11:
				this.dmc.r2 = x
				return
			case 0x12:
				this.dmc.r3 = x
				return
			case 0x13:
				this.dmc.r4 = x
				return
			case 0x15:
				this.status = x
				return
			case 0x17:
				this.frameCounter = x
				return
		}

		throw new Error(`APU.write not implemented. 0x${pc.toString(16)}, ${x}`);
	}
}
