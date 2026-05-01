import { memo, useMemo } from 'react'
import useDestinationImage from '../../hooks/useDestinationImage'
import { formatCurrencyVND, formatRelativeDate } from '../../utils/formatters'

function getAccentGradient(destination) {
  const d = destination || ''
  if (/đà nẵng|nha trang|phú quốc|mũi né|hạ long/i.test(d)) return 'linear-gradient(135deg,#38bdf8,#0ea5e9)'
  if (/sapa|đà lạt|ninh bình|tam cốc|mộc châu/i.test(d)) return 'linear-gradient(135deg,#34d399,#10b981)'
  return 'linear-gradient(135deg,#a5b4fc,#6366f1)'
}

function TripListItem({ trip, onClick, onDelete, index }) {
  const imgUrl = useDestinationImage(trip.destination)
  const totalSpots = useMemo(
    () => (trip.itinerary?.days || []).reduce((sum, day) => sum + (day.schedule?.length || 0), 0),
    [trip.itinerary?.days]
  )
  const ago = formatRelativeDate(trip.created_at)
  const budgetText = formatCurrencyVND(trip.budget)

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'white',
        borderRadius: 16,
        padding: '12px 14px',
        border: '1px solid #eef0f3',
        cursor: 'pointer',
        transition: 'all 0.2s',
        animation: `fadeUp 0.4s ${index * 0.06}s both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.07)'
        e.currentTarget.style.borderColor = '#dde0e8'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = '#eef0f3'
      }}
    >
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        flexShrink: 0,
        overflow: 'hidden',
        background: getAccentGradient(trip.destination),
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        position: 'relative',
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
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 2,
          fontFamily: "'Fraunces', serif",
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {trip.destination}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {trip.days} ngày · {totalSpots} địa điểm · {ago}
        </div>
      </div>

      {budgetText && (
        <span style={{
          fontSize: 11,
          color: '#64748b',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: 999,
          padding: '3px 8px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {budgetText}
        </span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(trip.id, e) }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: 8,
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none' }}
      >
        🗑
      </button>
    </div>
  )
}

export default memo(TripListItem)
