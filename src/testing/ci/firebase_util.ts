import firebase from "firebase/app";
import "firebase/storage";

const commonFirebaseConfig = {
	storageBucket: "tsnes-324212.appspot.com",
}

let calledDevParam: boolean | undefined = undefined
export function init(dev: boolean): void {
	if (calledDevParam !== undefined) {
		if (calledDevParam != dev) {
			throw new Error(`unexpected dev = ${dev}`)
		}
		return
	}
	calledDevParam = dev

	if (dev) {
		devInit()
		return
	}

	firebase.initializeApp({
		...commonFirebaseConfig,
		apiKey: "AIzaSyBkwlf9s468l_DjAtlpgGnWUVZK4ub_dp0",
		authDomain: "tsnes-324212.firebaseapp.com",
		projectId: "tsnes-324212",
		messagingSenderId: "759252247703",
		appId: "1:759252247703:web:550805e63288ee8274f5d2",
		measurementId: "G-4JDYDDZCKK"
	})
}

export function devInit(): void {
	firebase.initializeApp(commonFirebaseConfig)
	firebase.storage().useEmulator("localhost", 9199);
	console.log(`firebase.storage() now use emulator`)
}
