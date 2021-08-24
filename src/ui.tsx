/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as NES from './nes'
import * as Color from './ppu/color'
import * as PPU from './ppu/ppu'
import { ConsoleLogSink, Logger } from './logger'
import * as disasm from './disasm'

const TableRow = (props: { row: Array<string> }) => {
	return <tr>
		{
			props.row.map((x, i) => {
				return <td key={i}>{x}</td>
			})
		}
	</tr>
}

const PaletteColor = (props: { color: Color.RGB }) => {
	const sz = 10
	const [r, g, b] = props.color
	return <div style={{
		backgroundColor: `rgb(${r}, ${g}, ${b})`,
		height: sz, width: sz,
	}} />
}
const Palette = (props: { palette: PPU.Palette }) => {
	const colors = props.palette.map((c, i) => {
		return <PaletteColor key={i} color={Color.get(c)} />
	})
	return <div style={{ display: "flex", marginLeft: 2 }}>
		{colors}
	</div>
}

const Palettes = (props: { palettes: Array<PPU.Palette> }) => {
	const palettes = props.palettes.map((p, i) => {
		return <Palette key={i} palette={p} />
	})
	return <div style={{ display: "flex" }}>
		{palettes}
	</div>
}

const PPUPalettes = (props: { universal: number, bg: Array<PPU.Palette>, sprite: Array<PPU.Palette> }) => {
	return <div style={{ display: "flex" }}>
		<PaletteColor color={Color.get(props.universal)} />
		<Palettes palettes={props.bg} />
		<Palettes palettes={props.sprite} />
	</div>
}

const SpriteInfo = (props: { oam: Array<number> }) => {
	const oam = props.oam
	const res = []
	for (let i = 0; i < oam.length; i += 4) {
		const y = oam[i]
		const tileIndexNumber = oam[i + 1]
		const attributes = oam[i + 2]
		const x = oam[i + 3]
		res.push(
			<tr key={i / 4}>
				<td>{i / 4}</td>
				<td>{x}</td>
				<td>{y}</td>
				<td>{tileIndexNumber}</td>
				<td>{attributes}</td>
			</tr>
		)
	}
	return <>
		<strong>OAM</strong>
		<div style={{ overflow: "scroll", height: 500, width: 200 }}>
			<table>
				<thead>
					<tr>
						<th>index</th>
						<th>x</th>
						<th>y</th>
						<th>tile</th>
						<th>attr</th>
					</tr>
				</thead>
				<tbody>
					{res}
				</tbody>
			</table>
		</div>
	</>
}

// Table row
const Register = (props: { name: string, value: number, radix?: 2 | 10 | 16 }) => {
	const radix = props.radix ?? 10
	const pref = radix === 16 ? '$' : radix === 2 ? 'b' : ''
	return <tr>
		<td>{props.name}</td>
		<td width="60px">{pref + props.value.toString(radix).toUpperCase()}</td>
	</tr>
}

const PPUInfo = (props: { ppu: PPU.PPU }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const ppu = props.ppu

	useEffect(() => {
		if (!canvasRef.current) {
			return
		}
		const canvas = canvasRef.current
		ppu.renderNametable(canvas)
	})

	const registers = [
		// internal registers
		["scanline", ppu.scanline],
		["scanlineCycle", ppu.scanlineCycle],
		["coarseX", ppu.coarseX()],
		["coarseY", ppu.coarseY()],
		["nametableSelect [$2000@0-1]", ppu.nametableSelect()],
		["fineX", ppu.fineX()],
		["fineY", ppu.fineY()],
		["internalW", ppu.internalW],
		// $2000
		["ctrlNMIEnable [$2000@7]", ppu.ctrlNMIEnable],
		// ["ctrlPPUMaster", ppu.ctrlPPUMaster],
		["ctrlSpriteHeight [$2000@5]", ppu.ctrlSpriteHeight],
		["ctrlBackgroundTileSelect [$2000@4]", ppu.ctrlBackgroundTileSelect],
		["ctrlSpriteTileSelect [$2000@3]", ppu.ctrlSpriteTileSelect],
		["ctrlIncrementMode [$2000@2]", ppu.ctrlIncrementMode],
		// $2001
		["colorEmphasis [$2001@5-7]", ppu.colorEmphasis, 2],
		["spriteEnable [$2001@4]", ppu.spriteEnable],
		["backgroundEnable [$2001@3]", ppu.backgroundEnable],
		["spriteLeftColumnEnable [$2001@2]", ppu.spriteLeftColumnEnable],
		["backgroundLeftColumnEnable [$2001@1]", ppu.backgroundLeftColumnEnable],
		["grayscale [$2001@0]", ppu.grayscale],
		// $2002
		["vblank [$2002@7]", ppu.vblank],
		["spriteZeroHit [$2002@6]", ppu.spriteZeroHit],
		["spriteOverflow [$2002@5]", ppu.spriteOverflow],
		// $2003
		["oamAddr", ppu.oamAddr, 16],
		// $2004
		["oamData", ppu.oamData],
	].map((a, i) => {
		const name = a[0] as string
		const value = a[1] as number
		const radix = a[2] as 2 | 16 | undefined
		return <Register key={i}
			name={name} value={value} radix={radix} />
	})
	const registerTable = <table><tbody>
		{registers}
	</tbody></table>

	return <div>
		<PPUPalettes universal={ppu.bus.universalBackgroundColor}
			bg={ppu.bus.backgroundPalettes}
			sprite={ppu.bus.spritePalettes} />
		<div style={{ marginTop: "1px" }}>
			<canvas ref={canvasRef}></canvas>
		</div>
		<div style={{ display: "flex" }}>
			<span>
				{registerTable}
			</span>
			<span>
				<SpriteInfo oam={ppu.bus.oam} />
			</span>
		</div>
	</div>
}

const DebugInfo = (props: { info: NES.DebugInfo }) => {
	const nes = props.info.nes

	const cpu = props.info.cpuStatus

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
					<TableRow key="frame" row={["FRAME", "" + nes.ppu.frameCount]}></TableRow>
				</tbody>
			</table>
		</div>
		<div>
			<PPUInfo ppu={nes.ppu} />
		</div>
	</div>
}

const ErrorBanner = (props: { error: Error | null }) => {
	if (!props.error) {
		return null
	}
	console.log('error!!!!!!!!!!!!!!!!!!!!')
	console.error(props.error)
	return <div style={{ color: "red" }}>
		<label>{props.error.message}</label>
		<div>{props.error.stack}</div>
	</div>
}

const DebugGame = (props: { nes: NES.NES }) => {
	const gameCanvasRef = useRef<HTMLCanvasElement>(null)
	const charsCanvasRef = useRef<HTMLCanvasElement>(null)
	const colorsCanvasRef = useRef<HTMLCanvasElement>(null)
	const disaTableRef = useRef<HTMLDivElement>(null)

	const [stepCount, setStepCount] = useState(1)
	const [frameCount, setFrameCount] = useState(1)
	const [buttons, setButtons] = useState(0)
	const [error, setError] = useState<Error | null>(null)
	const [debugInfo, setDebugInfo] = useState<NES.DebugInfo | null>(null)

	const disaList = useMemo(() => disasm.disasm(props.nes.cartridge), [props.nes.cartridge])
	const pc2Idx = (() => {
		const res = new Map<number, number>()
		disaList.forEach(([pc], i) => {
			res.set(pc, i)
		})
		return res
	})()
	const disaTable =
		<div ref={disaTableRef} style={{
			overflow: "scroll", height: "1000px", width: "300px"
		}}>
			<table><tbody>
				{disaList.map(([pc, s], i) => {
					pc2Idx.set(pc, i)
					return <tr key={i} style={{
						height: "26px",
						backgroundColor: pc === debugInfo?.cpuStatus.registers.pc
							? "lightyellow" : undefined
					}}>
						<td>{pc.toString(16).toUpperCase()}</td>
						<td>{s}</td>
					</tr>
				})}
			</tbody></table >
		</div >

	useEffect(() => {
		const pc = debugInfo?.cpuStatus.registers.pc
		const i = pc && pc2Idx.get(pc)
		if (i && disaTableRef.current) {
			const y = 26 * i - 150
			disaTableRef.current.scrollTo({ top: y, behavior: 'smooth' })
		}
	}, [debugInfo, pc2Idx, props.nes])

	const addDebugInfo = useCallback(() => {
		const info = props.nes.debugInfo()
		if (debugInfo && debugInfo.cpuStatus.cyc === info.cpuStatus.cyc) {
			return
		}
		setDebugInfo(info)
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

	const onCycle = () => {
		try {
			props.nes.tick()
		} catch (e) {
			setError(e)
		}
		nesRender()
		addDebugInfo()
	}

	const onStep = () => {
		try {
			for (let i = 0; i < stepCount; i++) {
				props.nes.stepToNextInstruction()
			}
		} catch (e) {
			setError(e)
		}
		nesRender()
		addDebugInfo()
	}
	const onFrame = () => {
		try {
			props.nes.frame(frameCount)
		} catch (e) {
			setError(e)
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
		setDebugInfo(null)
		setError(null)
		nesRender()
	}

	useEffect(() => {
		props.nes.setLogger(new Logger(new ConsoleLogSink(), "NES"))
		return () => {
			props.nes.setLogger(undefined)
		}
	}, [props.nes])

	const leftSide = <div>
		<div>
			<ErrorBanner error={error} />
			<div>
				<button onClick={reset}>reset</button>
			</div>
			<div>
				<button onClick={onCycle}>cycle</button>
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
		{debugInfo ? <DebugInfo info={debugInfo}></DebugInfo> : null}
		<div>
			<canvas ref={charsCanvasRef}></canvas>
		</div>
		<div>
			<canvas ref={colorsCanvasRef}></canvas>
		</div>
	</div>
	const rightSide = <>{disaTable}</>

	return <div style={{ display: "flex" }}>
		<span>
			{leftSide}
		</span>
		<span>
			{rightSide}
		</span>
	</div>
}

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
		const sampleRate = ctx.sampleRate
		if (sampleRate != 44100) {
			throw new Error(`sampleRate = ${sampleRate} want 44100`)
		}
		const bufferSize = 1024 * 4
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

		<div style={{ height: 50, borderStyle: "inset" }}
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

	let nesView = null
	if (cartridgeData) {
		try {
			nesView = <Game nes={NES.NES.fromCartridgeData(cartridgeData)} />
		} catch (e) {
			console.error(e)
			nesView = <ErrorBanner error={e.toString()} />
		}
	}

	return <div>
		<FileChooser onChange={setCartridgeData} />
		{nesView}
	</div>
}
