/**
 * @jest-environment jsdom
 */
import * as fs from 'fs'
import { NES } from '../nes'
import { assertSameImageBuffers, wantFrame } from '../testing/golden'
import { JSNES } from '../testing/jsnes'
import * as controller from '../controller'

test.each([
	['src/asset/hello.nes', 5],
	['src/asset/nestest.nes', 6],
	['testdata/secret/DONKEY_KONG.NES', 10],
	// ['testdata/secret/SUPER_MARIO_BROS.NES', 40],
])("Compare", async (filepath, frameCount) => {
	const data = fs.readFileSync(filepath)
	const nes = NES.fromCartridgeData(data)

	for (let i = 0; i < frameCount; i++) {
		nes.frame()
	}

	const got = nes.buffer()
	const want = wantFrame(filepath, frameCount)

	await assertSameImageBuffers(got, want)
})

test('thwaite.nes', async () => {
	const filepath = 'src/asset/games/mapper0/thwaite.nes'
	const data = fs.readFileSync(filepath)
	const nes = NES.fromCartridgeData(data)
	const jsnes = new JSNES()
	jsnes.loadFile(filepath)

	const runner = new TestRunner(nes, jsnes)

	runner.frame(6)
	await runner.check()

	runner.setButtonState(controller.ButtonStart)
	runner.frame(5)
	runner.setButtonState(0)
	runner.frame(5)

	await runner.check()
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

	async check() {
		await assertSameImageBuffers(this.nes.buffer(), this.jsnes.buffer())
	}
}