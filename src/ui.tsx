/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as NES from './nes'
import sampleROMPath from './asset/games/mapper0/thwaite.nes'
import * as Color from './ppu/color'
import * as PPU from './ppu/ppu'

const TableRow = (props: { row: Array<string> }) => {
	return <tr>
		{
			props.row.map((x, i) => {
				return <td key={i}>{x}</td>
			})
		}
	</tr>
}

const Palette = (props: { palette: PPU.Palette }) => {
	const sz = 18
	const colors = props.palette.map((c, i) => {
		const [r, g, b] = Color.get(c)
		return <div key={i} style={{
			backgroundColor: `rgb(${r}, ${g}, ${b})`,
			height: sz, width: sz,
		}} />
	})
	return <div style={{ display: "flex" }}>
		{colors}
	</div>
}

const DebugInfo = (props: { debugInfoHistory: Array<NES.DebugInfo> }) => {
	if (props.debugInfoHistory.length === 0) {
		return null
	}
	const info = props.debugInfoHistory[props.debugInfoHistory.length - 1]

	const cpu = info.cpuStatus
	const ppu = info.ppuStatus

	const backgroundPalettes = info.nes.ppu.bus.backgroundPalettes.map((palette, i) => {
		return <Palette key={i} palette={palette} />
	})
	const spritePalettes = info.nes.ppu.bus.spritePalettes.map((palette, i) => {
		return <Palette key={i} palette={palette} />
	})

	return <div>
		<div>
			<table>
				<tbody>
					{
						[
							["PC", cpu.registers.pc],
							["A", cpu.registers.a],
							["X", cpu.registers.x],
							["Y", cpu.registers.y],
							["P", cpu.registers.p],
							["S", cpu.registers.s],
						].map(([s, x], i) => {
							const id = "" + i
							return <TableRow key={id} row={[s as string, x.toString(16).toUpperCase()]} />
						})
					}
					<TableRow key="cyc" row={["CYC", "" + cpu.cyc]}></TableRow>
					<TableRow key="instr" row={["INSTR", "" + cpu.instr]}></TableRow>
					<TableRow key="frame" row={["FRAME", "" + ppu.frameCount]}></TableRow>
				</tbody>
			</table>
		</div>
		<div>
			<strong>BG palette</strong>
			<div>
				{backgroundPalettes}
			</div>
		</div>
		<div>
			<strong>Sprite palette</strong>
			<div>
				{spritePalettes}
			</div>
		</div>
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
	const [frameCount, setFrameCount] = useState(1)
	const [buttons, setButtons] = useState(0)
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
	const onFrame = () => {
		try {
			props.nes.frame(frameCount)
		} catch (e) {
			const err = e as Error
			setError(err.message)
		}
		nesRender()
		addDebugInfo()
	}

	useEffect(() => {
		props.nes.setControllerState(1, buttons)
	}, [buttons, props.nes])
	const buttonsComponent =
		["A", "B", "SELECT", "START", "UP", "DOWN", "LEFT", "RIGHT"].map((s, i) => {
			return <span key={i}>
				<input type="checkbox" value={buttons >> i & 1} onChange={(e) => {
					setButtons((buttons) => {
						return buttons & ~(1 << i) | (e.target.checked ? 1 << i : 0)
					})
				}} />{s}
			</span>
		})

	const reset = () => {
		props.nes.resetAll();
		setDebugInfo([])
		setError("")
		nesRender()
	}

	return <div>
		<div>
			<ErrorBanner error={error} />
			<div>
				<button onClick={reset}>reset</button>
			</div>
			<div>
				<button onClick={onStep}>step</button>
				<input min="1" type="number" value={stepCount ? stepCount : ""} onChange={(e) => {
					if (e.target.value === "") {
						setStepCount(0)
					}
					setStepCount(parseInt(e.target.value))
				}}></input>
			</div>
			<div>
				<button onClick={onFrame}>frame</button>
				<input min="1" type="number" value={frameCount ? frameCount : ""} onChange={(e) => {
					if (e.target.value === "") {
						setFrameCount(0)
					}
					setFrameCount(parseInt(e.target.value))
				}}></input>
			</div>
			<div>
				{buttonsComponent}
			</div>
		</div>
		<div>
			<canvas ref={gameCanvasRef}
				width="256"
				height="240"></canvas>
		</div>
		<DebugInfo debugInfoHistory={debugInfo}></DebugInfo>
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

interface FileEntry {
	dummy: string // empty
	name: string
	file: File
}

const FileChooser = (props: { onChange: (data: Uint8Array) => void }) => {
	const [fileName, setFileName] = useState<string>("No file")
	const [filePath, setFilePath] = useState<string | null>(null)
	const [db, setDB] = useState<IDBDatabase | null>(null)

	const onChange = props.onChange
	useEffect(() => {
		if (filePath === null) {
			return
		}
		let cancelled = false
		fetch(filePath).then((response) => {
			return response.blob()
		}).then((blob) => {
			const e = {
				dummy: "",
				name: fileName,
				file: blob,
			}
			db?.transaction("file", "readwrite").objectStore("file").put(e)
			return blob.arrayBuffer()
		}).then((data) => {
			if (!cancelled) {
				onChange(new Uint8Array(data))
			}
		})
		return () => { cancelled = true }
	}, [filePath, fileName, db, onChange])

	useEffect(() => {
		const fileDB = indexedDB.open('fileDB', 2)
		fileDB.onupgradeneeded = e => {
			const db = (e.target as IDBRequest).result as IDBDatabase
			db.onerror = (e) => {
				console.error(e)
			}
			db.createObjectStore('file', { keyPath: 'dummy' });
		}
		fileDB.onsuccess = ((e) => {
			const db = (e.target as IDBRequest).result as IDBDatabase
			db.transaction("file").objectStore("file").get("").onsuccess = (e) => {
				const f = (e.target as IDBRequest<FileEntry>).result
				setFileName(f.name)
				setFilePath(URL.createObjectURL(f.file))
			}
			setDB(db)
		})
	}, [])

	return <div>
		<label>{fileName}</label>
		{/* <div>
			< input type="file" accept=".nes" onChange={(e) => {
				if (e === null || !e.target.files || !e.target.files[0]) {
					return
				}
				const file = e.target.files[0]
				setFileName(file.name)
				setFilePath(URL.createObjectURL(file))
			}} value="" /></div> */}

		<div style={{ height: 100, borderStyle: "inset" }}
			onDrop={e => {
				e.preventDefault()
				const file = e.dataTransfer.files[0]
				setFileName(file.name)
				setFilePath(URL.createObjectURL(file))
			}}
			onDragOver={e => {
				e.preventDefault()
			}}
		>
			D&D NES file here
		</div>

	</div >
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

	props.nes.setDebugMode(debugMode)
	const game = debugMode ?
		<DebugGame nes={props.nes} /> :
		<RealGame nes={props.nes} />

	return <div>
		<label>debug mode:<input name="debugmode" type="checkbox" checked={debugMode} onChange={(e) => {
			setDebugMode(e.target.checked)
		}} /></label>
		{game}
		<Controll />
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

	return <div>
		<FileChooser onChange={setCartridgeData} />
		{cartridgeData ? <Game nes={new NES.NES(cartridgeData)} /> : null}
	</div>
}
