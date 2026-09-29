
/**
 * Keeps private habit names encrypted in the data file.
 *
 * While logged in, private habits have their plain `name` in memory only; the file
 * gets `nameEncrypted`. Locking (logging out) wipes the key and the plain names.
 */

import { deriveNameKey, encryptText, decryptText } from '../core/crypto.js';

export class PrivateNames {
	#key = null;
	#sealed = new Map(); // habit id -> the name its nameEncrypted holds

	/** True while the key is known (logged in). */
	get unlocked() {
		return this.#key !== null;
	}

	/** Makes the key from the PIN. */
	async unlock(pin, keySalt) {
		this.#key = await deriveNameKey(pin, keySalt);
	}

	/** Decrypts every private name into memory. */
	async open(habits) {
		for (const habit of habits) {
			if (!habit.private || !habit.nameEncrypted) continue;
			try {
				habit.name = await decryptText(this.#key, habit.nameEncrypted);
				this.#sealed.set(habit.id, habit.name);
			} catch (error) {
				console.error('Could not decrypt a private habit', error);
			}
		}
	}

	/** Encrypts private names that are new or changed. Does nothing while locked. */
	async seal(habits) {
		if (!this.unlocked) return;
		for (const habit of habits) {
			if (habit.private && habit.name !== null && this.#sealed.get(habit.id) !== habit.name) {
				const name = habit.name;
				habit.nameEncrypted = await encryptText(this.#key, name);
				this.#sealed.set(habit.id, name);
			}
		}
	}

	/** Forgets the key and every decrypted private name. */
	lock(habits) {
		this.#key = null;
		this.#sealed.clear();
		for (const habit of habits) {
			if (habit.private && habit.nameEncrypted) habit.name = null;
		}
	}
}
