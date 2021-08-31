import React, { useEffect, useState } from 'react'
import firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/firestore'

import * as firebase_util from './firebase_util'
import { ErrorBanner } from '../../ui/debug'

firebase_util.initOnce(false)

// ${timestamp}-${hash} -> $testRom -> $URL
interface ResultsSchema {
	[version: string]: {
		[testROM: string]: {
			imageSHA1: string,
			url: string
		}
	}
}

const ResultsView = (props: { results: ResultsSchema }) => {
	const urls = new Map<string, Map<string, string>>() // rom -> version -> url

	for (const [version, entries] of Object.entries(props.results)) {
		for (const [testROM, entry] of Object.entries(entries)) {
			if (["id", "timestamp"].includes(testROM)) {
				continue
			}
			if (!urls.has(testROM)) {
				urls.set(testROM, new Map())
			}
			urls.get(testROM)?.set(version, entry.url)
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
			<td><div style={{ width: 128, overflowWrap: "break-word" }}>{testROM}</div></td>
			{
				versions.map((version) => {
					const url = urls.get(testROM)?.get(version)
					if (!url) {
						return <td></td>
					}
					return <td key={version}>
						<a href={url} target="_blank" rel="noreferrer">
							<img width="128" height="120" src={url}></img>
						</a>
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
	useEffect(() => {
		async function f() {
			const documentLimit = 5
			const res = await firebase.firestore().collection('results')
				.orderBy("id", 'desc')
				.limit(documentLimit)
				.get()

			const results = {} as ResultsSchema
			res.forEach(x => {
				results[x.id] = x.data()
			})
			setResults(results)
		}
		f().catch(console.error)
	}, [])

	return <div>
		<ResultsView results={results} />
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
