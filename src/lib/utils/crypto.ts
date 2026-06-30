import crypto from "crypto";

// Derive a 256-bit (32-byte) key from the configured encryption key or service role key
function getEncryptionKey(): Buffer {
  const secret = process.env.GOOGLE_OAUTH_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("No encryption key found! Please configure GOOGLE_OAUTH_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  // Create a 32-byte hash to use as the AES key
  return crypto.createHash("sha256").update(secret).digest();
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits is recommended for GCM

/**
 * Encrypts a text string using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:encrypted_text_hex
 */
export function encryptToken(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag().toString("hex");
    
    return `${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch (err: any) {
    console.error("[Crypto] Encryption failed:", err.message);
    throw new Error("Token encryption failed");
  }
}

/**
 * Decrypts an encrypted token string.
 * Input format: iv_hex:auth_tag_hex:encrypted_text_hex
 */
export function decryptToken(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err: any) {
    console.error("[Crypto] Decryption failed:", err.message);
    throw new Error("Token decryption failed");
  }
}
