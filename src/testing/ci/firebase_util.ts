import firebase from "firebase/app";
import "firebase/storage";

let firebaseInitialized = false
export function initOnce(): void {
	if (firebaseInitialized) {
		return
	}
	firebaseInitialized = true

	const firebaseConfig = {
		apiKey: "AIzaSyBkwlf9s468l_DjAtlpgGnWUVZK4ub_dp0",
		authDomain: "tsnes-324212.firebaseapp.com",
		projectId: "tsnes-324212",
		storageBucket: "tsnes-324212.appspot.com",
		messagingSenderId: "759252247703",
		appId: "1:759252247703:web:550805e63288ee8274f5d2",
		measurementId: "G-4JDYDDZCKK"
	};
	firebase.initializeApp(firebaseConfig)
}
