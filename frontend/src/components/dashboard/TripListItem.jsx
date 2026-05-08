import { memo, useMemo } from 'react'
import useDestinationImage from '../../hooks/useDestinationImage'
import { formatCurrencyVND, formatRelativeDate } from '../../utils/formatters'

function getAccentGradient(destination) {
  const d = destination || ''
  if (/đà nẵng|nha trang|phú quốc|mũi né|hạ long/i.test(d)) return 'linear-gradient(135deg,#22d3ee,#818cf8)'
  if (/sapa|đà lạt|ninh bình|tam cốc|mộc châu/i.test(d)) return 'linear-gradient(135deg,#34d399,#10b981)'
  return 'linear-gradient(135deg,#818cf8,#22d3ee)'
}

function TripListItem({ trip, onClick, onDelete, index }) {
  const imgUrl = useDestinationImage(trip.destination)
  const totalSpots = useMemo(
    () => (trip.itinerary?.days || []).reduce((sum, day) => sum + (day.schedule?.length || 0), 0),
    [trip.itinerary?.days]
  )
  const ago = formatRelativeDate(trip.created_at)
  const budgetText = formatCurrencyVND(trip.budget)
  const coverStyle = imgUrl ? `url(${imgUrl}) center/cover` : getAccentGradient(trip.destination)

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-panel)',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid var(--border-soft)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        animation: `fadeUp 0.4s ${index * 0.06}s both`,
        minHeight: 320,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 18px 36px rgba(14,66,108,0.14)'
        e.currentTarget.style.borderColor = '#b7d5e8'
        e.currentTarget.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'rgba(206,225,240,0.9)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{
        position: 'relative',
        minHeight: 160,
        background: coverStyle,
      }}>
        {imgUrl && (
          <img
            key={imgUrl}
            src={imgUrl}
            alt={trip.destination}
            referrerPolicy="no-referrer"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            onLoad={(e) => { e.currentTarget.style.display = 'block' }}
          />
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(8,25,44,0.08) 0%, rgba(6,20,37,0.68) 100%)',
        }} />
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 999,
            padding: '6px 10px',
            backdropFilter: 'blur(8px)',
          }}>
            {trip.days} ngày
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            background: 'rgba(11,132,255,0.24)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 999,
            padding: '6px 10px',
            backdropFilter: 'blur(8px)',
          }}>
            {totalSpots} địa điểm
          </span>
        </div>
        <div style={{ position: 'absolute', right: 14, top: 14 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(trip.id, e) }}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              fontSize: 14,
              color: 'white',
              padding: '8px 9px',
              borderRadius: 12,
              transition: 'all 0.2s',
              flexShrink: 0,
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'white' }}
          >
            🗑
          </button>
        </div>
        <div style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
        }}>
          <div style={{
            fontSize: 21,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 4,
            fontFamily: "'Fraunces', serif",
          }}>
            {trip.destination}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(239,246,255,0.82)' }}>
            Tạo {ago}
          </div>
        </div>
      </div>

      <div style={{ padding: 18, display: 'grid', gap: 14, flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ background: 'var(--surface-panel-alt)', borderRadius: 16, border: '1px solid var(--border-soft)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b97ad', marginBottom: 4 }}>
              Ngân sách
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>
              {budgetText || 'Chưa có'}
            </div>
          </div>
          <div style={{ background: 'var(--surface-panel-alt)', borderRadius: 16, border: '1px solid var(--border-soft)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b97ad', marginBottom: 4 }}>
              Trạng thái
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>
              Sẵn sàng xem
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{
            fontSize: 12,
            color: 'var(--brand-primary)',
            background: 'rgba(34,211,238,0.12)',
            border: '1px solid rgba(34,211,238,0.24)',
            borderRadius: 999,
            padding: '7px 10px',
            whiteSpace: 'nowrap',
          }}>
            Mở chi tiết
          </span>
          <span style={{ fontSize: 12, color: '#6b8194' }}>
            AI itinerary
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(TripListItem)
