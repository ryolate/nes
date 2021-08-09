/**
 * @jest-environment jsdom
 */
import * as fs from 'fs'
import { NES } from '../nes'
import { assertSameImageBuffers, wantFrame } from '../testing/golden'
import { JSNES } from '../testing/jsnes'
import * as controller from '../controller'

test.each([
	['hello.nes', 5],
	['nestest.nes', 5],
])("Compare", (name, frameCount) => {
	const filepath = 'src/asset/' + name
	const data = fs.readFileSync(filepath)
	const nes = new NES(data)

	for (let i = 0; i < frameCount; i++) {
		nes.frame()
	}

	const got = nes.buffer()
	const want = wantFrame(filepath, frameCount)

	assertSameImageBuffers(got, want)
})

test('thwaite.nes', () => {
	const filepath = 'src/asset/games/mapper0/thwaite.nes'
	const data = fs.readFileSync(filepath)
	const nes = new NES(data)
	const jsnes = new JSNES()
	jsnes.loadFile(filepath)

	const runner = new TestRunner(nes, jsnes)

	runner.frame(6)
	runner.check()

	runner.setButtonState(controller.ButtonStart)
	runner.frame(5)

	runner.setButtonState(0)
	// FIXME
	// runner.check()
})

class TestRunner {
	nes: NES
	jsnes: JSNES
	constructor(nes: NES, jsnes: JSNES) {
		this.nes = nes
		this.jsnes = jsnes
	}
	frame(n?: number) {
		this.nes.frame(n)
		this.jsnes.frame(n)
	}

	jsnesPreviousButtonState = 0
	// Example:
	//   setButtonState(Controller.ButtonA)
	setButtonState(state: number) {
		this.nes.setControllerState(1, state)
		for (let i = 0; i < 8; i++) {
			const prev = this.jsnesPreviousButtonState >> i & 1
			const cur = state >> i & 1
			if (prev === 1 && cur === 0) {
				this.jsnes.buttonDown(1, i)
			}
			if (prev === 0 && cur === 1) {
				this.jsnes.buttonUp(1, i)
			}
		}
		this.jsnesPreviousButtonState = state
	}

	check() {
		assertSameImageBuffers(this.nes.buffer(), this.jsnes.buffer())
	}
}