const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // Must be 256 bits (32 bytes)
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
  if (!text) return text;
  let iv = crypto.randomBytes(IV_LENGTH);
  let key = Buffer.from(ENCRYPTION_KEY, 'hex');
  // If ENCRYPTION_KEY is shorter/longer, this will fail. We ensure it's 32 bytes.
  if (key.length !== 32) {
    key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  }
  let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let key = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  }
  let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

module.exports = { encrypt, decrypt };
