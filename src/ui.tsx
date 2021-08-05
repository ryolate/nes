import React, { useRef, useEffect, useState } from 'react'
import * as NES from './nes'
import sampleROMPath from './asset/hello.nes'
import { Cartridge } from './cartridge'

const gameRunner = (canvas: HTMLCanvasElement, cartridgeData: Uint8Array): {
	render: (timestamp: DOMHighResTimeStamp) => void
	close: () => void
} => {
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

	document.addEventListener("keydown", keydownListener)
	document.addEventListener("keyup", keyupListener)

	function keydownListener(e: KeyboardEvent) {
		// TODO: update controller state
	}

	function keyupListener(e: KeyboardEvent) {
		// if (e.key == "j") leftPressed = false
		// else if (e.key == "l") rightPressed = false
	}

	let prevTimestamp: DOMHighResTimeStamp
	const nes = new NES.Console(cartridgeData)

	// callback of requestAnimationFrame
	function render(timestamp: DOMHighResTimeStamp) {
		if (prevTimestamp === undefined) {
			prevTimestamp = timestamp
			return
		}
		const elapsed = timestamp - prevTimestamp
		prevTimestamp = timestamp

		nes.step(elapsed)
		nes.render(ctx)
	}

	return {
		render: render,
		close: () => {
			document.removeEventListener("keydown", keydownListener)
			document.removeEventListener("keyup", keyupListener)
		}
	}
}

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

const Game = (props: { cartridgeData: Uint8Array }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [fps, setFPS] = useState(0)

	useEffect(() => {
		const canvas = canvasRef.current!

		const g = gameRunner(canvas, props.cartridgeData)

		let prevSecond: DOMHighResTimeStamp
		let countInSecond = 0

		let reqId: number
		const render = (timestamp: DOMHighResTimeStamp) => {
			g.render(timestamp)
			reqId = requestAnimationFrame(render)

			const currentSecond = Math.floor(timestamp / 1000)
			if (prevSecond === undefined) {
				prevSecond = currentSecond
				return
			}
			countInSecond++
			if (prevSecond < currentSecond) {
				setFPS(countInSecond)
				prevSecond = currentSecond
				countInSecond = 0
			}
		}
		render(performance.now())
		return () => {
			g.close()
			cancelAnimationFrame(reqId)
		}
	}, [props.cartridgeData])

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
			<div className="col-3">
				Use the keyboard to control:
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
		<DebugInfo cartridgeData={props.cartridgeData} />
	</>
}

export const App = () => {
	const [filePath, setFilePath] = useState<string>(sampleROMPath)
	const [cartridgeData, setCartridgeData] = useState<Uint8Array | null>(null)

	useEffect(() => {
		fetch(filePath).then((response) => {
			return response.blob()
		}).then((blob) => {
			return blob.arrayBuffer()
		}).then((data) => {
			setCartridgeData(new Uint8Array(data))
		})
	}, [filePath])

	const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e === null) {
			return
		}
		const file = e.target.files![0]
		const path = URL.createObjectURL(file)
		setFilePath(path)
	}

	if (cartridgeData == null) {
		return <></>
	}
	return <>
		<Game cartridgeData={cartridgeData!} />
		<div>
			<label>Choose .nes file</label>
			<input type="file" onChange={onFileChange} />
		</div>
	</>
}
