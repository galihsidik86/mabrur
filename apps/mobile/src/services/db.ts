import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDB(): Promise<void> {
  if (db) return;
  db = await SQLite.openDatabaseAsync('mabrur.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL,
      data TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kloter_code TEXT NOT NULL,
      year INTEGER,
      member_count INTEGER DEFAULT 0,
      data TEXT
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role_in_group TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS miqat_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zone_type TEXT NOT NULL,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      radius_meters INTEGER NOT NULL,
      warning_radius INTEGER NOT NULL DEFAULT 3000
    );

    CREATE TABLE IF NOT EXISTS ihram_local (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_ihram INTEGER NOT NULL DEFAULT 0,
      niat_type TEXT,
      distance_meters REAL,
      nearest_miqat TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      location_name TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ibadah_guides (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      steps_text TEXT,
      arabic_text TEXT,
      latin_text TEXT
    );

    CREATE TABLE IF NOT EXISTS duas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      context TEXT,
      arabic_text TEXT,
      latin_text TEXT,
      translation TEXT,
      sort_order INTEGER DEFAULT 0
    );
  `);
}

export function getDB(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database belum diinisialisasi');
  return db;
}

export async function saveProfile(user: {
  id: string;
  name: string;
  phone: string;
  role: string;
}): Promise<void> {
  const d = getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO profile (id, name, phone, role) VALUES (?, ?, ?, ?)`,
    [user.id, user.name, user.phone, user.role],
  );
}

export async function getProfile(): Promise<{
  id: string;
  name: string;
  phone: string;
  role: string;
} | null> {
  const d = getDB();
  return d.getFirstAsync('SELECT * FROM profile LIMIT 1');
}

export async function saveGroups(
  groups: Array<{
    id: string;
    name: string;
    kloter_code: string;
    year?: number;
    member_count?: number;
  }>,
): Promise<void> {
  const d = getDB();
  for (const g of groups) {
    await d.runAsync(
      `INSERT OR REPLACE INTO groups (id, name, kloter_code, year, member_count) VALUES (?, ?, ?, ?, ?)`,
      [g.id, g.name, g.kloter_code, g.year ?? null, g.member_count ?? 0],
    );
  }
}

export async function getGroups(): Promise<
  Array<{
    id: string;
    name: string;
    kloter_code: string;
    year: number;
    member_count: number;
  }>
> {
  const d = getDB();
  return d.getAllAsync('SELECT * FROM groups');
}

export async function saveGroupMembers(
  groupId: string,
  members: Array<{
    id: string;
    name: string;
    phone?: string;
    role_in_group: string;
  }>,
): Promise<void> {
  const d = getDB();
  await d.runAsync('DELETE FROM group_members WHERE group_id = ?', [groupId]);
  for (const m of members) {
    await d.runAsync(
      `INSERT INTO group_members (id, group_id, user_id, name, phone, role_in_group) VALUES (?, ?, ?, ?, ?, ?)`,
      [m.id + groupId, groupId, m.id, m.name, m.phone ?? null, m.role_in_group],
    );
  }
}

export async function getGroupMembers(
  groupId: string,
): Promise<
  Array<{
    user_id: string;
    name: string;
    phone: string;
    role_in_group: string;
  }>
> {
  const d = getDB();
  return d.getAllAsync(
    'SELECT user_id, name, phone, role_in_group FROM group_members WHERE group_id = ?',
    [groupId],
  );
}

// ==================== Miqat Zones ====================

export async function saveMiqatZones(zones: Array<{
  id: string; name: string; zone_type: string;
  center_lat: number; center_lng: number;
  radius_meters: number; warning_radius: number;
}>): Promise<void> {
  const d = getDB();
  await d.runAsync('DELETE FROM miqat_zones');
  for (const z of zones) {
    await d.runAsync(
      'INSERT INTO miqat_zones (id, name, zone_type, center_lat, center_lng, radius_meters, warning_radius) VALUES (?,?,?,?,?,?,?)',
      [z.id, z.name, z.zone_type, z.center_lat, z.center_lng, z.radius_meters, z.warning_radius],
    );
  }
}

export async function getMiqatZones(): Promise<Array<{
  id: string; name: string; zone_type: string;
  center_lat: number; center_lng: number;
  radius_meters: number; warning_radius: number;
}>> {
  return getDB().getAllAsync('SELECT * FROM miqat_zones');
}

// ==================== Ihram Local State ====================

export async function saveIhramLocal(data: {
  is_ihram: boolean; niat_type?: string | null;
  distance_meters?: number | null; nearest_miqat?: string | null;
}): Promise<void> {
  const d = getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO ihram_local (id, is_ihram, niat_type, distance_meters, nearest_miqat, updated_at)
     VALUES (1, ?, ?, ?, ?, datetime('now'))`,
    [data.is_ihram ? 1 : 0, data.niat_type ?? null, data.distance_meters ?? null, data.nearest_miqat ?? null],
  );
}

export async function getIhramLocal(): Promise<{
  is_ihram: boolean; niat_type: string | null;
  distance_meters: number | null; nearest_miqat: string | null;
} | null> {
  const d = getDB();
  const row: any = await d.getFirstAsync('SELECT * FROM ihram_local WHERE id = 1');
  if (!row) return null;
  return { is_ihram: !!row.is_ihram, niat_type: row.niat_type, distance_meters: row.distance_meters, nearest_miqat: row.nearest_miqat };
}

// ==================== Schedules ====================

export interface Schedule {
  id: string;
  group_id: string;
  title: string;
  location_name: string | null;
  start_time: string;
  end_time: string | null;
  status: 'upcoming' | 'active' | 'done';
  sort_order: number;
}

export async function saveSchedules(groupId: string, schedules: Schedule[]): Promise<void> {
  const d = getDB();
  await d.runAsync('DELETE FROM schedules WHERE group_id = ?', [groupId]);
  for (const s of schedules) {
    await d.runAsync(
      `INSERT INTO schedules (id, group_id, title, location_name, start_time, end_time, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, groupId, s.title, s.location_name, s.start_time, s.end_time, s.status, s.sort_order],
    );
  }
}

export async function getSchedules(groupId: string): Promise<Schedule[]> {
  const d = getDB();
  return d.getAllAsync(
    'SELECT * FROM schedules WHERE group_id = ? ORDER BY sort_order',
    [groupId],
  );
}

export async function getNextSchedule(groupId: string): Promise<Schedule | null> {
  const d = getDB();
  return d.getFirstAsync(
    "SELECT * FROM schedules WHERE group_id = ? AND status != 'done' ORDER BY sort_order LIMIT 1",
    [groupId],
  );
}

// ==================== Ibadah Guides ====================

export interface Guide {
  id: string;
  type: string;
  step_number: number;
  title: string;
  subtitle: string | null;
  steps_text: string | null;
  arabic_text: string | null;
  latin_text: string | null;
}

export async function saveGuides(guides: Guide[]): Promise<void> {
  const d = getDB();
  for (const g of guides) {
    await d.runAsync(
      `INSERT OR REPLACE INTO ibadah_guides (id, type, step_number, title, subtitle, steps_text, arabic_text, latin_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [g.id, g.type, g.step_number, g.title, g.subtitle, g.steps_text, g.arabic_text, g.latin_text],
    );
  }
}

export async function getGuidesByType(type: string): Promise<Guide[]> {
  const d = getDB();
  return d.getAllAsync(
    'SELECT * FROM ibadah_guides WHERE type = ? ORDER BY step_number',
    [type],
  );
}

// ==================== Duas ====================

export interface Dua {
  id: string;
  title: string;
  context: string | null;
  arabic_text: string | null;
  latin_text: string | null;
  translation: string | null;
  sort_order: number;
}

export async function saveDuas(duas: Dua[]): Promise<void> {
  const d = getDB();
  for (const dua of duas) {
    await d.runAsync(
      `INSERT OR REPLACE INTO duas (id, title, context, arabic_text, latin_text, translation, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dua.id, dua.title, dua.context, dua.arabic_text, dua.latin_text, dua.translation, dua.sort_order],
    );
  }
}

export async function getDuas(): Promise<Dua[]> {
  const d = getDB();
  return d.getAllAsync('SELECT * FROM duas ORDER BY sort_order');
}

// ==================== Cleanup ====================

export async function clearAll(): Promise<void> {
  const d = getDB();
  await d.execAsync(`
    DELETE FROM profile;
    DELETE FROM groups;
    DELETE FROM group_members;
    DELETE FROM miqat_zones;
    DELETE FROM ihram_local;
    DELETE FROM schedules;
    DELETE FROM ibadah_guides;
    DELETE FROM duas;
    DELETE FROM sync_meta;
  `);
}
