import { uint8 } from "./num"

export const ButtonA = 1 << 0
export const ButtonB = 1 << 1
export const ButtonSelect = 1 << 2
export const ButtonStart = 1 << 3
export const ButtonUp = 1 << 4
export const ButtonDown = 1 << 5
export const ButtonLeft = 1 << 6
export const ButtonRight = 1 << 7

export type ControllerId = 1 | 2

/*
- Controller reading https://wiki.nesdev.com/w/index.php?title=Controller_reading
- Standard controller https://wiki.nesdev.com/w/index.php?title=Standard_controller
*/
export class Controller {
	private strobe = 0 // Controller shift register strobe
	private controller1 = 0
	private controller2 = 0
	private realController1 = 0
	private realController2 = 0

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
		this.update()
		const res = this.controller2 & 1
		this.controller2 >>= 1
		return res
	}

	// NES standard controller input.
	// 
	// Example
	//   setControllerData(1, ButtonA | ButtonRight)
	setControllerData(controller: ControllerId, x: uint8): void {
		if (controller === 1) {
			this.realController1 = x
		} else {
			this.realController2 = x
		}
	}

	private update() {
		if ((this.strobe & 1) === 1) {
			this.controller1 = this.realController1
			this.controller2 = this.realController2
		}
	}
}
