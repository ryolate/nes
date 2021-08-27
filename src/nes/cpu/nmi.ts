export class NMI {
	private x = false
	set(): void {
		this.x = true
	}
	// https://wiki.nesdev.com/w/index.php?title=CPU_interrupts
	handle(): boolean {
		const res = this.x
		this.x = false
		return res
	}
}
