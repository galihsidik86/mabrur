import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';
import LoadState from '../components/LoadState';
import { roleLabel } from '../labels';
import { C, R } from '../theme';
import { formBox, formTitle, label, input, errorText, btnPrimary, btnSecondary, actionBtn, table, th, td, roleChip } from '../ui';

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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const res = await api<any>(`/users?limit=100${filter ? `&role=${filter}` : ''}`);
      setUsers(Array.isArray(res) ? res : res.data || res);
    } catch (err: any) {
      setLoadError(err?.message || 'Server tidak merespons.');
    } finally {
      setIsLoading(false);
    }
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
        <h3 style={formTitle}>
          {editId ? 'Edit Pengguna' : 'Tambah Pengguna'}
        </h3>
        <div style={grid}>
          <div>
            <label style={label} htmlFor="user-nama">Nama</label>
            <input id="user-nama" style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label style={label} htmlFor="user-nomor-hp">Nomor HP</label>
            <input id="user-nomor-hp" style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!!editId} required={!editId} />
          </div>
          <div>
            <label style={label} htmlFor="user-password">Password{editId ? ' (kosongkan jika tidak diubah)' : ''}</label>
            <input id="user-password" style={input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
          </div>
          <div>
            <label style={label} htmlFor="user-role">Role</label>
            <select id="user-role" style={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="jamaah">Jamaah</option>
              <option value="muthawwif">Muthawwif</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label style={label} htmlFor="user-gol-darah">Gol. Darah</label>
            <input id="user-gol-darah" style={input} value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })} />
          </div>
          <div>
            <label style={label} htmlFor="user-kontak-darurat">Kontak Darurat</label>
            <input id="user-kontak-darurat" style={input} value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
          </div>
        </div>
        {error && <p style={errorText}>{error}</p>}
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button type="submit" style={btnPrimary}>{editId ? 'Simpan' : 'Tambah'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} style={btnSecondary}>Batal</button>}
        </div>
      </form>

      {/* Filter + Table */}
      <div role="group" aria-labelledby="user-filter-label" style={{ marginTop: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span id="user-filter-label" style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>Filter peran:</span>
        {['', 'jamaah', 'muthawwif', 'admin'].map((r) => (
          <button key={r} type="button" aria-pressed={filter === r} onClick={() => setFilter(r)} style={{
            ...chipBtn, ...(filter === r ? chipActive : {}),
          }}>{r ? roleLabel(r) : 'Semua'}</button>
        ))}
      </div>

      <LoadState isLoading={isLoading} error={loadError} onRetry={load} isEmpty={users.length === 0}
        emptyText={filter ? 'Tidak ada pengguna aktif dengan peran ini.' : 'Belum ada pengguna aktif. Tambahkan lewat formulir di atas.'} />
      <table style={usersTable}>
        <thead>
          <tr>{['Nama', 'HP', 'Role', 'Gol. Darah', 'Aksi'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={td}>{u.name}</td>
              <td style={td}>{u.phone}</td>
              <td style={td}><span style={roleChip(u.role)}>{roleLabel(u.role)}</span></td>
              <td style={td}>{u.blood_type || '-'}</td>
              <td style={td}>
                <button onClick={() => startEdit(u)} style={rowActionBtn}>Edit</button>
                <button onClick={() => handleDelete(u.id)} style={{ ...rowActionBtn, color: C.danger }}>Nonaktifkan</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const h1: React.CSSProperties = { fontSize: 24, fontWeight: 800 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 };
const usersTable: React.CSSProperties = { ...table, marginTop: 16 };
const chipBtn: React.CSSProperties = { padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: R.pill, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: C.card, color: C.muted };
const chipActive: React.CSSProperties = { background: C.primary, color: C.onPrimary, borderColor: C.primary };
const rowActionBtn: React.CSSProperties = { ...actionBtn, marginRight: 8 };
