import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('⚠️  ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION)');
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH);
  }

  if (key.length === KEY_LENGTH * 2) {
    return Buffer.from(key, 'hex');
  }

  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
