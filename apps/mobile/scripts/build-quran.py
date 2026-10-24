"""Bangun data Al-Qur'an offline untuk aplikasi (dibundel di APK).

Keluaran (keduanya di-commit, skrip ini hanya dijalankan ulang bila sumber diperbarui):
  assets/quran/quran-v1.db      SQLite read-only: teks Arab + terjemahan + catatan kaki per ayat
  src/services/quran-meta.ts    metadata 114 surah + awal 30 juz (dipakai tanpa membuka DB)

Sumber (hanya dibaca, teks tidak diubah):
  - Teks Arab Utsmani + terjemahan Kemenag RI edisi penyempurnaan 2019:
    QuranEnc.com, kunci "indonesian_affairs" (King Fahd Complex / Rowwad Translation Center).
    Diambil dua jalur (API per surah + berkas SQLite resmi) lalu terjemahannya dicocokkan silang.
  - Jumlah ayat, nama Arab, nama English, Makkiyah/Madaniyah, awal juz: Tanzil quran-data.js (CC BY 3.0).
  - Nama latin & arti nama surah (Indonesia): paket npm quran-json 3.1.2 (CC BY 4.0).

Pemakaian (dari apps/mobile):
  python scripts/build-quran.py <folder-cache>
Berkas sumber yang sudah ada di folder cache tidak diunduh ulang.
"""
import json
import os
import re
import sqlite3
import sys
import urllib.request

QURANENC_KEY = 'indonesian_affairs'
QURANENC_API = 'https://quranenc.com/api/v1/translation/sura/' + QURANENC_KEY + '/{}'
QURANENC_SQLITE = 'https://quranenc.com/downloads/sqlite/' + QURANENC_KEY + '.sqlite'
QURANENC_LIST = 'https://quranenc.com/api/v1/translations/list/id'
TANZIL_META = 'https://tanzil.net/res/text/metadata/quran-data.js'
QURAN_JSON_ID = 'https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran_id.json'

DB_NAME = 'quran-v1.db'
TOTAL_AYAT = 6236
HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(HERE)


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (mabrur build-quran)'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, 'wb') as f:
        f.write(r.read())


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def parse_tanzil(path):
    with open(path, encoding='utf-8') as f:
        js = f.read()
    sura_block = re.search(r'QuranData\.Sura = \[(.*?)\];', js, re.S).group(1)
    suras = []
    for m in re.finditer(r"\[(\d+), (\d+), (\d+), (\d+), '([^']*)', \"([^\"]*)\", '([^']*)', '(Meccan|Medinan)'\]", sura_block):
        suras.append({'ayahs': int(m.group(2)), 'ar': m.group(5), 'en': m.group(7), 'type': m.group(8)})
    juz_block = re.search(r'QuranData\.Juz = \[(.*?)\];', js, re.S).group(1)
    juz = [(int(a), int(b)) for a, b in re.findall(r'\[(\d+), (\d+)\]', juz_block)]
    juz = [j for j in juz if j[0] <= 114]  # buang penanda akhir [115, 1]
    assert len(suras) == 114, f'Tanzil: {len(suras)} surah'
    assert len(juz) == 30, f'Tanzil: {len(juz)} juz'
    return suras, juz


def juz_of(juz_starts, surah, ayah):
    j = 0
    for i, (s, a) in enumerate(juz_starts):
        if (surah, ayah) >= (s, a):
            j = i
    return j + 1


def ts_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    if len(sys.argv) != 2:
        sys.exit('pemakaian: python scripts/build-quran.py <folder-cache>')
    cache = sys.argv[1]
    os.makedirs(os.path.join(cache, 'sura'), exist_ok=True)

    fetch(QURANENC_SQLITE, os.path.join(cache, QURANENC_KEY + '.sqlite'))
    fetch(QURANENC_LIST, os.path.join(cache, 'quranenc-list.json'))
    fetch(TANZIL_META, os.path.join(cache, 'quran-data.js'))
    fetch(QURAN_JSON_ID, os.path.join(cache, 'quran_id.json'))
    for n in range(1, 115):
        fetch(QURANENC_API.format(n), os.path.join(cache, 'sura', f'{n}.json'))

    tanzil, juz_starts = parse_tanzil(os.path.join(cache, 'quran-data.js'))
    names_id = load_json(os.path.join(cache, 'quran_id.json'))
    version = next(t for t in load_json(os.path.join(cache, 'quranenc-list.json'))['translations']
                   if t['key'] == QURANENC_KEY)['version']

    # Jalur kedua: berkas SQLite resmi QuranEnc (hanya terjemahan) untuk cocok silang.
    src = sqlite3.connect(os.path.join(cache, QURANENC_KEY + '.sqlite'))
    official = {(s, a): (t or '', fn or '') for s, a, t, fn in
                src.execute('SELECT sura, aya, translation, footnotes FROM translations')}
    src.close()

    rows = []
    for n in range(1, 115):
        verses = load_json(os.path.join(cache, 'sura', f'{n}.json'))['result']
        assert len(verses) == tanzil[n - 1]['ayahs'], f'surah {n}: {len(verses)} ayat, Tanzil {tanzil[n - 1]["ayahs"]}'
        for i, v in enumerate(verses, start=1):
            assert int(v['sura']) == n and int(v['aya']) == i, f'urutan ayat rusak di {n}:{i}'
            ar, tr, fn = v['arabic_text'].strip(), v['translation'].strip(), (v['footnotes'] or '').strip()
            assert ar and tr, f'teks kosong di {n}:{i}'
            # Berkas SQLite menulis penanda catatan kaki "4)", API menulis "[4]" — samakan hanya untuk dibandingkan.
            same = official.get((n, i), ('', ''))[0].strip() == re.sub(r'\[(\d+)\]', r'\1)', tr)
            assert same, f'terjemahan API berbeda dengan SQLite resmi di {n}:{i}'
            rows.append((n, i, juz_of(juz_starts, n, i), ar, tr, fn))
    assert len(rows) == TOTAL_AYAT, f'{len(rows)} ayat, seharusnya {TOTAL_AYAT}'
    assert sorted({r[2] for r in rows}) == list(range(1, 31)), 'ada juz kosong'

    out_dir = os.path.join(MOBILE, 'assets', 'quran')
    os.makedirs(out_dir, exist_ok=True)
    db_path = os.path.join(out_dir, DB_NAME)
    if os.path.exists(db_path):
        os.remove(db_path)
    db = sqlite3.connect(db_path)
    db.executescript('''
        PRAGMA page_size = 4096;
        CREATE TABLE ayah (
          surah INTEGER NOT NULL,
          ayah INTEGER NOT NULL,
          juz INTEGER NOT NULL,
          text_ar TEXT NOT NULL,
          translation_id TEXT NOT NULL,
          footnotes_id TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (surah, ayah)
        ) WITHOUT ROWID;
        CREATE INDEX ayah_juz ON ayah (juz, surah, ayah);
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ''')
    db.executemany('INSERT INTO ayah VALUES (?, ?, ?, ?, ?, ?)', rows)
    db.executemany('INSERT INTO meta VALUES (?, ?)', [
        ('source', f'QuranEnc.com {QURANENC_KEY} v{version} (Kemenag RI edisi penyempurnaan 2019)'),
        ('ayat', str(len(rows))),
    ])
    db.commit()
    db.execute('VACUUM')
    db.close()

    lines = [
        '// DIHASILKAN oleh scripts/build-quran.py — jangan diedit manual.',
        '// Nama Arab, nama English, jumlah ayat, Makkiyah/Madaniyah, awal juz: Tanzil quran-data.js (CC BY 3.0).',
        '// Nama latin & arti (Indonesia): quran-json 3.1.2 (CC BY 4.0).',
        "import type { SurahMeta } from './quran-core';",
        '',
        f"export const QURAN_DB_NAME = '{DB_NAME}';",
        f"export const QURAN_SOURCE = {ts_str('QuranEnc.com · Terjemahan Kemenag RI (edisi penyempurnaan 2019) v' + version)};",
        '',
        '// Basmalah Utsmani = teks Al-Fatihah ayat 1 (urutan harakat asli sumber, jangan diketik ulang).',
        f'export const BASMALAH = {ts_str(rows[0][3])};',
        '',
        'export const SURAHS: readonly SurahMeta[] = [',
    ]
    for n in range(1, 115):
        t, m = tanzil[n - 1], names_id[n - 1]
        assert m['id'] == n and m['total_verses'] == t['ayahs'], f'metadata quran-json tidak cocok di surah {n}'
        place = 'makkiyah' if t['type'] == 'Meccan' else 'madaniyah'
        lines.append(f"  {{ number: {n}, nameAr: {ts_str(t['ar'])}, nameLatin: {ts_str(m['transliteration'])}, "
                     f"meaningId: {ts_str(m['translation'])}, meaningEn: {ts_str(t['en'])}, place: '{place}', ayahs: {t['ayahs']} }},")
    lines += [
        '];',
        '',
        '// Ayat pertama tiap juz (indeks 0 = juz 1).',
        'export const JUZ_STARTS: ReadonlyArray<readonly [surah: number, ayah: number]> = [',
    ]
    for i in range(0, 30, 5):
        lines.append('  ' + ' '.join(f'[{s}, {a}],' for s, a in juz_starts[i:i + 5]))
    lines += ['];', '']
    with open(os.path.join(MOBILE, 'src', 'services', 'quran-meta.ts'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

    # quran.ts me-require berkas aset secara langsung (Metro butuh path literal) — pastikan namanya sama.
    with open(os.path.join(MOBILE, 'src', 'services', 'quran.ts'), encoding='utf-8') as f:
        assert f"require('../../assets/quran/{DB_NAME}')" in f.read(), f'require() di quran.ts belum menunjuk {DB_NAME}'

    print(f'OK: {len(rows)} ayat, {os.path.getsize(db_path) / 1e6:.2f} MB -> {db_path}')


if __name__ == '__main__':
    main()
