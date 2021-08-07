import React, { useRef, useEffect, useState } from 'react'
import * as NES from './nes'
import sampleROMPath from './asset/hello.nes'
import { Cartridge } from './cartridge'

const DebugInfo = (props: { cartridgeData: Uint8Array }) => {
	const cartridge = Cartridge.parseINES(props.cartridgeData)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current!
		cartridge.renderCharacters(canvas)
	}, [props.cartridgeData])

	return <>
		<canvas ref={canvasRef}></canvas>
	</>
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

			props.nes.step(elapsed)
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

export const App = () => {
	const [cartridgeData, setCartridgeData] = useState<Uint8Array | null>(null)

	return <div>
		{cartridgeData ? <RealGame nes={new NES.NES(cartridgeData)} /> : null}
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
