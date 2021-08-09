import * as Debug from "./debug"
import { uint8 } from "./num"

/*
- Controller reading https://wiki.nesdev.com/w/index.php?title=Controller_reading
- Standard controller https://wiki.nesdev.com/w/index.php?title=Standard_controller
*/
export class Controller {
	private strobe = 0 // Controller shift register strobe
	private controller1 = 0
	private realController1 = 0

	write4016(x: uint8): void {
		this.update()
		this.strobe = x
		this.update()
	}
	// Read polled data one bit at a time from $4016 or $4017
	read4016(): uint8 { // controller 1
		this.update()
		const res = this.controller1 & 1
		this.controller1 >>= 1
		return res
	}
	read4017(): uint8 { // controller 2
		if (Debug.isDebugMode()) {
			throw new Error(`Unsupported second controller`)
		}
		return 0
	}

	// NES standard controller input.
	// 0 = A, B, Select, Start, Up, Down, Left, Right = 7
	setController1Data(x: uint8): void {
		this.realController1 = x
	}

	private update() {
		if ((this.strobe & 1) === 1) {
			this.controller1 = this.realController1
		}
	}
}
