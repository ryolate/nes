let debugMode = false

export const setDebugMode = (x: boolean): void => {
	debugMode = x
}

export const isDebugMode = (): boolean => {
	return debugMode
}

export const debug = (x: unknown): void => {
	if (debugMode) {
		console.log(x)
	}
}
