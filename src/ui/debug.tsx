import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as NES from '../nes'
import * as Color from '../ppu/color'
import * as PPU from '../ppu/ppu'
import { ConsoleLogSink, Logger } from '../logger'
import { CPU } from '../cpu'

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
const TableRow = (props: { row: Array<string> }) => {
	return <tr>
		{
			props.row.map((x, i) => {
				return <td key={i}>{x}</td>
			})
		}
	</tr>
}
const PPUInfo = (props: { ppu: PPU.PPU }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const charsCanvasRef = useRef<HTMLCanvasElement>(null)
	const colorsCanvasRef = useRef<HTMLCanvasElement>(null)

	const ppu = props.ppu

	useEffect(() => {
		if (!canvasRef.current) {
			return
		}
		const canvas = canvasRef.current
		ppu.renderNametable(canvas)
	}, [props.ppu])

	useEffect(() => {
		const cvs = charsCanvasRef.current
		if (!cvs) {
			return
		}
		props.ppu.renderCharacters(cvs)
	}, [props.ppu])

	useEffect(() => {
		const cvs = colorsCanvasRef.current
		if (!cvs) {
			return
		}
		Color.render(cvs)
	}, [props.ppu])

	const states = [
		["frame", ppu.frameCount],
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
	const stateTable = <table><tbody>
		{states}
	</tbody></table>

	return <div>
		<div style={{ display: "flex" }}>
			<span>
				{stateTable}
			</span>
			<span>
				<SpriteInfo oam={ppu.bus.oam} />
			</span>
		</div>
		<PPUPalettes universal={ppu.bus.universalBackgroundColor}
			bg={ppu.bus.backgroundPalettes}
			sprite={ppu.bus.spritePalettes} />
		<div style={{ marginTop: "1px" }}>
			<canvas ref={canvasRef}></canvas>
		</div>
		<canvas ref={charsCanvasRef} />
		<canvas ref={colorsCanvasRef} />
	</div>
}

const CPUInfo = (props: { cpu: CPU }) => {
	const cpu = props.cpu
	const pc = cpu.getPC()

	const disaList = useMemo(() => cpu.disasm(10), [props.cpu, pc])

	const disaTable =
		<div style={{ width: "200px" }}>
			<table><tbody>
				{disaList.map(([pc, s], i) => {
					return <tr key={i} style={{
						backgroundColor: pc === cpu.getPC()
							? "lightyellow" : undefined
					}}>
						<td>{pc.toString(16).toUpperCase()}</td>
						<td>{s}</td>
					</tr>
				})}
			</tbody></table>
		</div>

	return <div>
		<div>
			<table>
				<tbody>
					{
						[
							["PC", "0x" + cpu.getPC().toString(16).toUpperCase()],
							["A", "0x" + cpu.A.toString(16).toUpperCase()],
							["X", "0x" + cpu.X.toString(16).toUpperCase()],
							["Y", "0x" + cpu.Y.toString(16).toUpperCase()],
							["P", "0b" + cpu.getP().toString(2)],
							["S", "0x" + cpu.S.toString(16).toUpperCase()],
						].map(([s, x], i) => {
							const id = "" + i
							return <TableRow key={id} row={[s as string, x]} />
						})
					}
					<TableRow key="cyc" row={["CYC", "" + cpu.cycle]}></TableRow>
					<TableRow key="instr" row={["INSTR", "" + cpu.instructionCount]}></TableRow>
				</tbody>
			</table>
		</div>
		{disaTable}
	</div>
}

const UserInteraction = (props: { nes: NES.NES, onChange: () => void }) => {
	const gameCanvasRef = useRef<HTMLCanvasElement>(null)
	const [buttons, setButtons] = useState(0)
	const [error, setError] = useState<Error | null>(null)

	const [stepCount, setStepCount] = useState(1)
	const [frameCount, setFrameCount] = useState(1)

	const nesRender = useCallback(() => {
		const ctx = gameCanvasRef.current?.getContext('2d')
		if (!ctx) {
			return
		}
		props.nes.render(ctx)
	}, [props.nes])

	useEffect(() => {
		nesRender()
	}, [nesRender, props.nes])

	const onCycle = () => {
		try {
			props.nes.tick()
		} catch (e) {
			setError(e)
		}
		nesRender()
		props.onChange()
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
		props.onChange()
	}
	const onFrame = () => {
		try {
			props.nes.frame(frameCount)
		} catch (e) {
			setError(e)
		}
		nesRender()
		props.onChange()
	}


	useEffect(() => {
		props.nes.setControllerState(1, buttons)
	}, [buttons, props.nes])

	const buttonsComponent =
		["A", "B", "SELECT", "START", "UP", "DOWN", "LEFT", "RIGHT"].map((s, i) => {
			return <div key={i}>
				<input type="checkbox" value={buttons >> i & 1} onChange={(e) => {
					setButtons((buttons) => {
						return buttons & ~(1 << i) | (e.target.checked ? 1 << i : 0)
					})
				}} />{s}
			</div>
		})

	const reset = () => {
		props.nes.resetAll()
		setError(null)
		nesRender()
		props.onChange()
	}

	return <div>
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
	</div>
}

export const DebugGame = (props: { nes: NES.NES }): JSX.Element => {
	// dummy state to tell when to update the view.
	const [updateCounter, setUpdateCounter] = useState(0)

	useEffect(() => {
		props.nes.setLogger(new Logger(new ConsoleLogSink(), "NES"))
		return () => {
			props.nes.setLogger(undefined)
		}
	}, [props.nes])

	return <div style={{ display: "flex" }}>
		<UserInteraction nes={props.nes} onChange={() => setUpdateCounter((x) => x + 1)} />
		<CPUInfo cpu={props.nes.cpu} />
		<PPUInfo ppu={props.nes.ppu} />
	</div>
}

export const ErrorBanner = (props: { error: Error | null }): JSX.Element | null => {
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
