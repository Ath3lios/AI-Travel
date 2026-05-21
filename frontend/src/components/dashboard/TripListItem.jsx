import { memo, useMemo } from 'react'
import useDestinationImage from '../../hooks/useDestinationImage'
import { formatRelativeDate } from '../../utils/formatters'

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
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: `fadeUp 0.4s ${index * 0.06}s both`,
        minHeight: 280,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 20px 40px -8px rgba(14, 66, 108, 0.15)'
        e.currentTarget.style.borderColor = 'var(--brand-primary, #0ea5e9)'
        e.currentTarget.style.transform = 'translateY(-6px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'var(--border-soft)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{
        position: 'relative',
        minHeight: 180,
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
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(15,23,42,0.9) 100%)',
        }} />

        <div style={{ position: 'absolute', right: 14, top: 14 }}>
          {/* Nút Thùng Rác */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(trip.id, e) }}
            style={{
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
              fontSize: 14,
              color: 'white',
              padding: '0 10px',
              borderRadius: 12,
              transition: 'all 0.2s',
              flexShrink: 0,
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.45)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)' }}
          >
            🗑
          </button>
        </div>
        
        <div style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 16,
        }}>
          <div style={{
            fontSize: 22,
            lineHeight: 1.3,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 4,
            fontFamily: "'Fraunces', serif",
            textShadow: '0 2px 6px rgba(0,0,0,0.4)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {trip.destination}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
            Tạo {ago}
          </div>
        </div>
      </div>

      <div style={{ 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1, 
        gap: '20px', 
        background: 'var(--surface-panel)' 
      }}>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '12px', 
        }}>
          {/* Số ngày thay thế cho Ngân sách */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 15, fontWeight: 700, color: 'var(--text-strong, #0f172a)' }}>
            <span style={{ fontSize: 18, filter: 'grayscale(0.2)', width: '24px', display: 'flex', justifyContent: 'center' }}>📅</span> 
            {trip.days} ngày
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 15, fontWeight: 700, color: 'var(--text-strong, #0f172a)' }}>
            <span style={{ fontSize: 18, filter: 'grayscale(0.2)', width: '24px', display: 'flex', justifyContent: 'center' }}>📍</span> 
            {totalSpots} địa điểm khám phá
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(TripListItem)