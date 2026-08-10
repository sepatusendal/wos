const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 32;
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
export function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
export function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
export async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, { name: ALGORITHM, length: KEY_LENGTH }, false, ['encrypt', 'decrypt']);
}
export function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}
export async function encrypt(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return {
        ciphertext: bytesToBase64(combined),
        iv: bytesToBase64(iv),
    };
}
export async function decrypt(ciphertext, key) {
    const combined = base64ToBytes(ciphertext);
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data);
    return new TextDecoder().decode(decrypted);
}
export async function encryptVaultData(data, password) {
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const { ciphertext } = await encrypt(data, key);
    return { encrypted: ciphertext, salt: bytesToBase64(salt) };
}
export async function decryptVaultData(encrypted, salt, password) {
    try {
        const saltBytes = base64ToBytes(salt);
        const key = await deriveKey(password, saltBytes);
        return await decrypt(encrypted, key);
    }
    catch {
        throw new Error('Invalid encrypted data or password');
    }
}
export async function hashPassword(password) {
    const salt = generateSalt();
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, KEY_LENGTH);
    const hash = bytesToBase64(new Uint8Array(bits));
    const saltB64 = bytesToBase64(salt);
    return `${saltB64}:${hash}`;
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
export async function verifyPassword(password, stored) {
    const [saltB64, expectedHash] = stored.split(':');
    if (!saltB64 || !expectedHash)
        return false;
    try {
        const salt = base64ToBytes(saltB64);
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, KEY_LENGTH);
        const hash = bytesToBase64(new Uint8Array(bits));
        return constantTimeEqual(hash, expectedHash);
    }
    catch {
        return false;
    }
}
export function generateId() {
    return crypto.randomUUID();
}
//# sourceMappingURL=crypto.js.map