import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Dashboard() {
  const [counts, setCounts] = useState({ users: 0, groups: 0, sos: 0 });

  useEffect(() => {
    (async () => {
      try {
        const users = await api<{ meta: { total: number } }>('/users?limit=1');
        const groups = await api<{ meta: { total: number } }>('/groups?limit=1');
        setCounts({
          users: users?.meta?.total ?? 0,
          groups: groups?.meta?.total ?? 0,
          sos: 0,
        });
      } catch {}
    })();
  }, []);

  const cards = [
    { label: 'Total Pengguna', value: counts.users, color: '#8B2E2E' },
    { label: 'Rombongan', value: counts.groups, color: '#4A7C3A' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1F1B16' }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: '#8C6B4A', marginTop: 4 }}>
        Ringkasan sistem Mabrur.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
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
