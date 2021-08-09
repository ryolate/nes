/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as NES from './nes'
import sampleROMPath from './asset/games/mapper0/thwaite.nes'
import * as Color from './ppu/color'

const TableRow = (props: { row: Array<string> }) => {
	return <tr>
		{
			props.row.map((x, i) => {
				return <td key={i}>{x}</td>
			})
		}
	</tr>
}

const DebugInfo = (props: { debugInfoHistory: Array<NES.DebugInfo> }) => {
	if (props.debugInfoHistory.length === 0) {
		return null
	}
	const info = props.debugInfoHistory[props.debugInfoHistory.length - 1]
	const s = info.cpuStatus

	return <div>
		<table>
			<tbody>
				{
					[
						["PC", s.registers.pc],
						["A", s.registers.a],
						["X", s.registers.x],
						["Y", s.registers.y],
						["P", s.registers.p],
						["S", s.registers.s],
					].map(([s, x], i) => {
						const id = "" + i
						return <TableRow key={id} row={[s as string, x.toString(16).toUpperCase()]} />
					})
				}
				<TableRow key="cyc" row={["CYC", "" + s.cyc]}></TableRow>
				<TableRow key="instr" row={["INSTR", "" + s.instr]}></TableRow>
			</tbody>
		</table>
	</div>
}

const ErrorBanner = (props: { error: string }) => {
	if (!props.error) {
		return null
	}
	return <div style={{ color: "red" }}>
		<label>Error: {props.error}</label>
	</div>
}

const DebugGame = (props: { nes: NES.NES }) => {
	const gameCanvasRef = useRef<HTMLCanvasElement>(null)
	const charsCanvasRef = useRef<HTMLCanvasElement>(null)
	const colorsCanvasRef = useRef<HTMLCanvasElement>(null)

	const [stepCount, setStepCount] = useState(1)
	const [error, setError] = useState<string>("")

	const [debugInfo, setDebugInfo] = useState<Array<NES.DebugInfo>>([])

	const addDebugInfo = useCallback(() => {
		const x = props.nes.debugInfo()
		const last = debugInfo[debugInfo.length - 1]
		if (last && last.cpuStatus.cyc === x.cpuStatus.cyc) {
			return
		}
		setDebugInfo(debugInfo.concat([props.nes.debugInfo()]))
	}, [debugInfo, props.nes])

	const nesRender = useCallback(() => {
		props.nes.render(gameCanvasRef.current!.getContext('2d')!)
		addDebugInfo()
	}, [addDebugInfo, props.nes])

	useEffect(() => {
		props.nes.cartridge.renderCharacters(charsCanvasRef.current!)
		Color.render(colorsCanvasRef.current!)
		nesRender()
	}, [nesRender, props.nes])

	const onStep = () => {
		try {
			for (let i = 0; i < stepCount; i++) {
				props.nes.stepToNextInstruction()
			}
		} catch (e) {
			const err = e as Error
			setError(err.message)
		}
		nesRender()
		addDebugInfo()
	}

	const reset = () => {
		props.nes.resetAll();
		setDebugInfo([])
		setError("")

		nesRender()
	}

	return <div>
		<ErrorBanner error={error} />
		<button onClick={reset}>reset</button>
		<button onClick={onStep}>step</button>
		<label>count: <input min="1" type="number" value={stepCount ? stepCount : ""} onChange={(e) => {
			if (e.target.value === "") {
				setStepCount(0)
			}
			setStepCount(parseInt(e.target.value))
		}}></input></label>
		<DebugInfo debugInfoHistory={debugInfo}></DebugInfo>
		<div>
			<canvas ref={gameCanvasRef}
				width="256"
				height="240"></canvas>
		</div>
		<div>
			<canvas ref={charsCanvasRef}></canvas>
		</div>
		<div>
			<canvas ref={colorsCanvasRef}></canvas>
		</div>
	</div>
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

	const onChange = props.onChange
	useEffect(() => {
		let cancelled = false
		fetch(filePath).then((response) => {
			return response.blob()
		}).then((blob) => {
			return blob.arrayBuffer()
		}).then((data) => {
			if (!cancelled) {
				onChange(new Uint8Array(data))
			}
		})
		return () => { cancelled = true }
	}, [filePath, onChange])

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
	const [debugMode, setDebugMode] = useState<boolean>(() => !sessionStorage.getItem("noDebug"))

	useEffect(() => {
		if (debugMode) {
			sessionStorage.removeItem("noDebug")
		} else {
			sessionStorage.setItem("noDebug", "1")
		}
	}, [debugMode])

	useEffect(() => {
		// A, B, Select, Start, Up, Down, Left, Right
		const keys = "kjfhwsad"
		let data = 0
		const keydownListener = (e: KeyboardEvent) => {
			const i = keys.indexOf(e.key)
			if (i === undefined) {
				return
			}
			data |= 1 << i
			props.nes.setControllerState(data)
		}
		const keyupListener = (e: KeyboardEvent) => {
			const i = keys.indexOf(e.key)
			if (i === undefined) {
				return
			}
			data &= ~(1 << i)
			props.nes.setControllerState(data)
		}

		document.addEventListener("keydown", keydownListener)
		document.addEventListener("keyup", keyupListener)

		return () => {
			document.removeEventListener("keydown", keydownListener)
			document.removeEventListener("keyup", keyupListener)
			props.nes.setControllerState(0)
		}
	}, [props.nes])

	props.nes.setDebugMode(debugMode)
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

export const App = (): JSX.Element => {
	const [cartridgeData, setCartridgeData] = useState<Uint8Array | null>(null)

	return <div>
		{cartridgeData ? <Game nes={new NES.NES(cartridgeData)} /> : null}
		<FileChooser onChange={setCartridgeData} />

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
