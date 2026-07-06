import { useEffect, useState } from 'react';
import { api } from '../api';

interface Guide { id: string; type: string; step_number: number; title: string; subtitle: string; steps_text: string; arabic_text: string; latin_text: string; }
interface Dua { id: string; title: string; context: string; arabic_text: string; latin_text: string; translation: string; sort_order: number; }

export default function Content() {
  const [tab, setTab] = useState<'guides' | 'duas'>('guides');
  const [guideType, setGuideType] = useState<'umrah' | 'haji'>('umrah');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [duas, setDuas] = useState<Dua[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const loadGuides = async () => {
    try {
      const res = await api<any>(`/ibadah-guides?type=${guideType}`);
      setGuides(Array.isArray(res) ? res : []);
    } catch {}
  };

  const loadDuas = async () => {
    try {
      const res = await api<any>('/duas');
      setDuas(Array.isArray(res) ? res : []);
    } catch {}
  };

  useEffect(() => {
    if (tab === 'guides') loadGuides();
    else loadDuas();
  }, [tab, guideType]);

  const startEdit = (item: any) => {
    setEditing(item.id);
    setForm({ ...item });
  };

  const saveGuide = async () => {
    if (!editing) return;
    try {
      await api(`/ibadah-guides/${editing}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title, subtitle: form.subtitle,
          steps_text: form.steps_text, arabic_text: form.arabic_text, latin_text: form.latin_text,
        }),
      });
      setEditing(null);
      loadGuides();
    } catch (err: any) { alert(err.message); }
  };

  const saveDua = async () => {
    if (!editing) return;
    try {
      await api(`/duas/${editing}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title, context: form.context,
          arabic_text: form.arabic_text, latin_text: form.latin_text, translation: form.translation,
        }),
      });
      setEditing(null);
      loadDuas();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Konten</h1>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {(['guides', 'duas'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setEditing(null); }} style={{
            padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: tab === t ? '#8B2E2E' : '#EFE7D9', color: tab === t ? '#F5F1E8' : '#8C6B4A',
          }}>
            {t === 'guides' ? 'Tuntunan Ibadah' : 'Doa & Bacaan'}
          </button>
        ))}
      </div>

      {tab === 'guides' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {(['umrah', 'haji'] as const).map((t) => (
              <button key={t} onClick={() => { setGuideType(t); setEditing(null); }} style={{
                padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid #E5DDD0',
                background: guideType === t ? '#5C3A1E' : '#fff', color: guideType === t ? '#F5F1E8' : '#8C6B4A',
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {guides.map((g) => (
              <div key={g.id} style={cardStyle}>
                {editing === g.id ? (
                  <div>
                    <div style={editGrid}>
                      <div><label style={label}>Judul</label><input style={input} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                      <div><label style={label}>Sub-judul</label><input style={input} value={form.subtitle || ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
                    </div>
                    <label style={{ ...label, marginTop: 10 }}>Langkah-langkah</label>
                    <textarea style={{ ...input, minHeight: 80 }} value={form.steps_text || ''} onChange={(e) => setForm({ ...form, steps_text: e.target.value })} />
                    <div style={{ ...editGrid, marginTop: 10 }}>
                      <div><label style={label}>Teks Arab</label><textarea style={{ ...input, minHeight: 50 }} value={form.arabic_text || ''} onChange={(e) => setForm({ ...form, arabic_text: e.target.value })} /></div>
                      <div><label style={label}>Teks Latin</label><textarea style={{ ...input, minHeight: 50 }} value={form.latin_text || ''} onChange={(e) => setForm({ ...form, latin_text: e.target.value })} /></div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button onClick={saveGuide} style={btnPrimary}>Simpan</button>
                      <button onClick={() => setEditing(null)} style={btnSecondary}>Batal</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#8B2E2E', marginRight: 10 }}>{g.step_number}.</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1F1B16' }}>{g.title}</span>
                      <span style={{ fontSize: 13, color: '#8C6B4A', marginLeft: 10 }}>{g.subtitle}</span>
                    </div>
                    <button onClick={() => startEdit(g)} style={actionBtn}>Edit</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'duas' && (
        <div style={{ marginTop: 16 }}>
          {duas.map((d) => (
            <div key={d.id} style={cardStyle}>
              {editing === d.id ? (
                <div>
                  <div style={editGrid}>
                    <div><label style={label}>Judul</label><input style={input} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                    <div><label style={label}>Konteks</label><input style={input} value={form.context || ''} onChange={(e) => setForm({ ...form, context: e.target.value })} /></div>
                  </div>
                  <label style={{ ...label, marginTop: 10 }}>Teks Arab</label>
                  <textarea style={{ ...input, minHeight: 50, direction: 'rtl' }} value={form.arabic_text || ''} onChange={(e) => setForm({ ...form, arabic_text: e.target.value })} />
                  <label style={{ ...label, marginTop: 10 }}>Teks Latin</label>
                  <textarea style={{ ...input, minHeight: 40 }} value={form.latin_text || ''} onChange={(e) => setForm({ ...form, latin_text: e.target.value })} />
                  <label style={{ ...label, marginTop: 10 }}>Terjemahan</label>
                  <textarea style={{ ...input, minHeight: 40 }} value={form.translation || ''} onChange={(e) => setForm({ ...form, translation: e.target.value })} />
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button onClick={saveDua} style={btnPrimary}>Simpan</button>
                    <button onClick={() => setEditing(null)} style={btnSecondary}>Batal</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1F1B16' }}>{d.title}</span>
                    <span style={{ fontSize: 13, color: '#8C6B4A', marginLeft: 10 }}>{d.context}</span>
                  </div>
                  <button onClick={() => startEdit(d)} style={actionBtn}>Edit</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #ECE5D8', borderRadius: 12, padding: '14px 18px', marginBottom: 8 };
const editGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#8C6B4A', marginBottom: 4 };
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #ECE5D8', borderRadius: 8, fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: '#8B2E2E', color: '#F5F1E8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 18px', background: 'transparent', color: '#8C6B4A', border: '1px solid #ECE5D8', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const actionBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#8B2E2E', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
