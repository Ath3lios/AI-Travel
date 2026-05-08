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
        <div
          style={{
            background: 'var(--surface-strong)',
            borderRadius: 14,
            padding: '14px 18px',
            border: '1px solid var(--border-soft)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {itinerary.trip_summary.best_time && (
              <span style={{ fontSize: 13, color: 'var(--brand-primary)' }}>🌤️ {itinerary.trip_summary.best_time}</span>
            )}
            {itinerary.trip_summary.estimated_cost && (
              <span style={{ fontSize: 13, color: 'var(--brand-accent)' }}>💰 {itinerary.trip_summary.estimated_cost}</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  Ngày {day.day}
                  {day.title && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{day.title}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {day.weather && (
                    <span
                      style={{
                        fontSize: 11,
                        background: 'rgba(34,211,238,0.12)',
                        color: 'var(--brand-primary)',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontWeight: 500,
                      }}
                    >
                      {day.weather}
                    </span>
                  )}
                  <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>
                </div>
              </div>

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
          {itinerary.accommodation?.length > 0 && (
            <div className='overview-card'>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 10 }}>🏨 Gợi ý lưu trú</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itinerary.accommodation.map((hotel, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{hotel.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hotel.area}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--brand-accent)', fontWeight: 600 }}>{hotel.price_range}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {itinerary.budget_breakdown && (
            <div className='overview-card'>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 10 }}>💵 Phân bổ ngân sách</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(itinerary.budget_breakdown).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{OVERVIEW_BUDGET_LABELS[key] || key}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {itinerary.packing_list?.length > 0 && (
            <div className='overview-card'>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 10 }}>🎒 Đồ cần mang</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {itinerary.packing_list.map((item, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border-soft)',
                      color: 'var(--text-soft)',
                      padding: '4px 12px',
                      borderRadius: 999,
                    }}
                  >
                    {item}
                  </span>
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
        .trip-detail-wrap { max-width: 1520px; margin: 0 auto; padding: 24px 8px; }
        .trip-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
        .trip-detail-head-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .trip-back-btn {
          background: var(--surface-panel); border: 1px solid var(--border-soft); border-radius: 10px;
          padding: 8px 14px; font-size: 13px; color: var(--text-muted); cursor: pointer;
          font-family: inherit; font-weight: 600;
        }
        .trip-title { font-size: 18px; font-weight: 700; color: var(--text-strong); margin: 0; }
        .trip-edit-btn {
          display: flex; align-items: center; gap: 6px;
          border: 1.5px solid rgba(34,211,238,0.28); background: rgba(34,211,238,0.12); color: var(--brand-primary);
          padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; font-family: inherit; white-space: nowrap;
        }
        .trip-edit-btn.cancel {
          border-color: #e2e8f0; background: #f1f5f9; color: #64748b;
        }
        .trip-ghost-btn {
          display:flex; align-items:center; gap:6px; border:1px solid var(--border-soft); background:var(--surface-panel); color:var(--brand-primary);
          padding:10px 14px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
        }
        .trip-edit-wrap { max-width: 960px; margin: 0 auto 24px; }
        .trip-shell {
          background: var(--surface-panel); border-radius: 20px; border: 1px solid var(--border-soft);
          overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          max-width: 1180px; margin: 0 auto;
        }
        .trip-tab-row { display: flex; border-bottom: 1px solid var(--border-soft); padding: 0 8px; }
        .trip-day-row {
          display: flex; overflow-x: auto; border-bottom: 1px solid var(--border-soft);
          padding: 4px 8px 0; background: var(--surface-panel-alt); scrollbar-width: none;
        }
        .trip-content { padding: 20px 16px; }
        @media (max-width: 768px) {
          .trip-detail-wrap { padding: 16px 10px; }
          .trip-detail-header { flex-direction: column; align-items: stretch; gap: 10px; }
          .trip-detail-head-left { flex-wrap: wrap; }
          .trip-title { font-size: 16px !important; }
          .trip-content { padding: 16px 12px; }
        }
          html[data-theme='dark'] .tab-btn.active {
          color: #f8fafc;
        }
      `}</style>

      <div className='trip-detail-wrap'>
        <div className='trip-detail-header'>
          <div className='trip-detail-head-left'>
            <button
              onClick={() => navigate('/dashboard')}
              className='trip-back-btn'
            >
              ← Quay lại
            </button>
            <h1 className='trip-title'>✈️ {trip.destination}</h1>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
