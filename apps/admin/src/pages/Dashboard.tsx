import { useEffect, useState } from 'react';
import { api } from '../api';

interface Counts {
  users: number;
  groups: number;
  guides: number;
  duas: number;
  schedules: number;
  miqatZones: number;
}

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts>({
    users: 0, groups: 0, guides: 0, duas: 0, schedules: 0, miqatZones: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [users, groups, guides, duas, zones] = await Promise.all([
          api<any>('/users?limit=1'),
          api<any>('/groups?limit=1'),
          api<any>('/ibadah-guides'),
          api<any>('/duas'),
          api<any>('/miqat-zones'),
        ]);

        // Hitung jadwal dari grup pertama (jika ada)
        let scheduleCount = 0;
        const groupList = groups?.data ?? groups;
        if (Array.isArray(groupList) && groupList.length > 0) {
          try {
            const sched = await api<any>(`/groups/${groupList[0].id}/schedules`);
            const schedData = Array.isArray(sched) ? sched : sched?.data ?? [];
            scheduleCount = schedData.length;
          } catch {}
        }

        const guideData = Array.isArray(guides) ? guides : guides?.data ?? [];
        const duaData = Array.isArray(duas) ? duas : duas?.data ?? [];
        const zoneData = Array.isArray(zones) ? zones : zones?.data ?? [];

        setCounts({
          users: users?.meta?.total ?? 0,
          groups: groups?.meta?.total ?? 0,
          guides: guideData.length,
          duas: duaData.length,
          schedules: scheduleCount,
          miqatZones: zoneData.length,
        });
      } catch {}
    })();
  }, []);

  const cards = [
    { label: 'Pengguna', value: counts.users, color: '#8B2E2E' },
    { label: 'Rombongan', value: counts.groups, color: '#4A7C3A' },
    { label: 'Tuntunan Ibadah', value: counts.guides, color: '#D4A437' },
    { label: 'Doa & Bacaan', value: counts.duas, color: '#5C3A1E' },
    { label: 'Jadwal', value: counts.schedules, color: '#4A7C3A' },
    { label: 'Zona Miqat', value: counts.miqatZones, color: '#8B2E2E' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1F1B16' }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: '#8C6B4A', marginTop: 4 }}>
        Ringkasan sistem Mabrur.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 16,
        marginTop: 24,
      }}>
        {cards.map((c) => (
          <div key={c.label} style={{
            background: '#fff', border: '1px solid #ECE5D8', borderRadius: 14,
            padding: 20, boxShadow: '0 2px 8px rgba(92,58,30,0.06)',
          }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8C6B4A', marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
