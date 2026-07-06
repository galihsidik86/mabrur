import { describe, it, expect } from 'vitest';

// Set env before importing
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DATABASE_URL = 'postgres://x:x@localhost/x';
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);

import { encrypt, decrypt } from '../src/services/crypto.service';

describe('crypto.service', () => {
  it('encrypts and decrypts back to original', () => {
    const original = 'C4821990';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext
    expect(decrypt(encrypted)).toBe(original);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const text = 'paspor-test';
    const a = encrypt(text);
    const b = encrypt(text);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(text);
    expect(decrypt(b)).toBe(text);
  });

  it('handles unicode / Arabic text', () => {
    const arabic = 'لَبَّيْكَ اللَّهُمَّ عُمْرَةً';
    const encrypted = encrypt(arabic);
    expect(decrypt(encrypted)).toBe(arabic);
  });

  it('handles empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('throws on tampered data', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    parts[2] = 'ff' + parts[2].slice(2); // tamper ciphertext
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on invalid format', () => {
    expect(() => decrypt('not-valid')).toThrow();
  });
});
