import CryptoJS from "crypto-js";

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  return key;
}

/**
 * Encrypt a string using AES-256
 */
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
}

/**
 * Decrypt an AES-256 encrypted string
 */
export function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, getEncryptionKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Hash a string using SHA-256
 */
export function hash(text: string): string {
  return CryptoJS.SHA256(text).toString();
}

/**
 * Generate a random string of specified length
 */
export function generateSecret(length: number = 32): string {
  return CryptoJS.lib.WordArray.random(length).toString();
}
