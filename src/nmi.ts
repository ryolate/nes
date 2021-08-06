export class NMI {
	x = false
	constructor() { }
	set() {
		this.x = true
	}
	// https://wiki.nesdev.com/w/index.php?title=CPU_interrupts
	handle(): boolean {
		const res = this.x
		this.x = false
		return res
	}
}
