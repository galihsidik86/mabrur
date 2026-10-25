import { useEffect, useState } from 'react';
import { api } from '../api';

// Kartu Taksi (permintaan revisi v2 #6): hotel Makkah/Madinah per rombongan + nomor kamar
// per anggota. Data ini tampil di aplikasi jamaah (SOS -> Kartu Taksi), juga saat offline.

type City = 'makkah' | 'madinah';
const CITIES: Array<{ id: City; label: string }> = [
  { id: 'makkah', label: 'Hotel Makkah' },
  { id: 'madinah', label: 'Hotel Madinah' },
];
const ARABIC_LETTER = /[؀-ۿ]/;

interface Hotel { city: City; name_ar: string; name_latin: string | null; address_ar: string; phone: string | null }
interface HotelForm { name_ar: string; name_latin: string; address_ar: string; phone: string }
export interface RoomMember {
  id: string;
  name: string;
  role_in_group: string;
  room_makkah?: string | null;
  room_madinah?: string | null;
}

const EMPTY: HotelForm = { name_ar: '', name_latin: '', address_ar: '', phone: '' };

function toForm(h: Hotel | undefined): HotelForm {
  return h ? { name_ar: h.name_ar, name_latin: h.name_latin ?? '', address_ar: h.address_ar, phone: h.phone ?? '' } : EMPTY;
}

type Props = {
  groupId: string;
  members: RoomMember[];
  onRoomsChanged: () => void;
};

export default function GroupHotels({ groupId, members, onRoomsChanged }: Props) {
  const [forms, setForms] = useState<Record<City, HotelForm>>({ makkah: EMPTY, madinah: EMPTY });
  const [saved, setSaved] = useState<Record<City, boolean>>({ makkah: false, madinah: false });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<Hotel[]>(`/groups/${groupId}/hotels`)
      .then((hotels) => {
        const list = Array.isArray(hotels) ? hotels : [];
        setForms({ makkah: toForm(list.find((h) => h.city === 'makkah')), madinah: toForm(list.find((h) => h.city === 'madinah')) });
        setSaved({ makkah: list.some((h) => h.city === 'makkah'), madinah: list.some((h) => h.city === 'madinah') });
      })
      .catch(() => setMessage('Gagal memuat data hotel.'));
  }, [groupId]);

  const update = (city: City, field: keyof HotelForm, value: string) =>
    setForms((prev) => ({ ...prev, [city]: { ...prev[city], [field]: value } }));

  const saveHotel = async (city: City) => {
    const f = forms[city];
    if (!ARABIC_LETTER.test(f.name_ar) || !ARABIC_LETTER.test(f.address_ar)) {
      setMessage('Nama dan alamat hotel wajib ditulis dengan huruf Arab (dibaca sopir taksi).');
      return;
    }
    if (f.phone.trim() && !f.phone.trim().startsWith('+')) {
      setMessage('Telepon hotel harus diawali kode negara, mis. +966 12 555 0000.');
      return;
    }
    try {
      await api(`/groups/${groupId}/hotels/${city}`, { method: 'PUT', body: JSON.stringify(f) });
      setSaved((prev) => ({ ...prev, [city]: true }));
      setMessage(`${CITIES.find((c) => c.id === city)?.label} tersimpan.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan hotel.');
    }
  };

  const deleteHotel = async (city: City) => {
    if (!confirm('Hapus data hotel ini dari Kartu Taksi?')) return;
    try {
      await api(`/groups/${groupId}/hotels/${city}`, { method: 'DELETE' });
      setForms((prev) => ({ ...prev, [city]: EMPTY }));
      setSaved((prev) => ({ ...prev, [city]: false }));
      setMessage('Data hotel dihapus.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menghapus hotel.');
    }
  };

  const saveRoom = async (userId: string, city: City, value: string, previous: string) => {
    if (value.trim() === previous) return;
    try {
      await api(`/groups/${groupId}/members/${userId}/room`, {
        method: 'PATCH', body: JSON.stringify({ city, room_number: value }),
      });
      onRoomsChanged();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan nomor kamar.');
    }
  };

  const jamaah = members.filter((m) => m.role_in_group === 'jamaah');

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #ECE5D8', paddingTop: 16 }}>
      <h3 style={title}>Kartu Taksi — hotel rombongan</h3>
      <p style={hint}>Diisi sekali per rombongan; otomatis tampil di aplikasi semua jamaah. Tulis nama & alamat dalam bahasa Arab.</p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {CITIES.map(({ id, label }) => (
          <div key={id} style={hotelBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14, color: '#5C3A1E' }}>{label}</strong>
              {saved[id] && <span style={savedChip}>Tersimpan</span>}
            </div>
            <label style={labelStyle}>Nama hotel (Arab) *</label>
            <input style={{ ...input, ...rtl }} dir="rtl" value={forms[id].name_ar}
              onChange={(e) => update(id, 'name_ar', e.target.value)} placeholder="فندق ..." />
            <label style={labelStyle}>Nama hotel (Latin)</label>
            <input style={input} value={forms[id].name_latin}
              onChange={(e) => update(id, 'name_latin', e.target.value)} placeholder="Safwa Zamzam Hotel" />
            <label style={labelStyle}>Alamat lengkap (Arab) * — jalan, patokan, kota</label>
            <textarea style={{ ...input, ...rtl, minHeight: 64, resize: 'vertical' }} dir="rtl" value={forms[id].address_ar}
              onChange={(e) => update(id, 'address_ar', e.target.value)} placeholder="بجوار المسجد الحرام، مكة المكرمة" />
            <label style={labelStyle}>Telepon hotel</label>
            <input style={input} value={forms[id].phone}
              onChange={(e) => update(id, 'phone', e.target.value)} placeholder="+966 12 ..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" style={btnPrimary} onClick={() => saveHotel(id)}>Simpan</button>
              {saved[id] && <button type="button" style={btnText} onClick={() => deleteHotel(id)}>Hapus</button>}
            </div>
          </div>
        ))}
      </div>

      {jamaah.length > 0 && (
        <>
          <h3 style={{ ...title, marginTop: 18 }}>Nomor kamar jamaah</h3>
          <p style={hint}>Tersimpan otomatis saat kolom ditinggalkan. Kosongkan untuk menghapus.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nama', 'Kamar Makkah', 'Kamar Madinah'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {jamaah.map((m) => (
                <tr key={m.id}>
                  <td style={td}>{m.name}</td>
                  {(['makkah', 'madinah'] as City[]).map((city) => {
                    const current = (city === 'makkah' ? m.room_makkah : m.room_madinah) ?? '';
                    return (
                      <td key={city} style={td}>
                        <input
                          key={`${m.id}-${city}-${current}`}
                          style={{ ...input, maxWidth: 120 }}
                          defaultValue={current}
                          maxLength={20}
                          onBlur={(e) => saveRoom(m.id, city, e.target.value, current)}
                          aria-label={`Kamar ${city} ${m.name}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {message && <p style={{ fontSize: 13, color: '#5C3A1E', marginTop: 10 }}>{message}</p>}
    </div>
  );
}

const title: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#5C3A1E', margin: 0 };
const hint: React.CSSProperties = { fontSize: 12, color: '#8C6B4A', margin: '4px 0 12px' };
const hotelBox: React.CSSProperties = { flex: '1 1 320px', border: '1px solid #ECE5D8', borderRadius: 12, padding: 14, background: '#FFFDF8' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#8C6B4A', margin: '10px 0 4px' };
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #ECE5D8', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' };
const rtl: React.CSSProperties = { fontSize: 16, textAlign: 'right' };
const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: '#0B5D47', color: '#F5F1E8', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnText: React.CSSProperties = { background: 'none', border: 'none', color: '#C44536', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const savedChip: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#2F5A22', background: '#DCEBD3', padding: '2px 8px', borderRadius: 999 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#8C6B4A', borderBottom: '1px solid #ECE5D8', background: '#FAFAF6' };
const td: React.CSSProperties = { padding: '6px 12px', fontSize: 13, borderBottom: '1px solid #F0E9DC' };
