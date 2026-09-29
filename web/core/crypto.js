
/**
 * PIN checking and private-name encryption, using the browser's built-in Web Crypto.
 *
 * Web Crypto only works on secure pages; 127.0.0.1 counts as one.
 */

const ITERATIONS = 150000; // slow on purpose, so guessing is expensive

/**
 * Makes the record stored to check a PIN later.
 * @returns {Promise<{salt: string, iterations: number, hash: string}>}
 */
export async function createPinRecord(pin) {
	const salt = randomBytes(16);
	return { salt: toHex(salt), iterations: ITERATIONS, hash: await derive(pin, salt, ITERATIONS) };
}

/** True if `pin` matches a record made by createPinRecord(). */
export async function checkPin(pin, record) {
	return (await derive(pin, fromHex(record.salt), record.iterations)) === record.hash;
}

/** A new random salt, as hex. */
export function newSalt() {
	return toHex(randomBytes(16));
}

/** The encryption key for private names (never stored; kept in memory while logged in). */
export async function deriveNameKey(pin, saltHex, iterations = ITERATIONS) {
	const material = await pinMaterial(pin, 'deriveKey');
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	);
}

/** Encrypts text into { iv, data } (both hex), with a fresh random iv every time. */
export async function encryptText(key, text) {
	const iv = randomBytes(12);
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
	return { iv: toHex(iv), data: toHex(new Uint8Array(data)) };
}

/** Decrypts { iv, data } back into text (throws if the key is wrong). */
export async function decryptText(key, box) {
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(box.iv) }, key, fromHex(box.data));
	return new TextDecoder().decode(plain);
}

async function derive(pin, salt, iterations) {
	const material = await pinMaterial(pin, 'deriveBits');
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
	return toHex(new Uint8Array(bits));
}

/** The PIN as PBKDF2 key material, for `usage` ('deriveBits' or 'deriveKey'). */
function pinMaterial(pin, usage) {
	return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [usage]);
}

function randomBytes(count) {
	return crypto.getRandomValues(new Uint8Array(count));
}

function toHex(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
	return new Uint8Array(hex.match(/../g).map((pair) => parseInt(pair, 16)));
}
