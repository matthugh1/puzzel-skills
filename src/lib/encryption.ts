/**
 * Encryption utilities for sensitive data (OAuth tokens, API keys)
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return key;
}

/**
 * Derive encryption key from password using scrypt
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Encrypt data
 */
export function encrypt(plaintext: string): string {
  try {
    const password = getEncryptionKey();
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from password
    const key = Buffer.from(password, 'hex').slice(0, KEY_LENGTH);
    if (key.length !== KEY_LENGTH) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }

    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('app-integration-credentials')); // Additional authenticated data

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: salt:iv:authTag:encrypted
    return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data
 */
export function decrypt(ciphertext: string): string {
  try {
    const password = getEncryptionKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid ciphertext format');
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];

    // Derive key from password
    const key = Buffer.from(password, 'hex').slice(0, KEY_LENGTH);
    if (key.length !== KEY_LENGTH) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from('app-integration-credentials'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}
