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
		[testROM: string]: string // URL
	}
}

const View2 = (props: { results: ResultsSchema }) => {
	const urls = new Map<string, Map<string, string>>() // rom -> version -> url

	for (const [version, entries] of Object.entries(props.results)) {
		for (const [testROM, url] of Object.entries(entries)) {
			if (!urls.has(testROM)) {
				urls.set(testROM, new Map())
			}
			urls.get(testROM)?.set(version, url)
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
						<img width="128" height="120" src={url}></img>
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

const Test = (): JSX.Element => {
	const [results, setResults] = useState<ResultsSchema>({})
	useEffect(() => {
		async function f() {
			const documentLimit = 2
			const query = firebase.firestore().collection('results')
				.orderBy(firebase.firestore.FieldPath.documentId())
				.limit(documentLimit)
			const res = await query.get()

			const results = {} as ResultsSchema
			res.forEach(x => {
				results[x.id] = x.data()
			})
			setResults(results)
		}
		f().catch(console.error)
	}, [])


	return <div>
		<View2 results={results} />
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

const View = (props: { items: Array<StorageItem> }): JSX.Element => {
	const urls = new Map<string, Map<string, string>>() // rom -> version -> url
	const versionSet = new Set<string>()

	for (const item of props.items) {
		// Get URL for image element.
		// https://firebase.google.com/docs/storage/web/download-files
		const [version, ...testROMPath] = item.fullPath.split("/")
		const testROM = testROMPath.join("/")
		if (!urls.has(testROM)) {
			urls.set(testROM, new Map())
		}
		urls.get(testROM)?.set(version, item.downloadURL)
		versionSet.add(version)
	}

	const versions = new Array<string>(...versionSet).sort().reverse()
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
						<img width="128" height="120" src={url}></img>
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

async function walk(dir: firebase.storage.Reference): Promise<Array<firebase.storage.Reference>> {
	const { items, prefixes } = await dir.list()
	const values = await Promise.all(prefixes.map((prefix) => walk(prefix)))
	return items.concat(values.flat())
}

interface StorageItem {
	downloadURL: string
	fullPath: string
}

export const App = (): JSX.Element => {
	const [reloadCount, setReloadCount] = useState(0)
	const [loading, setLoading] = useState(false)
	const [allItems, setAllItems] = useState<Array<StorageItem>>()
	const [error, setError] = useState<Error | null>(null)
	useEffect(() => {
		setLoading(true)
		const f = async () => {
			console.log(`${performance.now()}: listing`)
			const sub = await firebase.storage().ref().list()

			// choose 10 Most recently created subdirs
			const subdirs = sub.prefixes.slice().sort((a, b) => {
				return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
			}).slice(-10)

			console.log(`${performance.now()}: walk`)
			const paths = (await Promise.all(subdirs.map((subdir) => walk(subdir)))).flat()

			const items = Promise.all(paths.map(async (path) => {
				return {
					downloadURL: await path.getDownloadURL(),
					fullPath: path.fullPath,
				}
			}))

			console.log(`${performance.now()}: setAllItems`)

			setAllItems(await items)
			setLoading(false)

			console.log(`${performance.now()}: done`)
		}
		f().catch((e) => {
			setError(e)
			setLoading(false)
		})
	}, [reloadCount])

	return <div>
		<Test />
		< button disabled={loading} onClick={() => setReloadCount(x => x + 1)}>{loading ? "Loading..." : "Reload"}</button >
		{allItems ? <View items={allItems} /> : null}
		<ErrorBanner error={error} />
	</div>
}
