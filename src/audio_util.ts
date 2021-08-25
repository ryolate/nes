import { assertInRange } from "./num"

const LEN = 16 * 1024

export class AudioEventDeque {
	buffer = new Array<AudioEvent>(LEN)
	front = 0
	back = 0
	pushBack(e: AudioEvent): void {
		this.buffer[this.back] = e
		this.back = (this.back + 1) & (LEN - 1)
		if (this.back === this.front) {
			throw new Error(`overflow`)
		}
	}
	pushFront(e: AudioEvent): void {
		this.front = (this.front - 1 + LEN) & (LEN - 1)
		this.buffer[this.front] = e
		if (this.back === this.front) {
			throw new Error(`overflow`)
		}
	}
	size(): number {
		return (this.back - this.front + LEN) & (LEN - 1)
	}
	private isEmpty(): boolean {
		return this.size() === 0
	}
	peek(): AudioEvent | null {
		return this.isEmpty() ? null : this.buffer[this.front]
	}
	pop(): void {
		if (this.isEmpty()) {
			throw new Error(`pop: empty`)
		}
		this.front = (this.front + 1) & (LEN - 1)
	}
	// get i-th value.
	get(i: number): AudioEvent {
		assertInRange(i, 0, this.size() - 1)
		return this.buffer[(this.front + i) & (LEN - 1)]
	}
	// pop until n empty slots are preserved.
	ensureCapacity(n: number): void {
		while (this.size() > LEN - n) {
			this.pop()
		}
	}
}

export interface AudioEvent {
	value: number
	cycle: number
	timestampMillis: DOMHighResTimeStamp
}