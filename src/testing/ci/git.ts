import * as child_process from 'node:child_process'
import * as util from 'node:util'

export async function headHash(): Promise<string> {
	const res = await util.promisify(child_process.exec)('git rev-parse HEAD')
	return res.stdout.trim()
}

async function dirtyFilesInner(): Promise<Array<string>> {
	const res = await util.promisify(child_process.exec)('git status -s')
	return res.stdout.trim().split("\n").map((line) => line.trim().split(/ +/)[1])
}

export async function dirtyFiles(except: Array<RegExp>): Promise<Array<string>> {
	const files = await dirtyFilesInner()
	return files.filter((f) => except.every((r) => !r.test(f)))
}

export async function isClean(except: Array<RegExp>): Promise<boolean> {
	return (await dirtyFiles(except)).length === 0
}
