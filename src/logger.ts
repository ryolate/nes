export class Logger {
	private sink
	private prefix
	constructor(sink: LogSink, prefix: string) {
		this.sink = sink
		this.prefix = prefix
	}

	log(s: string): void {
		this.sink.log(`${this.prefix}: ${s}`)
	}

	newLogger(newPrefix: string): Logger {
		return new Logger(this.sink, newPrefix)
	}

	setPrefix(newPrefix: string): void {
		this.prefix = newPrefix
	}
}

interface LogSink {
	log(s: string): void
}

export class ConsoleLogSink {
	log(s: string): void {
		console.log(s)
	}
}

export class LogBuffer {
	private buf = new Array<string>()
	log(s: string): void {
		this.buf.push(s)
	}
	get(): Array<string> {
		return this.buf
	}
	clear(): void {
		this.buf.length = 0
	}
}
