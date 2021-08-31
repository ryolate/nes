// https://javascript.plainenglish.io/working-with-indexeddb-in-typescript-react-ad504a1bdae3
import * as idb from 'idb';

export class DB<T> {
	private readonly db: idb.IDBPDatabase;

	private constructor(db: idb.IDBPDatabase) {
		this.db = db
	}

	static async open<T>(database: string): Promise<DB<T>> {
		const db = await idb.openDB(database, 2, {
			upgrade(db) {
				db.createObjectStore('keyval');
			},
		});
		return new DB(db)
	}

	async get(): Promise<T> {
		return await this.db.get("keyval", "dummy")
	}

	async set(data: T): Promise<void> {
		await this.db.put('keyval', data, "dummy")
	}
}
