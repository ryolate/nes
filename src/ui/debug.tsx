import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as NES from '../nes/nes'
import * as Color from '../nes/ppu/color'
import * as PPU from '../nes/ppu/ppu'
import { ConsoleLogSink, Logger } from '../nes/logger'
import { CPU } from '../nes/cpu/cpu'
import { Cartridge } from '../nes/mappers/cartridge'
import { Mapper } from '../nes/mappers/mapper'
import { APU } from '../nes/apu/apu'

const withHeader = (title: string, e: JSX.Element) => {
	return <div>
		<label><strong>{title}</strong></label>
		{e}
	</div>
}

const APUView = (props: { apu: APU }) => {
	const { apu } = props

	return withHeader("APU", <div>
		<table>
			<tbody>
				{
					[
						["DMC.irqEnabled", "" + apu.dmc.irqEnabled],
						["DMC.loop", "" + apu.dmc.loop],
						["DMC.rateIndex", "" + apu.dmc.rateIndex],
						["DMC.outputLevel", "" + apu.dmc.outputLevel],
						["DMC.sampleAddress", "$" + apu.dmc.sampleAddress.toString(16).toUpperCase()],
						["DMC.sampleLength", "" + apu.dmc.sampleLength],
						["DMC.readBytesRemaining", "" + apu.dmc.readBytesRemaining],
						["DMC.interruptFlag", "" + apu.dmc.interruptFlag],
						["DMC.outputSilence", "" + apu.dmc.outputSilence],
						["DMC.sampleBuffer", "" + apu.dmc.sampleBuffer],

					].map(([name, value], i) => {
						return <TableRow key={i} row={[name, value]} />
					})
				}
			</tbody>
		</table>
	</div>)
}

const PaletteColor = (props: { color: number }) => {
	const sz = 10
	const [r, g, b] = Color.toRGB(props.color)
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

const SpriteView = (props: { oam: Array<number> }) => {
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
const TableRow = (props: { row: Array<string>, width?: number }) => {
	return <tr>
		{
			props.row.map((x, i) => {
				return <td key={i} style={{ minWidth: props.width }}>{x}</td>
			})
		}
	</tr >
}

const NametableView = (props: { ppu: PPU.PPU }) => {
	const { ppu } = props

	const nametableCanvasRef = useRef<HTMLCanvasElement>(null)

	const [cursor, setCursor] = useState([0, 0])
	const [focus, setFocus] = useState(false)

	const tileInfo = ppu.getNametableTileInfo(cursor[0], cursor[1])

	useEffect(() => {
		if (!nametableCanvasRef.current) {
			return
		}
		const canvas = nametableCanvasRef.current
		ppu.renderNametable(canvas)
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			return
		}
		ctx.strokeStyle = 'red'
		const [x, y] = cursor
		ctx.strokeRect(x * 8 + 1, y * 8 + 1, 8, 8)
	}, [ppu, cursor])

	useEffect(() => {
		if (!focus) {
			return
		}
		const keypressListener = (e: KeyboardEvent) => {
			const i = "asdw".indexOf(e.key)
			if (i < 0) {
				return
			}
			const dy = [0, 1, 0, -1]
			const dx = [-1, 0, 1, 0]
			setCursor(([x, y]) => {
				x += dx[i]
				y += dy[i]
				if (x < 0) x = 0
				if (x >= 64) x = 63
				if (y < 0) y = 0
				if (y >= 60) y = 59
				return [x, y]
			})
		}
		document.addEventListener("keypress", keypressListener)
		return () => {
			document.removeEventListener("keypress", keypressListener)
		}
	}, [focus])

	return <div style={{ display: "flex" }}>
		<canvas tabIndex={0} ref={nametableCanvasRef}
			onFocus={() => setFocus(true)}
			onBlur={() => setFocus(false)} />
		<div>
			<table><tbody>
				{
					[
						["PPU Addr", tileInfo.addr.toString(16).toUpperCase()],
						["Name Table", tileInfo.nameTable + ""],
						["Location", tileInfo.location.join(", ")],
						["Tile Index", tileInfo.tileIndex.toString(16).toUpperCase()],
						["Tile Addr", tileInfo.tileAddr.toString(16).toUpperCase()],
						["Attribute Data", tileInfo.attributeData.toString(16).toUpperCase()],
						["Attribute Addr", tileInfo.attributeAddr.toString(16).toUpperCase()],
						["Palette Addr", tileInfo.paletteAddr.toString(16).toUpperCase()],
					].map((row, i) => <TableRow key={i} row={row} width={120} />
					)
				}
			</tbody></table>
		</div>
	</div>
}

const PPUView = (props: { ppu: PPU.PPU }) => {
	const { ppu } = props

	const charsCanvasRef = useRef<HTMLCanvasElement>(null)
	const colorsCanvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const cvs = charsCanvasRef.current
		if (!cvs) {
			return
		}
		ppu.renderCharacters(cvs)
	})

	useEffect(() => {
		const cvs = colorsCanvasRef.current
		if (!cvs) {
			return
		}
		Color.render(cvs)
	}, [])

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
		// $2000
		["ctrlNMIEnable [$2000@7]", ppu.ctrlNMIEnable],
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
				<SpriteView oam={ppu.bus.oam} />
			</span>
		</div>
		<PPUPalettes universal={ppu.bus.universalBackgroundColor}
			bg={PPU.to2DPalettes(ppu.bus.backgroundPalettes)}
			sprite={ppu.bus.spritePalettes} />
		<div style={{ marginTop: "1px" }}>
			<NametableView ppu={ppu} />
		</div>
		<canvas ref={charsCanvasRef} />
		<canvas ref={colorsCanvasRef} />
	</div>
}

const CPUView = (props: { cpu: CPU }) => {
	const cpu = props.cpu
	const disaList = cpu.disasm(10)

	const disaTable =
		<div style={{ width: "200px" }}>
			<table><tbody>
				{disaList.map(([pc, s], i) => {
					return <tr key={i} style={{
						backgroundColor: pc === cpu.PC
							? "lightyellow" : undefined
					}}>
						<td>{pc.toString(16).toUpperCase()}</td>
						<td>{s}</td>
					</tr>
				})}
			</tbody></table>
		</div>

	return withHeader("CPU", <div>
		<table style={{ marginBottom: "2px" }}>
			<tbody>
				{
					[
						["PC", "0x" + cpu.PC.toString(16).toUpperCase()],
						["A", "0x" + cpu.A.toString(16).toUpperCase()],
						["X", "0x" + cpu.X.toString(16).toUpperCase()],
						["Y", "0x" + cpu.Y.toString(16).toUpperCase()],
						["P", "0b" + cpu.getP().toString(2)],
						["S", "0x" + cpu.S.toString(16).toUpperCase()],
						["CYC", "" + cpu.cycle],
						["INSTR", "" + cpu.instructionCount],
					].map(([name, value], i) => {
						return <TableRow key={i} row={[name, value]} />
					})
				}
			</tbody>
		</table>
		{disaTable}
	</div>)
}

const UserInteraction = (props: { nes: NES.NES, onChange: () => void, onReset: () => void }) => {
	const gameCanvasRef = useRef<HTMLCanvasElement>(null)
	const [buttons, setButtons] = useState(0)
	const [error, setError] = useState<Error | null>(null)

	const [cycleCount, setCycleCount] = useState(1)
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
			for (let i = 0; i < cycleCount; i++) {
				props.nes.tick()
			}
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
		setError(null)
		props.onReset()
	}

	return <div>
		<div>
			<ErrorBanner error={error} />
			<div>
				<button onClick={reset}>reset</button>
			</div>
			<div>
				<button onClick={onCycle}>cycle</button>
				<input min="1" type="number" value={cycleCount ? cycleCount : ""} onChange={(e) => {
					if (e.target.value === "") {
						setCycleCount(0)
					}
					setCycleCount(parseInt(e.target.value))
				}}></input>
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

const MapperView = (props: { mapper: Mapper }) => {
	return withHeader("Mapper", <table><tbody>
		{
			props.mapper.state().map(([name, value], i) => {
				return <TableRow key={i} row={[name, value]} />
			})
		}
	</tbody></table>)
}

const CartridgeView = (props: { cartridge: Cartridge }) => {
	return withHeader("Cartridge", <table><tbody>
		{
			[
				["Mapper", props.cartridge.header.mapper.toString(10)],
				["chrROMSize", "0x" + props.cartridge.header.chrROMSize.toString(16)],
				["mirroring", "" + props.cartridge.header.mirroring],
				["hasBatteryPackedPRGRAM", "" + props.cartridge.header.hasBatteryPackedPRGRAM],
				["prgROMSize", (props.cartridge.header.prgROMSize / 1024) + "K"],
			].map(([name, value], i) => {
				return <TableRow key={i} row={[name, value]} />
			})
		}
	</tbody></table>)
}

export const DebugGame = (props: { nes: NES.NES, onReset: () => void }): JSX.Element => {
	// dummy state to tell when to update the view.
	const [, setUpdateCounter] = useState(0)

	useEffect(() => {
		props.nes.setLogger(new Logger(new ConsoleLogSink(), "NES"))
		return () => {
			props.nes.setLogger(undefined)
		}
	}, [props.nes])

	return <div style={{ display: "flex" }}>
		<UserInteraction nes={props.nes} onChange={() => setUpdateCounter((x) => x + 1)} onReset={props.onReset} />
		<div>
			<CartridgeView cartridge={props.nes.mapper.cartridge} />
			<MapperView mapper={props.nes.mapper} />
			<APUView apu={props.nes.apu} />
			<CPUView cpu={props.nes.cpu} />
		</div>
		<PPUView ppu={props.nes.ppu} />
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
