import { uint8 } from "./num"

/*
- Controller reading https://wiki.nesdev.com/w/index.php?title=Controller_reading
- Standard controller https://wiki.nesdev.com/w/index.php?title=Standard_controller
*/
export class Controller {
	private strobe = 0 // Controller shift register strobe
	private controller1 = 0

	constructor() { }

	write4016(x: uint8) {
		this.strobe = x
	}
	// Read polled data one bit at a time from $4016 or $4017
	read4016(): uint8 { // controller 1
		const res = this.controller1 & 1
		this.controller1 >>= 1
		return res
	}
	read4017(): uint8 { // controller 2
		throw new Error(`Unsupported second controller`)
	}

	// NES standard controller input.
	// 0 = A, B, Select, Start, Up, Down, Left, Right = 7
	pushController1Data(x: uint8) {
		if ((this.strobe & 1) === 1) {
			this.controller1 = x
		}
	}
}
