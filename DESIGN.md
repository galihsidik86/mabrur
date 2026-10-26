# DESIGN.md — Mabrur

Arah desain untuk aplikasi Mabrur (mobile + admin). File ini sumber arah; antislop dipakai sebagai filter.

## Identity

- **Produk:** aplikasi Mabrur, pendamping ibadah umrah dan haji
- **Audiens:** jamaah umrah dan haji, beserta muthawwif yang membimbing mereka

## Personality

Hangat dan ramah.

## Mood

- Tenang dan khusyuk
- Tenang dan terbimbing
- Akrab dan kekeluargaan
- Sigap dan praktis

## Palette

- **Warna utama:** hijau zamrud — menggantikan maroon `#8B2E2E` yang sekarang ada di `apps/mobile/src/theme.ts`. Kode hex: `#0B5D47` (zamrud tua; kontras 6,97:1 dengan teks krem `#F5F1E8`)
- **Emas di atas hijau:** hanya untuk aksen (garis, ikon, badge), bukan teks kecil — kontrasnya 3,43:1
- **Latar:** krem (token sekarang: `#F5F1E8` layar, `#E4DAC7` luar)
- **Warna lain yang sudah ada di token:** emas `#D4A437`, danger `#C44536`, teks `#1F1B16` / `#5C3A1E` / `#7A5C3E` (muted, ≥5:1 di semua latar); `#9A7B5C` (faint) hanya untuk ikon, garis, placeholder; teks emas pakai `#806316`, emas `#D4A437` tidak untuk teks
- **Turunan zamrud:** gelap `#084536` (kontras 9,73:1 dengan krem), terang `#D5E7DF` (teks zamrud di atasnya 6,11:1)
- **Maroon `#8B2E2E` = aksen:** satu sentuhan sengaja di momen penting, bukan warna utama. Kontras dengan krem 7,37:1, tapi dengan zamrud hanya 1,06:1 — maroon selalu di atas latar krem/putih, tidak pernah bersebelahan langsung atau di atas zamrud. Dipakai saat ini untuk menandai zona miqat (peta + kartu dashboard admin)
- **Hijau zaitun `#4A7C3A` = status:** khusus penanda status (selesai, aktif, sukses), bukan warna merek

## Typography

- **Gaya:** sans humanis
- **UI:** Plus Jakarta Sans
- **Teks Arab:** Amiri

## Dials

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1
