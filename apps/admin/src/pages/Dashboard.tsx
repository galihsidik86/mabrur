import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import LoadState from '../components/LoadState';
import { C } from '../theme';
import { card } from '../ui';

interface Counts {
  users: number;
  groups: number;
  guides: number;
  duas: number;
  miqatZones: number;
}

export default function Dashboard() {
  // null = belum termuat; jangan tampilkan 0 yang bisa dikira data asli.
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [users, groups, guides, duas, zones] = await Promise.all([
        api<any>('/users?limit=1'),
        api<any>('/groups?limit=1'),
        api<any>('/ibadah-guides'),
        api<any>('/duas'),
        api<any>('/miqat-zones'),
      ]);

      const guideData = Array.isArray(guides) ? guides : guides?.data ?? [];
      const duaData = Array.isArray(duas) ? duas : duas?.data ?? [];
      const zoneData = Array.isArray(zones) ? zones : zones?.data ?? [];

      setCounts({
        users: users?.meta?.total ?? 0,
        groups: groups?.meta?.total ?? 0,
        guides: guideData.length,
        duas: duaData.length,
        miqatZones: zoneData.length,
      });
    } catch (err: any) {
      setError(err?.message || 'Server tidak merespons.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Pengguna aktif', value: counts?.users, color: C.primary },
    { label: 'Rombongan', value: counts?.groups, color: C.primary },
    { label: 'Tuntunan Ibadah', value: counts?.guides, color: C.primary },
    { label: 'Doa & Bacaan', value: counts?.duas, color: C.primary },
    { label: 'Zona Miqat', value: counts?.miqatZones, color: C.accent },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
        Ringkasan sistem Mabrur.
      </p>

      <LoadState isLoading={false} error={error} onRetry={load} isEmpty={false} emptyText="" />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 16,
        marginTop: 24,
      }}>
        {cards.map((c) => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{c.value ?? '–'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
