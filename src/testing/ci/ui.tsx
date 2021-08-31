import React, { useEffect, useState } from 'react'
import firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/firestore'

import * as firebase_util from './firebase_util'

firebase_util.initOnce(false)

const Dropdown = (props: { items: Array<string>, onClick: (item: string) => void }) => {
	return <ul>
		{props.items.map(item => {
			return <li key={item} onClick={() => props.onClick(item)}>{item}</li>
		})}
	</ul>
}

function Image(props: { src: string, status: "correct" | "wrong" | "unknown", onMarkAsCorrect: (correct: boolean) => void }) {
	const { src, status, onMarkAsCorrect } = props

	const [selected, setSelected] = useState(false)

	const img = < img width={selected ? 256 + 8 : 128 + 8} src={src} onClick={() => {
		setSelected(!selected)
	}} style={{
		padding: 4,
		backgroundColor: status === "correct" ? "lightgreen" : status === "wrong" ? "#FF7F7F" : undefined,
	}} />

	const mark = "mark as " + (status === "correct" ? "unknown" : "correct")

	const selection = <Dropdown items={["open", mark]} onClick={item => {
		switch (item) {
			case "open":
				open(src)
				break
			case mark:
				onMarkAsCorrect(status !== "correct")
				break
		}
		setSelected(false)
	}} />

	return <div>
		{img}
		{selected ? selection : null}
	</div>
}

// ${timestamp}-${hash} -> $testRom -> $URL
interface ResultsSchema {
	[version: string]: {
		[testROM: string]: {
			imageSHA1: string,
			url: string
		}
	}
}

interface AnswersSchema {
	[testROM: string]: string // sha1
}

const ResultsView = (props: { results: ResultsSchema, answers: AnswersSchema, onMarkAs: (testROM: string, sha1: string, correct: boolean) => void }) => {
	const urls = new Map<string, Map<string, { url: string, sha1: string }>>() // rom -> version -> result

	for (const [version, entries] of Object.entries(props.results)) {
		for (const [testROM, entry] of Object.entries(entries)) {
			if (["id", "timestamp"].includes(testROM)) {
				continue
			}
			if (!urls.has(testROM)) {
				urls.set(testROM, new Map())
			}

			urls.get(testROM)?.set(version, {
				url: entry.url,
				sha1: entry.imageSHA1,
			})
		}
	}

	const versions = Object.keys(props.results).sort().reverse()
	const testROMs = new Array<string>(...urls.keys()).sort()

	const header = <tr>
		<th></th>
		{versions.map(version => {
			const { timestamp, hash } = parseVersion(version)
			return <th key={hash} title={timestamp.toString()}>
				<div style={{ width: 128, overflowWrap: "break-word" }}>
					{hash}
				</div>
			</th>
		})
		}
	</tr>

	const rows = testROMs.map(testROM => {
		return <tr key={testROM}>
			<td><div style={{ width: 192, overflowWrap: "break-word" }}>{(() => {
				const [dir, rom] = testROM.split(":")
				return <>
					<p>
						<a href={"https://github.com/christopherpow/nes-test-roms/tree/master/" + dir}>{dir}
						</a>
					</p>
					<p>{rom}</p>
				</>
			})()}</div></td>
			{
				versions.map((version) => {
					const result = urls.get(testROM)?.get(version)
					if (!result || !result.sha1 || !result.url) {
						return <td key={version}></td>
					}

					const correctSHA1 = props.answers[testROM]

					const status = correctSHA1 ?
						(correctSHA1 === result.sha1 ? "correct" : "wrong") :
						"unknown"

					return <td key={version}>
						<Image src={result.url} status={status} onMarkAsCorrect={(correct: boolean) => {
							props.onMarkAs(testROM, result.sha1, correct)
						}} />
					</td>
				})
			}
		</tr >
	})

	return <table>
		<thead>{header}</thead>
		<tbody>{rows}</tbody>
	</table>
}

const Results = (): JSX.Element => {
	const [results, setResults] = useState<ResultsSchema>({})
	const [answers, setAnswers] = useState<AnswersSchema>({})

	useEffect(() => {
		async function f() {
			const documentLimit = 20
			const res = await firebase.firestore().collection('results')
				.orderBy("id", 'desc')
				.limit(documentLimit)
				.get()

			const results = {} as ResultsSchema
			res.forEach(x => {
				results[x.id] = x.data()
			})
			setResults(results)

			const storedAnswers = (await firebase.firestore().collection("answers").doc("sha1").get()).data()

			if (storedAnswers) {
				const answers = {} as AnswersSchema
				for (const [testROM, sha1] of Object.entries(storedAnswers)) {
					answers[testROM] = sha1
				}
				setAnswers(cur => Object.assign(answers, cur))
			}
		}
		f().catch(console.error)
	}, [])

	return <div>
		<ResultsView results={results} answers={answers} onMarkAs={(testROM: string, sha1: string, correct: boolean) => {
			async function f() {
				console.log(`onMarkAs(${testROM}, ${correct})`)
				if (correct) {
					await firebase.firestore().collection("answers").doc("sha1").set({
						[testROM]: sha1,
					}, { merge: true })
					setAnswers(cur => {
						const ans = Object.assign({}, cur)
						ans[testROM] = sha1
						return ans
					})
					return
				}

				// We must use FieldPath for paths containig dots.
				// https://stackoverflow.com/questions/49643235/firestore-how-to-update-a-field-that-contains-period-in-its-key-from-andro
				await firebase.firestore().collection("answers").doc("sha1").update(
					new firebase.firestore.FieldPath(testROM), firebase.firestore.FieldValue.delete()
				)
				console.log(`onMarkAs(${testROM}, ${correct})`)

				setAnswers(cur => {
					const ans = Object.assign({}, cur)
					delete ans[testROM]
					return ans
				})
			}
			f().catch(console.error)
		}} />
	</div>
}

function parseVersion(version: string): {
	timestamp: Date,
	hash: string
} {
	const [timestampStr, ...hash] = version.split("-")
	return {
		timestamp: new Date(parseInt(timestampStr) * 1000),
		hash: hash.join("-"),
	}
}


export const App = (): JSX.Element => {
	return <div>
		<Results />
	</div>
}
