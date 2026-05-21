import { useEffect, useState } from 'react'
import api from '../services/api'

const STYLES = [
  { label: 'Biển', icon: '🌊' },
  { label: 'Núi rừng', icon: '⛰️' },
  { label: 'Ẩm thực', icon: '🍜' },
  { label: 'Check-in', icon: '📸' },
  { label: 'Văn hóa', icon: '🏛️' },
  { label: 'Lịch sử', icon: '📚' },
  { label: 'Phiêu lưu', icon: '🚵' },
  { label: 'Gia đình', icon: '👨‍👩‍👧' },
  { label: 'Lãng mạn', icon: '💕' },
  { label: 'Mua sắm', icon: '🛍️' },
  { label: 'Nightlife', icon: '🌃' },
  { label: 'Nghỉ dưỡng', icon: '🧘' },
]

const BUDGET_PRESETS = [
  { label: 'Tiết kiệm', value: '1500000', desc: '~1.5 triệu' },
  { label: 'Trung bình', value: '3000000', desc: '~3 triệu' },
  { label: 'Thoải mái', value: '6000000', desc: '~6 triệu' },
]

const CREATE_TRIP_TIMEOUT_MS = 120000
const RECOVERY_POLL_RETRIES = 5
const RECOVERY_POLL_INTERVAL_MS = 2000

function calcDays(start, end) {
  if (!start || !end) return 0
  const diff = new Date(end) - new Date(start)
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function sanitizeBudgetInput(value) {
  return String(value || '').replace(/[^\d]/g, '')
}

function formatBudgetInput(value) {
  const digits = sanitizeBudgetInput(value)
  if (!digits) return ''
  return Number(digits).toLocaleString('vi-VN')
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isTimeoutError(err) {
  return err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')
}

function shouldAttemptRecovery(err) {
  if (isTimeoutError(err)) return true
  if (!err?.response) return true
  const status = Number(err.response.status)
  return status >= 500 || status === 408 || status === 429
}

function extractErrorMessage(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message
    if (typeof detail.error === 'string' && detail.error.trim()) return detail.error
  }
  return ''
}

// editTrip: { id, destination, departure_city, days, budget, travel_style }
export default function TripForm({ onTripCreated, editTrip }) {
  const isEdit = !!editTrip

  const [form, setForm] = useState({
    destination: editTrip?.destination || '',
    departure_city: editTrip?.departure_city || '',
    start_date: today(),
    end_date: (() => {
      if (editTrip?.days) {
        const end = new Date()
        end.setDate(end.getDate() + editTrip.days)
        return end.toISOString().split('T')[0]
      }
      return new Date(Date.now() + 86400000).toISOString().split('T')[0]
    })(),
    budget: editTrip?.budget || '3000000',
    travel_style: editTrip?.travel_style
      ? (typeof editTrip.travel_style === 'string'
          ? editTrip.travel_style.split(',')
          : editTrip.travel_style)
      : [],
    people: editTrip?.people || 2,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [destinationSuggestions, setDestinationSuggestions] = useState([])
  const [departureSuggestions, setDepartureSuggestions] = useState([])

  const days = calcDays(form.start_date, form.end_date)

  useEffect(() => {
    const q = String(form.destination || '').trim()
    if (q.length < 2) {
      setDestinationSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/maps/autocomplete', { params: { q, limit: 6 } })
        setDestinationSuggestions((res.data?.suggestions || []).slice(0, 6))
      } catch {
        setDestinationSuggestions([])
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [form.destination])

  useEffect(() => {
    const q = String(form.departure_city || '').trim()
    if (q.length < 2) {
      setDepartureSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/maps/autocomplete', { params: { q, limit: 6 } })
        setDepartureSuggestions((res.data?.suggestions || []).slice(0, 6))
      } catch {
        setDepartureSuggestions([])
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [form.departure_city])

  const toggleStyle = (style) => {
    setForm(prev => ({
      ...prev,
      travel_style: prev.travel_style.includes(style)
        ? prev.travel_style.filter(s => s !== style)
        : [...prev.travel_style, style]
    }))
  }

  const handleStartDate = (val) => {
    setForm(prev => {
      const newEnd = val >= prev.end_date
        ? new Date(new Date(val).getTime() + 86400000).toISOString().split('T')[0]
        : prev.end_date
      return { ...prev, start_date: val, end_date: newEnd }
    })
  }

  const handleBudgetInput = (value) => {
    setForm(prev => ({ ...prev, budget: sanitizeBudgetInput(value) }))
  }

  const findRecoveredTrip = async (payload, startedAt) => {
    const fromTime = startedAt - 15000
    const normDestination = payload.destination.trim().toLowerCase()

    for (let i = 0; i < RECOVERY_POLL_RETRIES; i++) {
      const listRes = await api.get('/trips/my-trips', { timeout: 10000 })
      const trips = listRes.data || []
      const strictCandidates = trips
        .filter((trip) => {
          const createdAt = Date.parse(trip.created_at)
          if (Number.isNaN(createdAt) || createdAt < fromTime) return false
          return (
            String(trip.destination || '').trim().toLowerCase() === normDestination &&
            Number(trip.days) === Number(payload.days) &&
            String(trip.budget) === String(payload.budget)
          )
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

      if (strictCandidates.length > 0) return strictCandidates[0]

      // Fallback nhe: mot so backend co the chuan hoa budget, van uu tien destination + created_at
      const relaxedCandidates = trips
        .filter((trip) => {
          const createdAt = Date.parse(trip.created_at)
          if (Number.isNaN(createdAt) || createdAt < fromTime) return false
          return String(trip.destination || '').trim().toLowerCase() === normDestination
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

      if (relaxedCandidates.length > 0) return relaxedCandidates[0]
      if (i < RECOVERY_POLL_RETRIES - 1) await sleep(RECOVERY_POLL_INTERVAL_MS)
    }

    return null
  }

  const createTripWithRecovery = async (payload, startedAt) => {
    try {
      return await api.post('/trips/', payload, { timeout: CREATE_TRIP_TIMEOUT_MS })
    } catch (err) {
      if (!shouldAttemptRecovery(err)) throw err
      const recovered = await findRecoveredTrip(payload, startedAt)
      if (recovered) return { data: recovered }
      throw err
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.departure_city) { setError('Vui lòng nhập thành phố xuất phát'); return }
    if (form.travel_style.length === 0) { setError('Vui lòng chọn ít nhất 1 phong cách'); return }
    if (days < 1) { setError('Ngày về phải sau ngày đi'); return }
    const budget = sanitizeBudgetInput(form.budget)
    if (!budget) { setError('Vui lòng nhập ngân sách'); return }
    if (budget !== form.budget) setForm(prev => ({ ...prev, budget }))
    const payload = {
      destination: form.destination,
      departure_city: form.departure_city,
      days: days,
      budget,
      travel_style: form.travel_style,
      people: form.people,
    }
    const startedAt = Date.now()
    setLoading(true); setError('')
    try {
      let res
      if (isEdit) {
        res = await api.post(`/trips/${editTrip.id}/regenerate`, payload, { timeout: CREATE_TRIP_TIMEOUT_MS })
        if (typeof onTripCreated === 'function') {
          try {
            onTripCreated(res.data)
          } catch (callbackError) {
            console.error('onTripCreated failed after successful update:', callbackError)
            setError('Lịch trình đã cập nhật nhưng chưa hiển thị tự động. Vui lòng tải lại trang.')
          }
        }
      } else {
        res = await createTripWithRecovery(payload, startedAt)
        if (typeof onTripCreated === 'function') {
          try {
            onTripCreated(res.data)
          } catch (callbackError) {
            console.error('onTripCreated failed after successful create:', callbackError)
            const createdId = res?.data?.id
            if (createdId) {
              window.location.assign(`/trips/${createdId}`)
              return
            }
            setError('Lịch trình đã tạo nhưng chưa mở tự động. Vui lòng tải lại trang.')
          }
        }
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        setError('Hệ thống xử lý lâu hơn dự kiến. Nếu trip đã tạo xong, nó sẽ xuất hiện sau khi tải lại trang.')
        return
      }
      setError(extractErrorMessage(err) || 'Có lỗi xảy ra, thử lại nhé!')
    } finally { setLoading(false) }
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes progressBar {
            0% { width: 0%; }
            20% { width: 25%; }
            50% { width: 55%; }
            80% { width: 78%; }
            95% { width: 90%; }
          }
          @keyframes dotBounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-8px); }
          }
        `}</style>

        <div style={{ background: 'var(--surface-panel)', borderRadius: 20, border: '1px solid var(--border-soft)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '48px 28px', textAlign: 'center', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
          <div style={{ animation: 'fadeInUp 0.5s ease' }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 300, color: 'var(--text-strong)', margin: '0 0 8px 0', letterSpacing: -0.3 }}>
              {isEdit ? 'AI đang sửa lại lịch trình' : 'AI đang lên kế hoạch cho bạn'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              Đang phân tích <strong style={{ color: 'var(--brand-primary)' }}>{form.destination}</strong> · {days} ngày · {form.people} người
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            {[
              { icon: '🗺️', text: 'Phân tích điểm đến', delay: '0s' },
              { icon: '📅', text: 'Lên lịch trình theo ngày', delay: '0.8s' },
              { icon: '💰', text: 'Tính toán ngân sách', delay: '1.6s' },
              { icon: '🏠', text: 'Gợi ý chỗ ở & ăn uống', delay: '2.4s' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: 'var(--surface-muted)', border: '1px solid var(--border-soft)', animation: `pulse 2s ease-in-out infinite ${step.delay}` }}>
                <span style={{ fontSize: 18 }}>{step.icon}</span>
                {/* Sửa màu chữ '#475569' thành biến hệ thống */}
                <span style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 500 }}>{step.text}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                  {[0,1,2].map(d => (
                    <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-primary)', animation: `dotBounce 1.2s ease-in-out infinite`, animationDelay: `${d * 0.2}s` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', maxWidth: 300 }}>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--brand-primary), var(--accent-indigo))', borderRadius: 999, animation: 'progressBar 25s ease forwards' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              Vui lòng chờ trong vài giây ⏱
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,300;1,300&display=swap');
        .form-input { width: 100%; border: 1.5px solid var(--border-soft); border-radius: 12px; padding: 12px 16px; font-size: 15px; color: var(--text-strong); outline: none; transition: all 0.2s; font-family: 'DM Sans', sans-serif; box-sizing: border-box; background: var(--surface-panel); }
        .form-input:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(34,211,238,0.14); }
        .form-label { font-size: 13px; font-weight: 500; color: var(--text-soft); margin-bottom: 8px; display: block; }
        .style-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; border: 1.5px solid var(--border-soft); background: var(--surface-panel); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-soft); transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .style-btn:hover { border-color: #bfdcf5; background: #f5fbff; transform: translateY(-1px); }
        .style-btn.active { border-color: var(--brand-primary); background: rgba(34,211,238,0.12); color: var(--brand-primary); box-shadow: 0 8px 18px rgba(34,211,238,0.12); }
        .budget-btn { flex: 1; padding: 12px; border-radius: 12px; border: 1.5px solid var(--border-soft); background: var(--surface-panel); cursor: pointer; text-align: center; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .budget-btn:hover { border-color: #bfdcf5; transform: translateY(-1px); }
        .budget-btn.active { border-color: var(--brand-primary); background: rgba(34,211,238,0.12); }
        .counter-btn { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid var(--border-soft); background: var(--surface-panel); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; color: var(--text-soft); }
        .counter-btn:hover { border-color: var(--brand-primary); color: var(--brand-primary); }
        .trip-date-field { display: flex; flex-direction: column; }
        .trip-date-caption { font-size: 12px; color: #94a3b8; margin-bottom: 6px; line-height: 1.25; min-height: 15px; }
        .trip-date-input { height: 44px; min-height: 44px; font-size: 15px; line-height: 1.2; appearance: none; -webkit-appearance: none; }
        .trip-date-input::-webkit-datetime-edit { padding: 0; line-height: 1.2; }
        .trip-date-input::-webkit-date-and-time-value { text-align: left; min-height: 1.2em; }
        .trip-date-input::-webkit-calendar-picker-indicator { opacity: 0.9; }
        .trip-form-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 22px; }
        .trip-panel { background: linear-gradient(180deg, var(--surface-panel), var(--surface-panel-alt)); border: 1px solid var(--border-soft); border-radius: 18px; padding: 20px; }
        .trip-panel-title { margin: 0 0 16px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
        .budget-value-row { display: flex; align-items: baseline; gap: 8px; }
        .budget-value-input { width: 100%; min-width: 0; border: 0; border-bottom: 1.5px solid var(--border-soft); border-radius: 0; padding: 0 0 4px; background: transparent; font-size: 24px; font-weight: 700; color: var(--text-strong); font-family: 'Fraunces', serif; letter-spacing: -0.02em; outline: none; }
        .budget-value-input:focus { border-bottom-color: var(--brand-primary); box-shadow: none; }
        .budget-value-unit { font-size: 14px; font-weight: 700; color: var(--text-muted); white-space: nowrap; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
        .summary-card { border-radius: 14px; background: var(--surface-panel-alt); border: 1px solid var(--border-soft); padding: 12px 14px; }
        .summary-card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px; }
        .summary-card-value { font-size: 14px; font-weight: 700; color: var(--text-strong); line-height: 1.45; }
        @media (max-width: 768px) {
          .trip-form-grid { grid-template-columns: 1fr !important; }
          .trip-location-grid { grid-template-columns: 1fr !important; }
          .trip-date-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .trip-date-field { width: 100%; }
          .trip-date-input { font-size: 16px; }
          .budget-presets { flex-direction: column !important; }
          .summary-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ background: 'var(--surface-panel)', borderRadius: 20, border: isEdit ? '1.5px solid #c7d2fe' : '1px solid var(--border-soft)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-soft)', background: 'linear-gradient(135deg, var(--surface-strong), var(--surface-panel))' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 300, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.3 }}>
            {isEdit ? '🔄 Sửa lịch trình' : '✈️ Tạo lịch trình mới'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {isEdit
              ? 'Chỉnh lại thông tin bên dưới — AI sẽ tạo lịch trình mới đè lên lịch cũ'
              : 'Điền thông tin bên dưới để AI tạo lịch trình cho bạn'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '28px' }}>
          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fee2e2', borderRadius: 10, padding: '12px 16px', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
              ⚠️ {error}
            </div>
          )}

          <div className="trip-form-grid">
            <div className="trip-panel">
              <h3 className="trip-panel-title">Thông tin chuyến đi</h3>
              <div className="trip-location-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label className="form-label">🏠 Xuất phát từ</label>
                  <input value={form.departure_city}
                    onChange={e => setForm({ ...form, departure_city: e.target.value })}
                    placeholder="Nhập tỉnh/thành phố..."
                    list="departure-city-suggestions"
                    className="form-input" required />
                  <datalist id="departure-city-suggestions">
                    {departureSuggestions.map((s) => (
                      <option key={`${s.place_id || s.description}-${s.main_text || ''}`} value={s.description || s.main_text || ''} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="form-label">📍 Điểm đến</label>
                  <input value={form.destination}
                    onChange={e => setForm({ ...form, destination: e.target.value })}
                    placeholder="Đà Nẵng, Hội An, Phú Quốc..."
                    list="destination-suggestions"
                    className="form-input" required />
                  <datalist id="destination-suggestions">
                    {destinationSuggestions.map((s) => (
                      <option key={`${s.place_id || s.description}-${s.main_text || ''}`} value={s.description || s.main_text || ''} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="form-label">📅 Thời gian chuyến đi</label>
                <div className="trip-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="trip-date-field">
                    <div className="trip-date-caption">Ngày đi</div>
                    <input type="date" value={form.start_date} min={today()}
                      onChange={e => handleStartDate(e.target.value)}
                      className="form-input trip-date-input" />
                  </div>
                  <div className="trip-date-field">
                    <div className="trip-date-caption">Ngày về</div>
                    <input type="date" value={form.end_date} min={form.start_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      className="form-input trip-date-input" />
                  </div>
                </div>
                {days > 0 && (
                  <div style={{ 
                    background: 'var(--surface-muted)', // Thay nền cứng bằng biến
                    border: '1px solid var(--border-soft)', // Đổi màu viền
                    borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-strong)' }}> {/* Sửa màu chữ */}
                      📆 {formatDate(form.start_date)} → {formatDate(form.end_date)}
                    </span>
                    <span style={{ 
                      fontSize: 13, fontWeight: 700, 
                      color: 'var(--brand-primary)', // Sửa màu chữ
                      background: 'var(--surface-panel)', // Sửa màu nền
                      border: '1px solid var(--border-soft)',
                      padding: '4px 12px', borderRadius: 999 
                    }}>
                      {days} ngày
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label">👥 Số người</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="button" className="counter-btn"
                      onClick={() => setForm(f => ({ ...f, people: Math.max(1, f.people - 1) }))}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-strong)', minWidth: 32, textAlign: 'center' }}>{form.people}</span>
                    <button type="button" className="counter-btn"
                      onClick={() => setForm(f => ({ ...f, people: Math.min(20, f.people + 1) }))}>+</button>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>người</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">💰 Ngân sách / người</label>
                  <div className="budget-value-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="budget-value-input"
                      value={formatBudgetInput(form.budget)}
                      onChange={e => handleBudgetInput(e.target.value)}
                      aria-label="Nhập ngân sách mỗi người"
                    />
                    <span className="budget-value-unit">đ / người</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="trip-panel">
              <h3 className="trip-panel-title">Tùy chọn và tóm tắt</h3>

              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Mức gợi ý nhanh</label>
                <div className="budget-presets" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {BUDGET_PRESETS.map(b => (
                  <button key={b.value} type="button"
                    className={`budget-btn ${form.budget === b.value ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, budget: b.value })}>
                    {/* Đổi màu '#1d4ed8' và '#0f0f1a' thành biến CSS */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: form.budget === b.value ? 'var(--brand-primary)' : 'var(--text-strong)' }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.desc}</div>
                  </button>
                ))}
              </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="form-label">🎯 Sở thích</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {STYLES.map(s => (
                    <button key={s.label} type="button"
                      className={`style-btn ${form.travel_style.includes(s.label) ? 'active' : ''}`}
                      onClick={() => toggleStyle(s.label)}>
                      <span>{s.icon}</span> {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="summary-grid">
                <div className="summary-card">
                  <div className="summary-card-label">Xuất phát</div>
                  <div className="summary-card-value">{form.departure_city || 'Chưa nhập'}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-card-label">Điểm đến</div>
                  <div className="summary-card-value">{form.destination || 'Chưa chọn'}</div>
                </div> 
                <div className="summary-card">
                  <div className="summary-card-label">Số ngày</div>
                  <div className="summary-card-value">{days > 0 ? `${days}` : 'Chưa hợp lệ'}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-card-label">Số người</div>
                  <div className="summary-card-value">{form.people}</div>
                </div>
              </div>

              {form.destination && form.departure_city && form.travel_style.length > 0 && days > 0 && (
                <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: '1px solid var(--border-soft)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  📋 AI sẽ tạo lịch trình <strong style={{ color: 'var(--text-strong)' }}>{days} ngày</strong> từ{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{form.departure_city}</strong> đến{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{form.destination}</strong> cho{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{form.people} người</strong>, phong cách{' '}
                  <strong style={{ color: 'var(--brand-primary)' }}>{form.travel_style.join(', ')}</strong>
                  {isEdit && <span style={{ color: '#f59e0b' }}> — sẽ đè lên lịch trình cũ</span>}
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ 
              marginTop: 24, 
              width: '100%', 
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, var(--brand-primary), var(--accent-indigo))', 
              color: '#fff', 
              padding: '14px', 
              borderRadius: 12, 
              border: 'none', 
              boxShadow: loading ? 'none' : '0 4px 16px rgba(34,211,238,0.28)',
              fontSize: 15, 
              fontWeight: 700, 
              cursor: loading ? 'not-allowed' : 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8, 
              transition: 'all 0.3s ease', 
              fontFamily: "'DM Sans', sans-serif" 
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(34,211,238,0.36)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(34,211,238,0.28)'
              }
            }}
          >
            {isEdit ? '🔄 Sửa lịch trình' : '✨ Tạo lịch trình với AI'}
          </button>
        </form>
      </div>
    </div>
  )
}
