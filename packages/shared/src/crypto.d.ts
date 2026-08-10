export declare function base64ToBytes(b64: string): Uint8Array;
export declare function bytesToBase64(bytes: Uint8Array): string;
export declare function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
export declare function generateSalt(): Uint8Array;
export declare function encrypt(plaintext: string, key: CryptoKey): Promise<{
    ciphertext: string;
    iv: string;
}>;
export declare function decrypt(ciphertext: string, key: CryptoKey): Promise<string>;
export declare function encryptVaultData(data: string, password: string): Promise<{
    encrypted: string;
    salt: string;
}>;
export declare function decryptVaultData(encrypted: string, salt: string, password: string): Promise<string>;
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, stored: string): Promise<boolean>;
export declare function generateId(): string;
//# sourceMappingURL=crypto.d.ts.map