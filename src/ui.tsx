import React, { useRef, useEffect, useState } from 'react'
import * as NES from './nes'
import sampleROMPath from './asset/nestest.nes'

const DebugInfo = (props: { debugInfoHistory: Array<NES.DebugInfo> }) => {
	if (!props.debugInfoHistory) {
		return null
	}
	const info = props.debugInfoHistory[props.debugInfoHistory.length - 1]
	const s = info.cpuStatus

	return <div>
		<table>
			<tr>
				<td>A</td>
				<td>{s.registers.a}</td>
			</tr>
		</table>
		{s.registers.a}
	</div>
}

const DebugGame = (props: { nes: NES.NES }) => {
	const gameCanvasRef = useRef<HTMLCanvasElement>(null)
	const charsCanvasRef = useRef<HTMLCanvasElement>(null)
	const [stepCount, setStepCount] = useState(1)

	const [debugInfo, setDebugInfo] = useState<Array<NES.DebugInfo>>([])

	const nesRender = () => {
		props.nes.render(gameCanvasRef.current!.getContext('2d')!)
	}

	useEffect(() => {
		props.nes.cartridge.renderCharacters(charsCanvasRef.current!)
		nesRender()
	})

	const onStep = () => {
		for (let i = 0; i < stepCount; i++) {
			props.nes.stepToNextInstruction()
		}
		nesRender()

		setDebugInfo(debugInfo.concat([props.nes.debugInfo()]))
	}

	return <div>
		<button onClick={() => { props.nes.resetAll(); nesRender() }}>reset</button>
		<button onClick={onStep}>step</button>
		<label>count: <input min="1" type="number" value={stepCount ? stepCount : ""} onChange={(e) => {
			if (e.target.value === "") {
				setStepCount(0)
			}
			setStepCount(parseInt(e.target.value))
		}}></input></label>
		<DebugInfo debugInfoHistory={debugInfo}></DebugInfo>
		<div>
			<label>CHRROM:</label>
			<canvas ref={gameCanvasRef}
				width="256"
				height="240"></canvas>
		</div>
		<div>
			<canvas ref={charsCanvasRef}></canvas>
		</div>
	</div >
}

const RealGame = (props: { nes: NES.NES }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [fps, setFPS] = useState(0)

	useEffect(() => {
		const canvas = canvasRef.current!

		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

		let prevTimestamp: DOMHighResTimeStamp
		let prevSecond: DOMHighResTimeStamp
		let countInSecond = 0

		let reqId: number
		const render = (timestamp: DOMHighResTimeStamp) => {
			reqId = requestAnimationFrame(render)

			const currentSecond = Math.floor(timestamp / 1000)
			if (prevTimestamp === undefined) {
				prevTimestamp = timestamp
				prevSecond = currentSecond
				return
			}

			const elapsed = timestamp - prevTimestamp
			prevTimestamp = timestamp

			props.nes.play(elapsed)
			props.nes.render(ctx)

			countInSecond++
			if (prevSecond < currentSecond) {
				setFPS(countInSecond)
				prevSecond = currentSecond
				countInSecond = 0
			}
		}
		render(performance.now())
		return () => {
			cancelAnimationFrame(reqId)
		}
	})

	return <>
		<div className="row">
			<div className="col-6">
				<canvas
					ref={canvasRef}
					width="256"
					height="240"
				></canvas >
				<label>FPS = {Math.round(fps * 10) / 10}</label>
			</div>
		</div>
	</>
}

const FileChooser = (props: { onChange: (data: Uint8Array) => void }) => {
	const [filePath, setFilePath] = useState<string>(sampleROMPath)

	useEffect(() => {
		let cancelled = false
		fetch(filePath).then((response) => {
			return response.blob()
		}).then((blob) => {
			return blob.arrayBuffer()
		}).then((data) => {
			if (!cancelled) {
				props.onChange(new Uint8Array(data))
			}
		})
		return () => { cancelled = true }
	}, [filePath])

	return <div>
		< input type="file" accept=".nes" onChange={(e) => {
			if (e === null) {
				return
			}
			const file = e.target.files![0]
			setFilePath(URL.createObjectURL(file))
		}} /></div>
}

const Game = (props: { nes: NES.NES }) => {
	const [debugMode, setDebugMode] = useState<boolean>(true)

	const game = debugMode ?
		<DebugGame nes={props.nes} /> :
		<RealGame nes={props.nes} />

	return <div>
		<label>debug mode:<input name="debugmode" type="checkbox" checked={debugMode} onChange={(e) => {
			setDebugMode(e.target.checked)
		}} /></label>
		{game}
	</div >
}

export const App = () => {
	const [cartridgeData, setCartridgeData] = useState<Uint8Array | null>(null)

	return <div>
		{cartridgeData ? <Game nes={new NES.NES(cartridgeData)} /> : null}
		<FileChooser onChange={(data) => { setCartridgeData(data) }} />

		<div>
			Control:
			<ul>
				<li>A: Left</li>
				<li>D: Right</li>
				<li>W: Up</li>
				<li>S: Down</li>
				<li>K: A button</li>
				<li>J: B button</li>
				<li>F: SELECT</li>
				<li>H: START</li>
			</ul>
		</div>
	</div>
}
