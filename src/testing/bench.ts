import * as fs from 'node:fs'
import { NES } from '../nes/nes'
import { performance } from 'node:perf_hooks'

// 15.67s on 9c791512ba29d09927aef2fbb5cc35661b3a249e
// run with `npx ts-node src/testing/bench.ts`.
const filepath = 'testdata/secret/SUPER_MARIO_BROS.NES'
const frameCount = 1200 // 20 seconds.

const data = fs.readFileSync(filepath)
const nes = NES.fromCartridgeData(data)

const start = performance.now()
nes.frame(frameCount)

const d = ((performance.now() - start) / 1000).toFixed(2)

console.log(`Took %d seconds`, d)
