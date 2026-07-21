import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getUser } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const idle = new URLSearchParams(window.location.search).get('idle') === '1';

  if (getUser()?.role === 'admin') {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(phone, password);
      if (user.role !== 'admin') {
        localStorage.clear();
        setError('Hanya admin yang bisa mengakses panel ini.');
        return;
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F1E8',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 380, background: '#fff', borderRadius: 16, padding: 32,
        border: '1px solid #ECE5D8', boxShadow: '0 4px 20px rgba(92,58,30,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: '#8B2E2E',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#F5D98A', fontSize: 20, fontWeight: 800,
          }}>M</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#5C3A1E', marginTop: 12 }}>
            Mabrur Admin
          </h1>
          <p style={{ fontSize: 13, color: '#8C6B4A', marginTop: 4 }}>
            Masuk untuk mengelola sistem
          </p>
        </div>

        {idle && (
          <p style={{
            background: '#FAEFC9', color: '#7A5A10', fontSize: 12.5, lineHeight: 1.4,
            padding: '10px 12px', borderRadius: 10, marginBottom: 16, textAlign: 'center',
          }}>
            Sesi berakhir otomatis karena tidak ada aktivitas. Silakan masuk kembali.
          </p>
        )}

        <label style={labelStyle}>Nomor HP</label>
        <input
          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="08xxxxxxxxxx"
          style={inputStyle} required
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan password"
            style={{ ...inputStyle, paddingRight: 76 }} required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
              fontSize: 12, fontWeight: 700, color: '#8B2E2E',
            }}
          >
            {showPassword ? 'Sembunyikan' : 'Lihat'}
          </button>
        </div>

        {error && <p style={{ color: '#C44536', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', marginTop: 20, padding: '13px 0', background: '#8B2E2E',
            color: '#F5F1E8', border: 'none', borderRadius: 12, fontSize: 15,
            fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#5C3A1E', marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1px solid #ECE5D8',
  borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff',
};
