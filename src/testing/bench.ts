import fs from 'fs'
import { NES } from '../nes/nes'
import { performance } from 'node:perf_hooks'

// run with `npx ts-node src/testing/bench.ts`.
const filepath = 'testdata/secret/SUPER_MARIO_BROS.NES'
const frameCount = 3600 // 60 seconds.

const data = fs.readFileSync(filepath)
const nes = NES.fromCartridgeData(data)

const start = performance.now()
nes.frame(frameCount)

const sec = ((performance.now() - start) / 1000)
const d = sec.toFixed(2)

console.log(`Took %f seconds (%f%% speed)`, d, ((frameCount / 60) / sec * 100).toFixed(2))
