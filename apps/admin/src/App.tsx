import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { getUser, logout } from './api';
import { useIdleTimeout } from './useIdleTimeout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Groups from './pages/Groups';
import Content from './pages/Content';
import GpsValidation from './pages/GpsValidation';
import { C, R } from './theme';


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
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Pengguna' },
  { to: '/groups', label: 'Rombongan' },
  { to: '/content', label: 'Konten' },
  { to: '/gps-validation', label: 'Validasi GPS' },
];

function Layout({ children }: { children: React.ReactNode }) {
  const user = getUser();
  useIdleTimeout(); // auto-logout setelah idle (hanya di area terautentikasi)
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 220, background: C.sidebar, padding: '24px 0',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0 20px', marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.sidebarText, letterSpacing: -0.5 }}>
            Mabrur
          </div>
          <div style={{ fontSize: 11, color: C.sidebarMuted, marginTop: 2 }}>Panel Admin</div>
        </div>
        <nav style={{ flex: 1 }} aria-label="Menu utama">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? C.sidebarActiveText : C.sidebarMuted,
                background: isActive ? C.sidebarActiveBg : 'transparent',
                // Emas, bukan zamrud: zamrud di sidebar gelap hanya 2,18:1 sehingga penanda aktif tak terlihat.
                borderLeft: isActive ? `3px solid ${C.gold}` : '3px solid transparent',
                textDecoration: 'none',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 12, color: C.sidebarMuted }}>{user?.name}</div>
          <button
            onClick={logout}
            style={{
              marginTop: 8, background: 'transparent', border: `1px solid ${C.sidebarBorder}`,
              color: C.sidebarMuted, padding: '6px 14px', borderRadius: R.sm, fontSize: 12,
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
                <Route path="/gps-validation" element={<GpsValidation />} />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
