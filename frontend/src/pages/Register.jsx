import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/register', form)
      login(res.data.access_token, res.data.user)
      navigate(res.data.user?.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--app-bg) 0%, var(--app-bg-soft) 50%, var(--app-bg) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      padding: '24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@300;600&display=swap');
        .auth-input {
          width: 100%; padding: 12px 16px;
          border: 1.5px solid var(--border-soft); border-radius: 12px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: all 0.2s;
          background: var(--surface-panel-alt); box-sizing: border-box; color: var(--text-strong);
        }
        .auth-input:focus { border-color: var(--brand-accent); background: var(--surface-panel); box-shadow: 0 0 0 3px rgba(16,185,129,0.14); }
        .auth-input::placeholder { color: var(--text-muted); }
        .auth-btn-register {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, var(--brand-accent), var(--brand-primary));
          color: #0b1120; border: none; border-radius: 12px;
          font-size: 15px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 16px rgba(16,185,129,0.28);
          transition: all 0.2s;
        }
        .auth-btn-register:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(16,185,129,0.36); transform: translateY(-1px); }
        .auth-btn-register:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{
        background: 'var(--surface-panel)', borderRadius: 24,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(16,185,129,0.08), 0 4px 16px rgba(0,0,0,0.04)',
        border: '1px solid rgba(16,185,129,0.08)',
        animation: 'fadeUp 0.4s both',
      }}>
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌏</div>
          <h1 style={{
            fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600,
            color: 'var(--text-strong)', margin: '0 0 6px', letterSpacing: -0.5,
          }}>
            Bắt đầu hành trình
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Tạo tài khoản miễn phí chỉ trong 30 giây
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, padding: '10px 14px', marginBottom: 20,
            fontSize: 13, color: '#dc2626', textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 6 }}>
              Họ và tên
            </label>
            <input
              className="auth-input" type="text" placeholder="Nguyễn Văn A"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              className="auth-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: 6 }}>
              Mật khẩu
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>ít nhất 6 ký tự</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="auth-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required minLength={6}
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)',
              }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            className="auth-btn-register"
            onClick={handleSubmit}
            disabled={loading}
            style={{ marginTop: 6 }}
          >
            {loading ? '⏳ Đang tạo tài khoản...' : '🚀 Tạo tài khoản'}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hoặc</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ color: 'var(--brand-accent)', fontWeight: 600, textDecoration: 'none' }}>
            Đăng nhập →
          </Link>
        </p>
      </div>
    </div>
  )
}
