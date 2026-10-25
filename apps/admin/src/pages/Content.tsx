import { useEffect, useState } from 'react';
import { api } from '../api';
import LoadState from '../components/LoadState';
import { C, R } from '../theme';
import { card, label, input, btnPrimary, btnSecondary, actionBtn } from '../ui';

interface Guide { id: string; type: string; step_number: number; title: string; subtitle: string; steps_text: string; arabic_text: string; latin_text: string; }
interface Dua { id: string; title: string; context: string; arabic_text: string; latin_text: string; translation: string; sort_order: number; }

export default function Content() {
  const [tab, setTab] = useState<'guides' | 'duas'>('guides');
  const [guideType, setGuideType] = useState<'umrah' | 'haji'>('umrah');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [duas, setDuas] = useState<Dua[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadGuides = async () => {
    try {
      const res = await api<any>(`/ibadah-guides?type=${guideType}`);
      setGuides(Array.isArray(res) ? res : []);
    } catch (err: any) { setLoadError(err?.message || 'Server tidak merespons.'); }
  };

  const loadDuas = async () => {
    try {
      const res = await api<any>('/duas');
      setDuas(Array.isArray(res) ? res : []);
    } catch (err: any) { setLoadError(err?.message || 'Server tidak merespons.'); }
  };

  const reload = async () => {
    setIsLoading(true);
    setLoadError('');
    await (tab === 'guides' ? loadGuides() : loadDuas());
    setIsLoading(false);
  };

  useEffect(() => { reload(); }, [tab, guideType]);

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

      <div role="group" aria-label="Jenis konten" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {(['guides', 'duas'] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => { setTab(t); setEditing(null); }} style={{
            padding: '8px 20px', borderRadius: R.pill, fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: tab === t ? C.primary : C.surface, color: tab === t ? C.onPrimary : C.muted,
          }}>
            {t === 'guides' ? 'Tuntunan Ibadah' : 'Doa & Bacaan'}
          </button>
        ))}
      </div>

      {tab === 'guides' && (
        <>
          <div role="group" aria-label="Jenis ibadah" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {(['umrah', 'haji'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={guideType === t} onClick={() => { setGuideType(t); setEditing(null); }} style={{
                padding: '6px 16px', borderRadius: R.pill, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${C.border}`,
                background: guideType === t ? C.textSecondary : C.card, color: guideType === t ? C.onPrimary : C.muted,
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <LoadState isLoading={isLoading} error={loadError} onRetry={reload} isEmpty={guides.length === 0}
            emptyText="Belum ada tuntunan untuk jenis ini. Tuntunan dibuat lewat seed atau API, lalu bisa disunting di sini." />
          <div style={{ marginTop: 16 }}>
            {guides.map((g) => (
              <div key={g.id} style={cardStyle}>
                {editing === g.id ? (
                  <div>
                    <div style={editGrid}>
                      <div><label style={label} htmlFor="content-judul">Judul</label><input id="content-judul" style={input} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                      <div><label style={label} htmlFor="content-sub-judul">Sub-judul</label><input id="content-sub-judul" style={input} value={form.subtitle || ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
                    </div>
                    <label style={{ ...label, marginTop: 10 }} htmlFor="content-langkah-langkah">Langkah-langkah</label>
                    <textarea id="content-langkah-langkah" style={{ ...input, minHeight: 80 }} value={form.steps_text || ''} onChange={(e) => setForm({ ...form, steps_text: e.target.value })} />
                    <div style={{ ...editGrid, marginTop: 10 }}>
                      <div><label style={label} htmlFor="content-teks-arab">Teks Arab</label><textarea id="content-teks-arab" style={{ ...input, minHeight: 50 }} value={form.arabic_text || ''} onChange={(e) => setForm({ ...form, arabic_text: e.target.value })} /></div>
                      <div><label style={label} htmlFor="content-teks-latin">Teks Latin</label><textarea id="content-teks-latin" style={{ ...input, minHeight: 50 }} value={form.latin_text || ''} onChange={(e) => setForm({ ...form, latin_text: e.target.value })} /></div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button onClick={saveGuide} style={btnPrimary}>Simpan</button>
                      <button onClick={() => setEditing(null)} style={btnSecondary}>Batal</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginRight: 10 }}>{g.step_number}.</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{g.title}</span>
                      <span style={{ fontSize: 13, color: C.muted, marginLeft: 10 }}>{g.subtitle}</span>
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
          <LoadState isLoading={isLoading} error={loadError} onRetry={reload} isEmpty={duas.length === 0}
            emptyText="Belum ada doa. Doa dibuat lewat seed atau API, lalu bisa disunting di sini." />
          {duas.map((d) => (
            <div key={d.id} style={cardStyle}>
              {editing === d.id ? (
                <div>
                  <div style={editGrid}>
                    <div><label style={label} htmlFor="content-judul-1">Judul</label><input id="content-judul-1" style={input} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                    <div><label style={label} htmlFor="content-konteks">Konteks</label><input id="content-konteks" style={input} value={form.context || ''} onChange={(e) => setForm({ ...form, context: e.target.value })} /></div>
                  </div>
                  <label style={{ ...label, marginTop: 10 }} htmlFor="content-teks-arab-1">Teks Arab</label>
                  <textarea id="content-teks-arab-1" style={{ ...input, minHeight: 50, direction: 'rtl' }} value={form.arabic_text || ''} onChange={(e) => setForm({ ...form, arabic_text: e.target.value })} />
                  <label style={{ ...label, marginTop: 10 }} htmlFor="content-teks-latin-1">Teks Latin</label>
                  <textarea id="content-teks-latin-1" style={{ ...input, minHeight: 40 }} value={form.latin_text || ''} onChange={(e) => setForm({ ...form, latin_text: e.target.value })} />
                  <label style={{ ...label, marginTop: 10 }} htmlFor="content-terjemahan">Terjemahan</label>
                  <textarea id="content-terjemahan" style={{ ...input, minHeight: 40 }} value={form.translation || ''} onChange={(e) => setForm({ ...form, translation: e.target.value })} />
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button onClick={saveDua} style={btnPrimary}>Simpan</button>
                    <button onClick={() => setEditing(null)} style={btnSecondary}>Batal</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{d.title}</span>
                    <span style={{ fontSize: 13, color: C.muted, marginLeft: 10 }}>{d.context}</span>
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

const cardStyle: React.CSSProperties = { ...card, padding: '14px 18px', marginBottom: 8 };
const editGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
