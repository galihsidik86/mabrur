import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';

interface User {
  id: string; phone: string; name: string; role: string;
  blood_type: string | null; is_active: boolean; created_at: string;
}

const emptyForm = { phone: '', password: '', name: '', role: 'jamaah', blood_type: '', emergency_contact: '' };

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = async () => {
    try {
      const res = await api<any>(`/users?limit=100${filter ? `&role=${filter}` : ''}`);
      setUsers(Array.isArray(res) ? res : res.data || res);
    } catch {}
  };

  useEffect(() => { load(); }, [filter]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) {
        const body: any = { ...form };
        if (!body.password) delete body.password;
        delete body.phone; // can't change phone on edit for simplicity
        await api(`/users/${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify(form) });
      }
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (u: User) => {
    setEditId(u.id);
    setForm({ phone: u.phone, password: '', name: u.name, role: u.role, blood_type: u.blood_type || '', emergency_contact: '' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menonaktifkan pengguna ini?')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 style={h1}>Pengguna</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} style={formBox}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#5C3A1E' }}>
          {editId ? 'Edit Pengguna' : 'Tambah Pengguna'}
        </h3>
        <div style={grid}>
          <div>
            <label style={label}>Nama</label>
            <input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label style={label}>Nomor HP</label>
            <input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!!editId} required={!editId} />
          </div>
          <div>
            <label style={label}>Password{editId ? ' (kosongkan jika tidak diubah)' : ''}</label>
            <input style={input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
          </div>
          <div>
            <label style={label}>Role</label>
            <select style={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="jamaah">Jamaah</option>
              <option value="muthawwif">Muthawwif</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label style={label}>Gol. Darah</label>
            <input style={input} value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })} />
          </div>
          <div>
            <label style={label}>Kontak Darurat</label>
            <input style={input} value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
          </div>
        </div>
        {error && <p style={{ color: '#C44536', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button type="submit" style={btnPrimary}>{editId ? 'Simpan' : 'Tambah'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} style={btnSecondary}>Batal</button>}
        </div>
      </form>

      {/* Filter + Table */}
      <div style={{ marginTop: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#8C6B4A' }}>Filter:</span>
        {['', 'jamaah', 'muthawwif', 'admin'].map((r) => (
          <button key={r} onClick={() => setFilter(r)} style={{
            ...chipBtn, ...(filter === r ? chipActive : {}),
          }}>{r || 'Semua'}</button>
        ))}
      </div>

      <table style={table}>
        <thead>
          <tr>{['Nama', 'HP', 'Role', 'Gol. Darah', 'Aksi'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={td}>{u.name}</td>
              <td style={td}>{u.phone}</td>
              <td style={td}><span style={{ ...chip, background: u.role === 'admin' ? '#F3D9CD' : u.role === 'muthawwif' ? '#FAEFC9' : '#DCEBD3' }}>{u.role}</span></td>
              <td style={td}>{u.blood_type || '-'}</td>
              <td style={td}>
                <button onClick={() => startEdit(u)} style={actionBtn}>Edit</button>
                <button onClick={() => handleDelete(u.id)} style={{ ...actionBtn, color: '#C44536' }}>Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const h1: React.CSSProperties = { fontSize: 24, fontWeight: 800 };
const formBox: React.CSSProperties = { marginTop: 20, background: '#fff', border: '1px solid #ECE5D8', borderRadius: 14, padding: 20 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#8C6B4A', marginBottom: 4 };
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #ECE5D8', borderRadius: 8, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: '9px 20px', background: '#8B2E2E', color: '#F5F1E8', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '9px 20px', background: 'transparent', color: '#8C6B4A', border: '1px solid #ECE5D8', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const table: React.CSSProperties = { width: '100%', marginTop: 16, background: '#fff', border: '1px solid #ECE5D8', borderRadius: 14, borderCollapse: 'collapse', overflow: 'hidden' };
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#8C6B4A', borderBottom: '1px solid #ECE5D8', background: '#FAFAF6' };
const td: React.CSSProperties = { padding: '11px 16px', fontSize: 13, borderBottom: '1px solid #F0E9DC' };
const chip: React.CSSProperties = { padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 };
const chipBtn: React.CSSProperties = { padding: '5px 12px', border: '1px solid #ECE5D8', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#8C6B4A' };
const chipActive: React.CSSProperties = { background: '#8B2E2E', color: '#F5F1E8', borderColor: '#8B2E2E' };
const actionBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#8B2E2E', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 8 };
