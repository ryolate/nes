import React, { useEffect, useState } from 'react'
import firebase from 'firebase/app'
import 'firebase/storage'

import * as firebase_util from './firebase_util'

function parseVersion(version: string): {
	timestamp: Date,
	hash: string
} {
	const [timestampStr, ...hash] = version.split("-")
	return {
		timestamp: new Date(parseInt(timestampStr)),
		hash: hash.join("-"),
	}
}

export const View = (props: { items: Array<StorageItem> }): JSX.Element => {
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

	const versions = new Array<string>(...versionSet).sort()
	const testROMs = new Array<string>(...urls.keys()).sort()

	const header = <tr>
		<th></th>
		{versions.map(version => {
			const { timestamp, hash } = parseVersion(version)
			return <th key={hash} >
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
	useEffect(() => {
		firebase_util.initOnce()
		setLoading(true)
		const f = async () => {
			performance.mark("list")
			const sub = await firebase.storage().ref().list()
			performance.measure("list")
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
		f().catch(console.error)
	}, [reloadCount])

	return <div>
		< button disabled={loading} onClick={() => setReloadCount(x => x + 1)}>{loading ? "Loading..." : "Reload"}</button >
		{allItems ? <View items={allItems} /> : null}
	</div>
}
