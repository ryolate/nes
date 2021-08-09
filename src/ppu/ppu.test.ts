/**
 * @jest-environment jsdom
 */

import * as fs from 'fs'
import { NES } from '../nes'
import { assertSameImageBuffers, wantFrame } from '../testing/golden'

test.each([
	['hello.nes', 10],
	['nestest.nes', 10],
])("Compare", (name, frameCount) => {
	const filepath = 'src/asset/' + name
	const data = fs.readFileSync(filepath)
	const nes = new NES(data)

	for (let i = 0; i < frameCount; i++) {
		nes.frame()
	}

	const got = nes.buffer()
	const want = wantFrame(filepath, 10)

	assertSameImageBuffers(got, want)
})
