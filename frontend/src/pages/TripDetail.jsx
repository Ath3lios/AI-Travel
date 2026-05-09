import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ItineraryView from '../components/ItineraryView'
import TripForm from '../components/TripForm'
import { LoadingState } from '../components/ui/StateBlocks'
import api from '../services/api'

const OVERVIEW_BUDGET_LABELS = {
  luu_tru: '🏠 Lưu trú',
  an_uong: '🍜 Ăn uống',
  di_chuyen: '🚗 Di chuyển',
  hoat_dong: '🎯 Hoạt động',
  mua_sam_phat_sinh: '🛍️ Mua sắm',
}

function estimatePlaces(itineraryDays) {
  return itineraryDays.reduce((sum, day) => sum + (day.schedule?.length || 0), 0)
}

const OverviewTab = memo(function OverviewTab({ itinerary, onSwitchToDay }) {
  const itineraryDays = useMemo(() => itinerary?.days || [], [itinerary?.days])

  const dayPlacePreview = useMemo(
    () =>
      itineraryDays.map((day) => ({
        day,
        places: day.schedule?.map((s) => s.place).filter(Boolean) || [],
      })),
    [itineraryDays]
  )

  if (!itineraryDays.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        .overview-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .overview-main, .overview-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .overview-card { background: var(--surface-panel); border: 1px solid var(--border-soft); border-radius: 16px; padding: 16px 18px; }
        @media (min-width: 1024px) {
          .overview-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
          .overview-main {
            gap: 0;
            border: 1px solid var(--border-soft);
            border-radius: 16px;
            overflow: hidden;
            background: var(--surface-panel);
            height: 100%;
          }
          .overview-main .overview-card {
            background: transparent;
            border: 0;
            border-top: 1px solid var(--border-soft);
            border-radius: 0;
          }
          .overview-main .overview-card:first-child {
            border-top: 0;
          }
          .overview-main .overview-card:last-child {
            flex: 1;
          }
          .overview-side {
            gap: 0;
            border: 1px solid var(--border-soft);
            border-radius: 16px;
            overflow: hidden;
            background: var(--surface-panel);
            height: 100%;
          }
          .overview-side .overview-card {
            background: transparent;
            border: 0;
            border-top: 1px solid var(--border-soft);
            border-radius: 0;
          }
          .overview-side .overview-card:first-child {
            border-top: 0;
          }
        }
        @media (max-width: 640px) {
          .overview-card { border-radius: 14px; padding: 14px 14px; }
        }
      `}</style>

      {itinerary.trip_summary && (
  <div style={{
    background: 'linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(99,102,241,0.12) 100%)',
    borderRadius: 14,
    padding: '14px 18px',
    border: '1px solid rgba(34,211,238,0.25)',
  }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {itinerary.trip_summary.best_time && (
        <span className="trip-summary-green" style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>🌤️ {itinerary.trip_summary.best_time}</span>
      )}
      {itinerary.trip_summary.estimated_cost && (
        <span className="trip-summary-green" style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>💰 {itinerary.trip_summary.estimated_cost}</span>
      )}
      {itinerary.trip_summary.weather_note && (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📋 {itinerary.trip_summary.weather_note}</span>
      )}
    </div>
  </div>
)}
      <div className='overview-grid'>
        <div className='overview-main'>
          {dayPlacePreview.map(({ day, places }, idx) => (
            <div
              key={idx}
              className='overview-card'
              onClick={() => onSwitchToDay(idx)}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(34,211,238,0.32)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(34,211,238,0.12)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-soft)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* --- 1. HEADER: Tên ngày, tiêu đề và mũi tên nằm chung 1 hàng --- */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {day.day && <div style={{ fontSize:18, fontWeight:700, color:'var(--text-strong)', fontFamily:"'Fraunces', serif", marginBottom: 2 }}>NGÀY {day.day}</div>}
                  {day.title && <div style={{fontSize:14, fontWeight:550, color:'var(--text-muted)', lineHeight: 1.4}}>{day.title}</div>}
                </div>
                {/* Mũi tên dóng hàng với tiêu đề nhìn sẽ cân đối hơn */}
                <span style={{ fontSize: 16, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 16 }}>›</span>
              </div>

              {/* --- 2. WEATHER SECTION: Hiển thị thành một khối riêng biệt, rộng full card --- */}
              {day.weather && (
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    background: 'rgba(16,185,129,0.07)', 
                    padding: '10px 14px', 
                    borderRadius: 12, 
                    marginBottom: 16, 
                    border: '1px solid rgba(16,185,129,0.12)' 
                  }}
                >
                  <span style={{ fontSize: 14 }}>🌤️</span>
                  <p 
                    style={{ 
                      margin: 0, 
                      fontSize: 11.5, 
                      color: '#059669', 
                      fontWeight: 500,
                      whiteSpace: 'normal',
                      lineHeight: 1.5,
                      flex: 1,
                      wordBreak: 'break-word'     
                    }}
                  >
                    {day.weather}
                  </p>
                </div>
              )}

              {/* --- 3. PLACES PREVIEW: Danh sách các điểm đến --- */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {places.slice(0, 5).map((place, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{place}</span>
                    {i < Math.min(places.length, 5) - 1 && <span style={{ color: 'var(--accent-indigo)', fontSize: 11, fontWeight: 700 }}>→</span>}
                  </span>
                ))}
                {places.length > 5 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{places.length - 5} nữa</span>}
              </div>
            </div>
          ))}
        </div>

        <div className='overview-side'>
          {/* 🏨 KHỐI LƯU TRÚ - Đã tinh chỉnh lại padding và font đồng bộ */}
          {itinerary.accommodation?.length > 0 && (
            <div className='overview-card'>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 12 }}>🏨 Gợi ý lưu trú</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {itinerary.accommodation.map((hotel, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{hotel.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hotel.area}</div>
                    </div>
                    <span className="overview-price-green" style={{ fontSize: 12, color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {hotel.price_range}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 💵 KHỐI NGÂN SÁCH - Đồng bộ hoàn toàn layout với khối Lưu trú */}
          {itinerary.budget_breakdown && (
            <div className='overview-card'>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 12 }}>💵 Phân bổ ngân sách</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(itinerary.budget_breakdown).map(([key, val]) => {
                  const rawLabel = OVERVIEW_BUDGET_LABELS[key] || `✨ ${key}`;
                  const icon = rawLabel.split(' ')[0];
                  const title = rawLabel.replace(icon, '').trim();

                  let price = val;
                  let desc = '';
                  if (val.includes('(') && val.endsWith(')')) {
                    const parts = val.split('(');
                    price = parts[0].trim();
                    desc = parts.slice(1).join('(').replace(/\)$/, '').trim();
                  }

                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
                          <span style={{ marginRight: 6 }}>{icon}</span>{title}
                        </div>
                        {desc && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                            {desc}
                          </div>
                        )}
                      </div>
                      <span className="overview-price-green" style={{ fontSize: 12, color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {price}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 🎒 KHỐI ĐỒ CẦN MANG - Chuyển từ dạng Tag sang dạng List để đồng bộ toàn dải */}
          {itinerary.packing_list?.length > 0 && (
            <div className='overview-card'>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 12 }}>🎒 Đồ cần mang</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itinerary.packing_list.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-soft)' }}>
                    <span style={{ color: 'var(--brand-primary)', fontSize: 10 }}>●</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [activeDay, setActiveDay] = useState(0)

  useEffect(() => {
    let active = true
    api.get(`/trips/${id}`)
      .then(res => { if (active) setTrip(res.data) })
      .catch(() => { if (active) navigate('/dashboard') })
      .finally(() => { if (active) setLoading(false) })

    return () => {
      active = false
    }
  }, [id, navigate])

  const handleRegenerated = useCallback((updatedTrip) => {
    setTrip(updatedTrip)
    setShowEditForm(false)
    navigate('/dashboard', { replace: false })
    setTimeout(() => navigate(`/trips/${updatedTrip.id}`), 0)
  }, [navigate])

  const handleSwitchToDay = useCallback((dayIdx) => {
    setActiveDay(dayIdx)
    setActiveTab('itinerary')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }, [])

  const days = useMemo(() => trip?.itinerary?.days || [], [trip])
  const safeActiveDay = useMemo(
    () => (days.length > 0 ? Math.min(activeDay, days.length - 1) : 0),
    [activeDay, days.length]
  )

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '30px auto', padding: '0 12px' }}>
        <LoadingState message='Đang tải lịch trình...' />
      </div>
    )
  }
  if (!trip) return null

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', background: 'linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg-soft) 55%, var(--app-bg) 100%)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@300;600&display=swap');
        .tab-btn {
          padding: 12px 20px; border: none; background: none;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
          cursor: pointer; color: #94a3b8; position: relative; transition: color 0.2s;
          white-space: nowrap;
        }
        .tab-btn.active { color: #0f172a; }
        .tab-btn.active::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 2px; background: var(--brand-primary); border-radius: 2px;
        }
        .day-tab {
          padding: 8px 14px; border: none; background: none; white-space: nowrap;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; color: #94a3b8; border-bottom: 2px solid transparent;
          transition: all 0.2s; flex-shrink: 0;
        }
        .day-tab.active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); }
        .day-tabs-scroll::-webkit-scrollbar { display: none; }
        .trip-detail-wrap { max-width: 1280px; margin: 0 auto; padding: 24px 16px; }
        .trip-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
        .trip-detail-head-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .trip-back-btn {
          background: var(--surface-panel); 
          border: 1px solid var(--border-soft); 
          border-radius: 10px;
          padding: 8px 14px; 
          font-size: 13px; 
          color: var(--text-strong); /* Đổi sang text-strong để chữ trắng sáng ở Dark Mode và đen rõ ở Light Mode */
          cursor: pointer;
          font-family: inherit; 
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .trip-back-btn:hover {
          background: var(--surface-muted);
          border-color: var(--border-strong);
          transform: translateX(-3px); /* Thêm hiệu ứng trượt nhẹ sang trái để nhấn mạnh việc "Quay lại" */
        }
        .trip-title { font-size: 18px; font-weight: 700; color: var(--text-strong); margin: 0; }
        .trip-edit-btn {
          display: flex; align-items: center; gap: 6px;
          border: none; /* Bỏ viền cũ */
          background: linear-gradient(135deg, var(--brand-primary), var(--accent-indigo)); /* Nền gradient đồng bộ */
          color: #fff; /* Chữ màu trắng */
          box-shadow: 0 4px 16px rgba(34,211,238,0.28); /* Thêm bóng đổ cho đẹp */
          padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; font-family: inherit; white-space: nowrap;
        }
        .trip-edit-btn:hover {
          box-shadow: 0 6px 24px rgba(34,211,238,0.36); transform: translateY(-1px);
        }
        .trip-edit-btn.cancel {
          border: 1px solid var(--border-soft); 
          background: var(--surface-panel); 
          color: var(--text-strong); /* Dùng text-strong để chữ trắng sáng ở Dark Mode */
          box-shadow: none; 
          transform: translateY(0);
        }
        .trip-edit-btn.cancel:hover {
          background: var(--surface-muted);
          border-color: var(--border-strong);
        }
        .trip-ghost-btn {
          display:flex; align-items:center; gap:6px; border:1px solid var(--border-soft); background:var(--surface-panel); color:var(--brand-primary);
          padding:10px 14px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
        }
        .trip-edit-wrap { max-width: 1280px; margin: 0 auto 32px; animation: fadeIn 0.3s both; }
        .trip-shell {
          background: var(--surface-panel); border-radius: 20px; border: 1px solid var(--border-soft);
          overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          max-width: 1280px; margin: 0 auto; /* Đổi thành 1280px */
        }
        .trip-tab-row { display: flex; border-bottom: 1px solid var(--border-soft); padding: 0 8px; }
        .trip-day-row {
          display: flex; overflow-x: auto; border-bottom: 1px solid var(--border-soft);
          padding: 4px 8px 0; background: var(--surface-panel-alt); scrollbar-width: none;
        }
        .trip-content { padding: 20px 16px; }
        @media (max-width: 768px) {
          .trip-detail-wrap { padding: 16px 10px; }
          .trip-detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; position: relative; min-height: 40px; }
        .trip-detail-head-left { display: flex; align-items: center; gap: 10px; z-index: 2; }
        .trip-detail-head-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; z-index: 2; }
        .trip-title { 
          font-size: 22px; /* Tăng kích thước chữ một chút cho đẹp */
          font-weight: 700; 
          color: var(--text-strong); 
          margin: 0; 
          position: absolute; 
          left: 50%; 
          transform: translateX(-50%); /* Căn giữa tuyệt đối */
          white-space: nowrap; 
          z-index: 1; 
          pointer-events: none; 
        }
          .trip-content { padding: 16px 12px; }
        }
        html[data-theme='dark'] .tab-btn { color: #94a3b8 !important; }
        html[data-theme='dark'] .tab-btn.active { color: #f8fafc !important; }
        html[data-theme='dark'] .day-tab { color: #cbd5e1 !important; }
        html[data-theme='dark'] .trip-edit-btn.cancel {
        html[data-theme='dark'] .trip-summary-green,
        html[data-theme='dark'] .overview-price-green {
          color: #34d399 !important;
          background-color: rgba(52,211,153,0.1) !important;
        }
      `}</style>

      <div className='trip-detail-wrap'>
        <div className='trip-detail-header'>
          {/* Cột trái: Nút Quay lại */}
          <div className='trip-detail-head-left'>
            <button
              onClick={() => navigate('/dashboard')}
              className='trip-back-btn'
            >
              ← Quay lại
            </button>
          </div>

          {/* Ở giữa: Tiêu đề chuyến đi */}
          <h1 className='trip-title'>✈️ {trip.destination}</h1>

          {/* Cột phải: Các nút thao tác */}
          <div className='trip-detail-head-right'>
            <button
              onClick={() => setShowEditForm(prev => !prev)}
              className={`trip-edit-btn ${showEditForm ? 'cancel' : ''}`}
            >
              {showEditForm ? '✕ Hủy' : '🔄 Sửa'}
            </button>
          </div>
        </div>

        {showEditForm && (
          <div className='trip-edit-wrap'>
            <TripForm editTrip={trip} onTripCreated={handleRegenerated} />
          </div>
        )}

        <div className='trip-shell'>
          <div className='trip-tab-row'>
            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Tổng quan lịch trình</button>
            <button className={`tab-btn ${activeTab === 'itinerary' ? 'active' : ''}`} onClick={() => { setActiveTab('itinerary'); setActiveDay(0) }}>Lịch trình chi tiết</button>
          </div>

          {activeTab === 'itinerary' && days.length > 0 && (
            <div className='day-tabs-scroll trip-day-row'>
              {days.map((day, i) => (
                <button key={i} className={`day-tab ${safeActiveDay === i ? 'active' : ''}`} onClick={() => setActiveDay(i)}>
                  Ngày {day.day}
                </button>
              ))}
            </div>
          )}

          <div className='trip-content'>
            {activeTab === 'overview' ? (
              <OverviewTab itinerary={trip.itinerary} onSwitchToDay={handleSwitchToDay} />
            ) : (
              <ItineraryView itinerary={trip.itinerary} tripId={trip.id} focusDay={safeActiveDay} totalBudget={trip.budget} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}