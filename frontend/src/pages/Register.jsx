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
      background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      padding: '24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@300;600&display=swap');
        .auth-input {
          width: 100%; padding: 12px 16px;
          border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: all 0.2s;
          background: #fafafa; box-sizing: border-box; color: #0f172a;
        }
        .auth-input:focus { border-color: #10b981; background: white; box-shadow: 0 0 0 3px rgba(16,185,129,0.08); }
        .auth-input::placeholder { color: #94a3b8; }
        .auth-btn-register {
          width: 100%; padding: 13px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white; border: none; border-radius: 12px;
          font-size: 15px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 16px rgba(16,185,129,0.35);
          transition: all 0.2s;
        }
        .auth-btn-register:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(16,185,129,0.45); transform: translateY(-1px); }
        .auth-btn-register:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{
        background: 'white', borderRadius: 24,
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
            color: '#0f172a', margin: '0 0 6px', letterSpacing: -0.5,
          }}>
            Bắt đầu hành trình
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
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
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Họ và tên
            </label>
            <input
              className="auth-input" type="text" placeholder="Nguyễn Văn A"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              className="auth-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Mật khẩu
              <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>ít nhất 6 ký tự</span>
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
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8',
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
          <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>hoặc</span>
          <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#64748b', margin: 0 }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
            Đăng nhập →
          </Link>
        </p>
      </div>
    </div>
  )
}
