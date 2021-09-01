import fs from 'fs'
import { NES } from '../nes/nes'
import { performance } from 'node:perf_hooks'

// 18.54s on 9f2645ca153c48fa0707811e8ea876c9fd7a2fd1
// run with `npx ts-node src/testing/bench.ts`.
const filepath = 'testdata/secret/SUPER_MARIO_BROS.NES'
const frameCount = 1200

const data = fs.readFileSync(filepath)
const nes = NES.fromCartridgeData(data)

const start = performance.now()
nes.frame(frameCount)

const d = ((performance.now() - start) / 1000).toFixed(2)

console.log(`Took %d seconds`, d)
