import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { getUser, logout } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Groups from './pages/Groups';
import Content from './pages/Content';

const C = {
  primary: '#8B2E2E',
  bg: '#F5F1E8',
  sidebar: '#1F1B16',
  text: '#F5F1E8',
  muted: '#B89A7A',
  border: '#ECE5D8',
};

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    logout();
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const nav = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/users', label: 'Pengguna', icon: '◉' },
  { to: '/groups', label: 'Rombongan', icon: '◎' },
  { to: '/content', label: 'Konten', icon: '◇' },
];

function Layout({ children }: { children: React.ReactNode }) {
  const user = getUser();
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: C.sidebar, padding: '24px 0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0 20px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>
            Mabrur
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Panel Admin</div>
        </div>
        <nav style={{ flex: 1 }}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : C.muted,
                background: isActive ? 'rgba(139,46,46,0.3)' : 'transparent',
                borderLeft: isActive ? `3px solid ${C.primary}` : '3px solid transparent',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: 16 }}>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 12, color: C.muted }}>{user?.name}</div>
          <button
            onClick={logout}
            style={{
              marginTop: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: C.muted, padding: '6px 14px', borderRadius: 8, fontSize: 12,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: 'auto', background: C.bg }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/users" element={<Users />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/content" element={<Content />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
