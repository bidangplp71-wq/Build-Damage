import { UserRole } from '../types';

// Secret salt for AES-style reversible encryption and masking for SIM-PKBG PUPR
const ENCRYPTION_SECRET = 'SIMPKBG_PUPR_SECRET_KEY_2026_SECURE_SALT_9981';

/**
 * Encrypt a plaintext password with AES/XOR salt and base64 encoding
 */
export function encryptPassword(plainText: string): string {
  if (!plainText) return '';
  
  // If already prefixed with ENC::, return as is
  if (plainText.startsWith('ENC::')) return plainText;

  try {
    let result = '';
    for (let i = 0; i < plainText.length; i++) {
      const charCode = plainText.charCodeAt(i);
      const keyChar = ENCRYPTION_SECRET.charCodeAt(i % ENCRYPTION_SECRET.length);
      const encryptedChar = String.fromCharCode(charCode ^ keyChar);
      result += encryptedChar;
    }
    const encoded = btoa(unescape(encodeURIComponent(result)));
    return `ENC::${encoded}`;
  } catch (e) {
    return `ENC::${btoa(plainText)}`;
  }
}

/**
 * Decrypt an encrypted password
 */
export function decryptPassword(cipherText: string): string {
  if (!cipherText) return '';
  if (!cipherText.startsWith('ENC::')) return cipherText; // Plain text fallback

  const encoded = cipherText.replace('ENC::', '');
  try {
    const raw = decodeURIComponent(escape(atob(encoded)));
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i);
      const keyChar = ENCRYPTION_SECRET.charCodeAt(i % ENCRYPTION_SECRET.length);
      const decryptedChar = String.fromCharCode(charCode ^ keyChar);
      result += decryptedChar;
    }
    return result;
  } catch (e) {
    try {
      return atob(encoded);
    } catch {
      return cipherText;
    }
  }
}

/**
 * Compare entered password against stored password (handles both plaintext & encrypted)
 */
export function verifyPassword(inputPassword: string, storedPassword?: string): boolean {
  if (!storedPassword) return false;
  const decryptedStored = decryptPassword(storedPassword);
  return inputPassword.trim() === decryptedStored.trim();
}

/**
 * Permission check: Can current user set/edit target user's password?
 * - super_admin: Can set for EVERYONE (including admin, verifikator, surveyor, publik)
 * - admin: Can ONLY set for verifikator, surveyor, and publik. CANNOT set for admin or super_admin.
 * - others: Cannot manage passwords.
 */
export function canManageUserPassword(currentRole: UserRole, targetRole: UserRole): boolean {
  if (currentRole === 'super_admin') {
    return true; // Super admin can manage all passwords
  }
  if (currentRole === 'admin') {
    // Admin can only manage non-admin, non-super_admin users
    return targetRole === 'admin_verifikator' || targetRole === 'admin_user' || targetRole === 'admin_publik';
  }
  return false;
}

/**
 * Permission check: Can current user view/unmask target user's password?
 * - super_admin: Can view all passwords (including admin)
 * - admin: Can ONLY view passwords of verifikator, surveyor, and publik. CANNOT view admin or super_admin passwords.
 * - others: Cannot view any passwords.
 */
export function canViewUserPassword(currentRole: UserRole, targetRole: UserRole): boolean {
  if (currentRole === 'super_admin') {
    return true; // Super admin can view all passwords
  }
  if (currentRole === 'admin') {
    return targetRole === 'admin_verifikator' || targetRole === 'admin_user' || targetRole === 'admin_publik';
  }
  return false;
}

/**
 * Mask password display for secure presentation
 */
export function maskPassword(length: number = 8): string {
  return '•'.repeat(Math.max(6, Math.min(length, 12)));
}
