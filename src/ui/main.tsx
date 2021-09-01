/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useRef, useEffect, useState } from 'react'
import * as NES from '../nes/nes'
import { DB } from './db'
import { DebugGame, ErrorBanner } from './debug'

const RealGame = (props: { nes: NES.NES }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [fps, setFPS] = useState(0)

	// Controller
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
			props.nes.setControllerState(1, data)
		}
		const keyupListener = (e: KeyboardEvent) => {
			const i = keys.indexOf(e.key)
			if (i === undefined) {
				return
			}
			data &= ~(1 << i)
			props.nes.setControllerState(1, data)
		}

		document.addEventListener("keydown", keydownListener)
		document.addEventListener("keyup", keyupListener)

		return () => {
			document.removeEventListener("keydown", keydownListener)
			document.removeEventListener("keyup", keyupListener)
			props.nes.setControllerState(1, 0)
		}
	}, [props.nes])

	// Game view
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

	// Game sound
	useEffect(() => {
		// TODO: use AudioWorklet
		const ctx = new AudioContext()
		const bufferSize = 1024 * 4 // TODO: 1024
		const scriptNode: ScriptProcessorNode = ctx.createScriptProcessor(bufferSize, 0, 1)
		scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
			const out = e.outputBuffer.getChannelData(0)
			props.nes.processAudio(out)
		}
		scriptNode.connect(ctx.destination)

		return () => {
			scriptNode.disconnect(ctx.destination)
			scriptNode.onaudioprocess = null
			ctx.close()
		}
	}, [props.nes])

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

interface FileEntry {
	name: string
	file: File
}

// 0-th element is the currently selected file.
type History = Array<FileEntry>

const FileChooser = (props: { onChange: (data: Uint8Array) => void }) => {
	const { onChange } = props

	const [history, setHistory] = useState<History>([])

	// Initialize history
	useEffect(() => {
		async function f() {
			const db = await DB.open<History>("history")
			const hist = await db.get()
			if (hist === undefined) {
				return
			}
			setHistory(hist)
		}
		f().catch(e => {
			console.error(e)
			throw e
		})
	}, [])

	// On history change
	useEffect(() => {
		async function f() {
			if (history.length > 0) {
				onChange(new Uint8Array(await history[0].file.arrayBuffer()))
			}
		}
		f().catch(e => {
			console.error(e)
			throw e
		})
	}, [history, onChange])

	async function updateDB(history: History) {
		setHistory(history)
		const db = await DB.open<History>("history")
		await db.set(history)
	}

	async function insertFileToHistory(name: string, file: File) {
		const hist = [{ name: name, file: file }].concat(history)
		await updateDB(hist)
	}

	const chooser = <div style={{ height: 50, borderStyle: "inset" }}
		onDrop={e => {
			e.preventDefault()
			const file = e.dataTransfer.files[0]
			insertFileToHistory(file.name, file)
		}}
		onDragOver={e => {
			e.preventDefault()
		}}
	>
		D&D NES file here
	</div>

	const selector = <select value={0} onChange={(event) => {
		const i = parseInt(event.target.value)
		const hist = history.slice()
		const head = hist.splice(i, 1)
		updateDB(head.concat(hist))
	}}>
		{
			history.map((entry, i) =>
				<option value={i} key={i}>{entry.name}</option>)
		}
	</select >

	return <div>
		{selector}
		{chooser}
	</div >
}

const Game = (props: { nes: NES.NES, onReset: () => void }) => {
	const [debugMode, setDebugMode] = useState<boolean>(() => !sessionStorage.getItem("noDebug"))

	useEffect(() => {
		if (debugMode) {
			sessionStorage.removeItem("noDebug")
		} else {
			sessionStorage.setItem("noDebug", "1")
		}
	}, [debugMode])

	const game = debugMode ?
		<DebugGame nes={props.nes} onReset={props.onReset} /> :
		<>
			<RealGame nes={props.nes} />
			<Controll />
		</>

	return <div>
		<label>debug mode:<input name="debugmode" type="checkbox" checked={debugMode} onChange={(e) => {
			setDebugMode(e.target.checked)
		}} /></label>
		{game}
	</div >
}

const Controll = () => {
	return <div>
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
}

export const App = (): JSX.Element => {
	const [cartridgeData, setCartridgeData] = useState<Uint8Array | null>(null)
	const [nes, setNES] = useState<NES.NES | null>(null)

	let nesView = null
	if (!nes && cartridgeData) {
		try {
			setNES(NES.NES.fromCartridgeData(cartridgeData))
		} catch (e) {
			console.error(e)
			nesView = <ErrorBanner error={e.toString()} />
		}
	}

	if (nes) {
		nesView = <Game nes={nes} onReset={() => {
			setNES(null)
		}} />
	}

	return <div>
		<FileChooser onChange={setCartridgeData} />
		{nesView}
	</div>
}
