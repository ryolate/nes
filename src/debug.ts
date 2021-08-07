let debugMode = false

export const setDebugMode = (x: boolean) => {
	debugMode = x
}

export const debug = (x: any) => {
	if (debugMode) {
		console.log(x)
	}
}
