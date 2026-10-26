import { useEffect, useRef, useState, FormEvent } from 'react';
import { api } from '../api';
import GroupHotels from '../components/GroupHotels';
import LoadState from '../components/LoadState';
import { roleLabel } from '../labels';
import { C, R } from '../theme';
import { formBox, formTitle, label, input, errorText as errorTextStyle, btnPrimary, actionBtn, th, td, roleChip } from '../ui';

interface Group { id: string; name: string; kloter_code: string; year: number; member_count: number; }
interface Member {
  id: string; name: string; phone: string; role_in_group: string; membership_id: string;
  room_makkah?: string | null; room_madinah?: string | null;
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({ name: '', kloter_code: '', year: new Date().getFullYear() });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [addForm, setAddForm] = useState({ user_id: '', role_in_group: 'jamaah' });
  const [users, setUsers] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [usersError, setUsersError] = useState('');

  const errorText = (err: any) => err?.message || 'Server tidak merespons.';

  const loadGroups = async () => {
    setLoadError('');
    try {
      const res = await api<any>('/groups?limit=100');
      setGroups(Array.isArray(res) ? res : res.data || res);
    } catch (err: any) {
      setLoadError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Rombongan yang panel anggotanya sedang terbuka; respons untuk rombongan lain diabaikan.
  const membersFor = useRef<string | null>(null);

  const loadMembers = async (gid: string) => {
    const isSwitch = membersFor.current !== gid;
    membersFor.current = gid;
    setMembersError('');
    if (isSwitch) {
      // Kosongkan hanya saat pindah rombongan, agar anggota rombongan lain tidak terlihat di panel ini.
      setMembers([]);
      setMembersLoading(true);
    }
    try {
      const res = await api<any>(`/groups/${gid}/members`);
      if (membersFor.current === gid) setMembers(Array.isArray(res) ? res : []);
    } catch (err: any) {
      if (membersFor.current === gid) setMembersError(errorText(err));
    } finally {
      if (membersFor.current === gid) setMembersLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersError('');
    try {
      const res = await api<any>('/users?limit=200');
      setUsers(Array.isArray(res) ? res : res.data || []);
    } catch (err: any) {
      setUsersError(errorText(err));
    }
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
            <label style={label} htmlFor="group-nama">Nama</label>
            <input id="group-nama" style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama KBIH / travel" required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="group-kode-kloter">Kode Kloter</label>
            <input id="group-kode-kloter" style={input} value={form.kloter_code} onChange={(e) => setForm({ ...form, kloter_code: e.target.value })} placeholder="SOC-15" required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="group-tahun">Tahun</label>
            <input id="group-tahun" style={input} type="number" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })} required />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={btnPrimary}>Tambah</button>
          </div>
        </div>
        {error && <p style={errorTextStyle}>{error}</p>}
      </form>

      {/* Groups list */}
      <LoadState isLoading={isLoading} error={loadError} onRetry={loadGroups} isEmpty={groups.length === 0}
        emptyText="Belum ada rombongan. Tambahkan lewat formulir di atas." />
      <div style={{ marginTop: 20 }}>
        {groups.map((g) => (
          <div key={g.id} style={groupCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 18 }}>
              {/* Tombol asli (bukan div ber-onClick) agar rombongan bisa dibuka dengan keyboard. */}
              <button
                type="button"
                onClick={() => openGroup(g.id)}
                aria-expanded={selected === g.id}
                aria-controls={`group-panel-${g.id}`}
                style={groupToggle}
              >
                <span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{g.name}</span>
                  <span style={kloterChip}>{g.kloter_code}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{g.member_count} anggota</span>
                  <span aria-hidden="true" style={{ color: C.muted }}>{selected === g.id ? '▲' : '▼'}</span>
                </span>
              </button>
              <button type="button" onClick={() => deleteGroup(g.id)} style={{ ...actionBtn, color: C.danger }} aria-label={`Hapus rombongan ${g.name}`}>Hapus</button>
            </div>

            {selected === g.id && (
              <div id={`group-panel-${g.id}`} style={{ borderTop: `1px solid ${C.border}`, padding: 18 }}>
                {/* Add member form */}
                <form onSubmit={addMember} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <select
                    aria-label="Pengguna yang ditambahkan"
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
                  <select aria-label="Peran di rombongan" style={{ ...input, flex: 1 }} value={addForm.role_in_group} onChange={(e) => setAddForm({ ...addForm, role_in_group: e.target.value })}>
                    <option value="jamaah">Jamaah</option>
                    <option value="muthawwif">Muthawwif</option>
                  </select>
                  <button type="submit" style={btnPrimary}>Tambah</button>
                </form>
                {usersError && (
                  <p role="alert" style={{ color: C.text, fontSize: 13, margin: '-6px 0 12px' }}>
                    Daftar pengguna gagal dimuat ({usersError}).{' '}
                    <button type="button" onClick={loadUsers} style={actionBtn}>Coba lagi</button>
                  </p>
                )}

                {/* Members */}
                {membersError || membersLoading || members.length === 0 ? (
                  <LoadState isLoading={membersLoading} error={membersError} onRetry={() => loadMembers(g.id)}
                    isEmpty={members.length === 0} emptyText="Belum ada anggota. Pilih pengguna di atas lalu klik Tambah." />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Nama', 'HP', 'Peran', 'Aksi'].map((h) => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td style={td}>{m.name}</td>
                          <td style={td}>{m.phone}</td>
                          <td style={td}><span style={roleChip(m.role_in_group)}>{roleLabel(m.role_in_group)}</span></td>
                          <td style={td}><button onClick={() => removeMember(m.id)} style={actionBtn}>Keluarkan</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <GroupHotels groupId={g.id} members={members} onRoomsChanged={() => loadMembers(g.id)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const groupToggle: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit',
};
const groupCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: R.lg, marginBottom: 10, overflow: 'hidden' };
const kloterChip: React.CSSProperties = { marginLeft: 10, fontSize: 12, fontWeight: 600, color: C.primary, background: C.primaryLight, padding: '2px 8px', borderRadius: R.pill };
