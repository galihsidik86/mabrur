import { describe, it, expect } from 'vitest';
import {
  sniffImage,
  extensionFor,
  mimeFromFileName,
  expiresAt,
  exceedsQuota,
  normalizeTakenAt,
  canDeleteMedia,
  isOfficialUpload,
  normalizeCaption,
  MEDIA_QUOTA_BYTES,
  MEDIA_RETENTION_DAYS,
  MAX_CAPTION_LENGTH,
  type MediaActor,
} from '../src/services/media-core';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

describe('sniffImage', () => {
  it('mengenali JPEG, PNG, WebP dari isi berkas', () => {
    expect(sniffImage(JPEG)).toBe('image/jpeg');
    expect(sniffImage(PNG)).toBe('image/png');
    expect(sniffImage(WEBP)).toBe('image/webp');
  });

  it('menolak berkas lain walau berekstensi gambar', () => {
    expect(sniffImage(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a'))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]))).toBeNull();
  });

  it('ekstensi sesuai jenis, dan sebaliknya', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
    expect(mimeFromFileName('abc_t.jpg')).toBe('image/jpeg');
    expect(mimeFromFileName('abc.WEBP')).toBe('image/webp');
    expect(mimeFromFileName('abc.gif')).toBeNull();
    expect(mimeFromFileName('tanpa-ekstensi')).toBeNull();
  });
});

describe('kuota & masa simpan', () => {
  it('kedaluwarsa 180 hari setelah unggah', () => {
    const from = new Date('2026-10-24T00:00:00Z');
    expect(MEDIA_RETENTION_DAYS).toBe(180);
    expect(expiresAt(from).toISOString()).toBe('2027-04-22T00:00:00.000Z');
  });

  it('kuota 2 GB: tepat di batas boleh, lewat satu byte ditolak', () => {
    expect(MEDIA_QUOTA_BYTES).toBe(2147483648);
    expect(exceedsQuota(MEDIA_QUOTA_BYTES - 100, 100)).toBe(false);
    expect(exceedsQuota(MEDIA_QUOTA_BYTES - 100, 101)).toBe(true);
    expect(exceedsQuota(0, 10, 5)).toBe(true);
  });
});

describe('normalizeTakenAt', () => {
  const now = new Date('2026-10-24T10:00:00Z');

  it('waktu valid dipakai', () => {
    expect(normalizeTakenAt('2026-10-20T08:00:00Z', now).toISOString()).toBe('2026-10-20T08:00:00.000Z');
  });

  it('kosong, rusak, atau jauh di masa depan → waktu server', () => {
    expect(normalizeTakenAt(undefined, now)).toBe(now);
    expect(normalizeTakenAt('bukan tanggal', now)).toBe(now);
    expect(normalizeTakenAt('2026-10-26T10:00:00Z', now)).toBe(now);
  });

  it('jam HP sedikit maju masih diterima', () => {
    expect(normalizeTakenAt('2026-10-24T12:00:00Z', now).toISOString()).toBe('2026-10-24T12:00:00.000Z');
  });
});

describe('hak hapus & lencana resmi', () => {
  const jamaah: MediaActor = { userId: 'u1', role: 'jamaah', groupRole: 'jamaah' };
  const muthawwif: MediaActor = { userId: 'm1', role: 'muthawwif', groupRole: 'muthawwif' };
  const otherMuthawwif: MediaActor = { userId: 'm2', role: 'muthawwif', groupRole: null };
  const admin: MediaActor = { userId: 'a1', role: 'admin', groupRole: null };

  it('pengunggah boleh menghapus miliknya, tidak milik orang lain', () => {
    expect(canDeleteMedia(jamaah, 'u1')).toBe(true);
    expect(canDeleteMedia(jamaah, 'u2')).toBe(false);
    expect(canDeleteMedia(jamaah, null)).toBe(false);
  });

  it('muthawwif rombongan & admin boleh menghapus apa pun', () => {
    expect(canDeleteMedia(muthawwif, 'u1')).toBe(true);
    expect(canDeleteMedia(admin, 'u1')).toBe(true);
  });

  it('muthawwif rombongan lain tidak boleh', () => {
    expect(canDeleteMedia(otherMuthawwif, 'u1')).toBe(false);
  });

  it('mantan anggota tidak boleh menghapus walau dulu mengunggah', () => {
    expect(canDeleteMedia({ userId: 'u1', role: 'jamaah', groupRole: null }, 'u1')).toBe(false);
  });

  it('resmi = muthawwif rombongan atau admin', () => {
    expect(isOfficialUpload(muthawwif)).toBe(true);
    expect(isOfficialUpload(admin)).toBe(true);
    expect(isOfficialUpload(jamaah)).toBe(false);
  });
});

describe('normalizeCaption', () => {
  it('merapikan spasi; kosong → null; dipotong ke batas', () => {
    expect(normalizeCaption('  Tawaf   bersama  ')).toBe('Tawaf bersama');
    expect(normalizeCaption('   ')).toBeNull();
    expect(normalizeCaption(undefined)).toBeNull();
    expect(normalizeCaption('x'.repeat(500))).toHaveLength(MAX_CAPTION_LENGTH);
  });
});
