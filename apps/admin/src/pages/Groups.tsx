import { useEffect, useState, FormEvent } from 'react';
import { api } from '../api';

interface Group { id: string; name: string; kloter_code: string; year: number; member_count: number; }
interface Member { id: string; name: string; phone: string; role_in_group: string; membership_id: string; }

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({ name: '', kloter_code: '', year: new Date().getFullYear() });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [addForm, setAddForm] = useState({ user_id: '', role_in_group: 'jamaah' });
  const [users, setUsers] = useState<Array<{ id: string; name: string; phone: string }>>([]);

  const loadGroups = async () => {
    try {
      const res = await api<any>('/groups?limit=100');
      setGroups(Array.isArray(res) ? res : res.data || res);
    } catch {}
  };

  const loadMembers = async (gid: string) => {
    try {
      const res = await api<any>(`/groups/${gid}/members`);
      setMembers(Array.isArray(res) ? res : []);
    } catch {}
  };

  const loadUsers = async () => {
    try {
      const res = await api<any>('/users?limit=200');
      setUsers(Array.isArray(res) ? res : res.data || []);
    } catch {}
  };

  useEffect(() => { loadGroups(); loadUsers(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/groups', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', kloter_code: '', year: new Date().getFullYear() });
      loadGroups();
    } catch (err: any) { setError(err.message); }
  };

  const openGroup = (gid: string) => {
    setSelected(gid === selected ? null : gid);
    if (gid !== selected) loadMembers(gid);
  };

  const addMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !addForm.user_id) return;
    try {
      await api(`/groups/${selected}/members`, { method: 'POST', body: JSON.stringify(addForm) });
      setAddForm({ user_id: '', role_in_group: 'jamaah' });
      loadMembers(selected);
      loadGroups();
    } catch (err: any) { alert(err.message); }
  };

  const removeMember = async (userId: string) => {
    if (!selected || !confirm('Keluarkan anggota ini?')) return;
    try {
      await api(`/groups/${selected}/members/${userId}`, { method: 'DELETE' });
      loadMembers(selected);
      loadGroups();
    } catch (err: any) { alert(err.message); }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Hapus rombongan ini? Semua data anggota akan ikut terhapus.')) return;
    try {
      await api(`/groups/${id}`, { method: 'DELETE' });
      if (selected === id) setSelected(null);
      loadGroups();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Rombongan</h1>

      <form onSubmit={handleCreate} style={formBox}>
        <h3 style={formTitle}>Tambah Rombongan</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 2 }}>
            <label style={label}>Nama</label>
            <input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="KBIH Barokah" required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Kode Kloter</label>
            <input style={input} value={form.kloter_code} onChange={(e) => setForm({ ...form, kloter_code: e.target.value })} placeholder="SOC-15" required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Tahun</label>
            <input style={input} type="number" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })} required />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={btnPrimary}>Tambah</button>
          </div>
        </div>
        {error && <p style={{ color: '#C44536', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </form>

      {/* Groups list */}
      <div style={{ marginTop: 20 }}>
        {groups.map((g) => (
          <div key={g.id} style={{ background: '#fff', border: '1px solid #ECE5D8', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
            <div
              onClick={() => openGroup(g.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1F1B16' }}>{g.name}</span>
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: '#8B2E2E', background: '#F3D9CD', padding: '2px 8px', borderRadius: 999 }}>{g.kloter_code}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#8C6B4A' }}>{g.member_count} anggota</span>
                <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} style={{ ...actionBtn, color: '#C44536' }}>Hapus</button>
                <span style={{ color: '#B89A7A' }}>{selected === g.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {selected === g.id && (
              <div style={{ borderTop: '1px solid #ECE5D8', padding: 18 }}>
                {/* Add member form */}
                <form onSubmit={addMember} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <select
                    style={{ ...input, flex: 2 }}
                    value={addForm.user_id}
                    onChange={(e) => setAddForm({ ...addForm, user_id: e.target.value })}
                    required
                  >
                    <option value="">Pilih pengguna...</option>
                    {users
                      .filter((u) => !members.some((m) => m.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>
                      ))}
                  </select>
                  <select style={{ ...input, flex: 1 }} value={addForm.role_in_group} onChange={(e) => setAddForm({ ...addForm, role_in_group: e.target.value })}>
                    <option value="jamaah">Jamaah</option>
                    <option value="muthawwif">Muthawwif</option>
                  </select>
                  <button type="submit" style={btnPrimary}>Tambah</button>
                </form>

                {/* Members */}
                {members.length === 0 ? (
                  <p style={{ color: '#B89A7A', fontSize: 13 }}>Belum ada anggota.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Nama', 'HP', 'Peran', 'Aksi'].map((h) => (
                          <th key={h} style={{ ...th, padding: '8px 12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td style={td}>{m.name}</td>
                          <td style={td}>{m.phone}</td>
                          <td style={td}><span style={{ ...chip, background: m.role_in_group === 'muthawwif' ? '#FAEFC9' : '#DCEBD3' }}>{m.role_in_group}</span></td>
                          <td style={td}><button onClick={() => removeMember(m.id)} style={actionBtn}>Keluarkan</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const formBox: React.CSSProperties = { marginTop: 20, background: '#fff', border: '1px solid #ECE5D8', borderRadius: 14, padding: 20 };
const formTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#5C3A1E' };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#8C6B4A', marginBottom: 4 };
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #ECE5D8', borderRadius: 8, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: '9px 20px', background: '#8B2E2E', color: '#F5F1E8', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#8C6B4A', borderBottom: '1px solid #ECE5D8', background: '#FAFAF6' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #F0E9DC' };
const chip: React.CSSProperties = { padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 };
const actionBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#8B2E2E', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
