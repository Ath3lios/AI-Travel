import { useState, useEffect, useRef, useMemo } from 'react'

const GOONG_MAP_KEY = import.meta.env.VITE_GOONG_MAP_KEY || ''

const BUDGET_KEYS = {
  luu_tru: '🏠 Lưu trú', an_uong: '🍜 Ăn uống',
  di_chuyen: '🚗 Di chuyển', hoat_dong: '🎯 Hoạt động',
  mua_sam_phat_sinh: '🛍️ Mua sắm & phát sinh',
  accommodation: '🏨 Lưu trú', food: '🍜 Ăn uống',
  transport: '🚗 Di chuyển', activities: '🎯 Hoạt động',
  shopping: '🛍️ Mua sắm', miscellaneous: '📦 Phát sinh',
  transportation: '🚗 Di chuyển', meals: '🍜 Ăn uống',
  dining: '🍜 Ăn uống', lodging: '🏠 Lưu trú',
  sightseeing: '🎯 Tham quan', tours: '🎯 Tour',
  entrance_fees: '🎫 Vé vào cửa', other: '📦 Khác',
}

const DAY_COLORS = [
  '#22d3ee', '#818cf8', '#10b981', '#38bdf8',
  '#34d399', '#a5b4fc', '#2dd4bf', '#67e8f9',
]

const PLACE_ICON_RULES = [
  { icon: '✈️', strong: ['san bay', 'airport'], weak: ['chuyen bay', 'may bay', 'terminal'] },
  { icon: '🚆', strong: ['ga', 'tau hoa', 'duong sat'], weak: ['station', 'railway'] },
  { icon: '🚌', strong: ['ben xe', 'xe khach', 'xe buyt'], weak: ['bus', 'coach'] },
  { icon: '🚗', strong: ['taxi', 'grab'], weak: ['o to', 'di chuyen', 'car'] },
  { icon: '🏨', strong: ['khach san', 'hotel'], weak: ['resort', 'homestay', 'hostel'] },
  {
    icon: '🍽️',
    strong: ['nha hang', 'quan an', 'am thuc', 'an sang', 'an trua', 'an toi'],
    weak: ['quan pho', 'pho bo', 'pho ga', 'bun', 'com tam', 'com ga', 'com nieu'],
    negative: ['pho di bo', 'pho co', 'khu pho', 'duong pho'],
  },
  { icon: '☕', strong: ['ca phe', 'cafe'], weak: ['tra sữa', 'coffee'] },
  {
    icon: '🛍️',
    strong: ['cho dem', 'mua sam', 'trung tam thuong mai'],
    weak: ['cho', 'mall', 'shopping', 'plaza'],
    negative: ['cho o', 'nha cho'],
  },
  { icon: '🏛️', strong: ['bao tang', 'di tich', 'thanh co', 'co do'], weak: ['van mieu', 'museum', 'heritage'] },
  { icon: '🛕', strong: ['chua', 'den', 'dinh', 'mieu'], weak: ['nha tho', 'thanh duong', 'pagoda', 'temple', 'church'] },
  {
    icon: '🏖️',
    strong: ['bai bien', 'bien', 'beach', 'bai sao', 'bai khem', 'bai truong'],
    weak: ['dao', 'vinh', 'bai'],
    negative: ['bai do xe', 'bai giu xe', 'san bai'],
  },
  { icon: '⛰️', strong: ['nui', 'doi', 'hang dong'], weak: ['mountain', 'peak'] },
  { icon: '🌊', strong: ['ho', 'song', 'suoi', 'thac'], weak: ['lake', 'river', 'waterfall'] },
  { icon: '🌳', strong: ['cong vien', 'vuon'], weak: ['tham quan', 'check in', 'park', 'garden'] },
  { icon: '🚶', strong: ['pho di bo', 'pho co'], weak: ['di bo', 'walking street', 'old quarter'] },
  { icon: '🍻', strong: ['quan nhau', 'bar', 'pub'], weak: ['club', 'beer', 'lounge'] },
]

function normalizeForIcon(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasValidCoords(item) {
  return Boolean(item?.lat && item?.lng && item.lat !== 0 && item.lng !== 0)
}

function parseStartTime(timeStr) {
  if (!timeStr) return 9999;
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
  }
  return 9999;
}

const phraseRegexCache = new Map()

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countPhraseHits(text, phrase) {
  if (!text || !phrase) return 0
  const cacheKey = `(^|\\s)${phrase}(?=\\s|$)`
  let re = phraseRegexCache.get(cacheKey)
  if (!re) {
    re = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, 'g')
    phraseRegexCache.set(cacheKey, re)
  }
  const matches = text.match(re)
  return matches ? matches.length : 0
}

function getPlaceIcon(item) {
  const placeText = normalizeForIcon(item?.place || '')
  const addressText = normalizeForIcon(item?.address || '')
  const descText = normalizeForIcon(item?.description || '')
  const transportText = normalizeForIcon(item?.transport_to_next || '')
  const detailText = `${descText} ${transportText}`.trim()
  const allText = `${placeText} ${addressText} ${descText} ${transportText}`.trim()

  const scoreRule = (rule) => {
    const negativeHits = (rule.negative || []).reduce((sum, phrase) => sum + countPhraseHits(allText, phrase), 0)
    if (negativeHits > 0) return -1000

    let score = 0
    for (const phrase of rule.strong || []) {
      score += countPhraseHits(placeText, phrase) * 10
      score += countPhraseHits(addressText, phrase) * 4
      score += countPhraseHits(detailText, phrase) * 2
    }
    for (const phrase of rule.weak || []) {
      score += countPhraseHits(placeText, phrase) * 4
      score += countPhraseHits(addressText, phrase) * 2
      score += countPhraseHits(detailText, phrase) * 1
    }

    return score
  }

  let bestIcon = '🧭'
  let bestScore = 0
  for (const rule of PLACE_ICON_RULES) {
    const score = scoreRule(rule)
    if (score > bestScore) {
      bestScore = score
      bestIcon = rule.icon
    }
  }
  return bestIcon
}

function formatBudgetValue(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.filter(Boolean).join('\n')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`)
      .join('\n')
  }
  return String(value)
}

function parseBudgetNumber(value) {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value)
  const normalized = text.replace(/\./g, '').replace(/,/g, '')
  const matches = normalized.match(/\d+/g)
  if (!matches?.length) return 0
  const number = Number(matches[matches.length - 1])
  return Number.isFinite(number) ? number : 0
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0)
  if (!amount) return '0 đ'
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1).replace(/\.0$/, '')} triệu`
  return `${Math.round(amount / 1000)}k`
}

let _goongLoadPromise = null

function loadGoongSDK() {
  if (_goongLoadPromise) return _goongLoadPromise
  _goongLoadPromise = new Promise((resolve) => {
    if (window.goongjs) { resolve(); return }
    if (!document.getElementById('goong-css')) {
      const link = document.createElement('link')
      link.id = 'goong-css'; link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css'
      document.head.appendChild(link)
    }
    if (!document.getElementById('goong-js')) {
      const script = document.createElement('script')
      script.id = 'goong-js'
      script.src = 'https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js'
      script.onload = () => resolve()
      script.onerror = () => { _goongLoadPromise = null; resolve() }
      document.head.appendChild(script)
    } else {
      const t = setInterval(() => { if (window.goongjs) { clearInterval(t); resolve() } }, 100)
    }
  })
  return _goongLoadPromise
}

// ── Goong Map ────────────────────────────────────────────────────────────────
function GoongMap({ places, activePlace, dayIndex = 0, onMarkerClick }) {
  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef     = useRef([])
  const [sdkReady, setSdkReady] = useState(false)
  const activeColor = DAY_COLORS[dayIndex % DAY_COLORS.length]

  useEffect(() => {
    loadGoongSDK().then(() => { if (window.goongjs) setSdkReady(true) })
  }, [])

  useEffect(() => {
    if (!sdkReady || !mapRef.current) return
    const valid = (places || []).filter(hasValidCoords)
    if (!valid.length) return

    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    markersRef.current = []

    window.goongjs.accessToken = GOONG_MAP_KEY
    const lats = valid.map(p => p.lat), lngs = valid.map(p => p.lng)
    const pad = 0.008
    const bounds = [[Math.min(...lngs)-pad, Math.min(...lats)-pad], [Math.max(...lngs)+pad, Math.max(...lats)+pad]]

    const map = new window.goongjs.Map({
      container: mapRef.current,
      style: 'https://tiles.goong.io/assets/goong_map_web.json',
      center: [(Math.min(...lngs)+Math.max(...lngs))/2, (Math.min(...lats)+Math.max(...lats))/2],
      zoom: 13, attributionControl: false,
    })
    mapInstanceRef.current = map

    map.on('load', () => {
      if (valid.length > 1) {
        map.fitBounds(bounds, { padding: 55, maxZoom: 15, duration: 800 })
        const coords = valid.map(p => [p.lng, p.lat])
        map.addSource('route-bg', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates:coords }}})
        map.addLayer({ id:'route-bg', type:'line', source:'route-bg', layout:{'line-join':'round','line-cap':'round'}, paint:{'line-color':'#000','line-width':8,'line-opacity':0.05}})
        map.addSource('route-main', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates:coords }}})
        map.addLayer({ id:'route-main', type:'line', source:'route-main', layout:{'line-join':'round','line-cap':'round'}, paint:{'line-color':activeColor,'line-width':4,'line-opacity':0.9,'line-dasharray':[1.5, 1.5]}})
      }

      valid.forEach((place, idx) => {
        const isFirst = idx === 0, isLast = idx === valid.length - 1
        const outer = document.createElement('div')
        outer.style.cssText = `width:40px;height:40px;border-radius:50%;background:#fff;border:3px solid ${activeColor};display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px ${activeColor}40, 0 1px 3px rgba(0,0,0,0.1);transition:all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);font-family:'DM Sans',sans-serif;`
        const inner = document.createElement('div')
        inner.style.cssText = `width:26px;height:26px;border-radius:50%;background:${isFirst?activeColor:isLast?'#ef4444':'#f8fafc'};display:flex;align-items:center;justify-content:center;font-size:${isFirst||isLast?'13':'12'}px;font-weight:800;color:${isFirst||isLast?'#fff':activeColor};transition:background 0.2s;`
        inner.textContent = isFirst ? '▶' : isLast ? '⚑' : String(idx+1)
        outer.appendChild(inner)

        const popup = new window.goongjs.Popup({ offset:28, closeButton:false, maxWidth:'240px', className: 'premium-popup' })
          .setHTML(`<div style="font-family:'DM Sans',sans-serif;padding:6px 4px"><div style="display:flex;align-items:flex-start;gap:8px"><span style="min-width:24px;height:24px;border-radius:50%;background:${activeColor};color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:2px;flex-shrink:0;box-shadow:0 2px 6px ${activeColor}66">${idx+1}</span><div><div style="font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;letter-spacing:-0.2px">${place.place}</div>${place.address?`<div style="font-size:12px;color:#64748b;margin-top:4px">📍 ${place.address}</div>`:''}${place.time?`<div style="font-size:12px;color:${activeColor};margin-top:4px;font-weight:700">🕐 ${place.time}</div>`:''}${idx<valid.length-1?`<div style="font-size:11px;color:#94a3b8;margin-top:6px;border-top:1px dashed #e2e8f0;padding-top:6px">➜ ${valid[idx+1].place}</div>`:''}</div></div></div>`)

        outer.addEventListener('mouseenter', () => popup.addTo(map))
        outer.addEventListener('mouseleave', () => popup.remove())
        outer.addEventListener('click', (e) => {
          e.stopPropagation()
          if (onMarkerClick) onMarkerClick(prev => prev === idx ? null : idx)
        })
        new window.goongjs.Marker({ element:outer, anchor:'center' }).setLngLat([place.lng, place.lat]).addTo(map)
        markersRef.current.push({ outer, inner })
      })
    })

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [sdkReady, places, dayIndex, activeColor])

  useEffect(() => {
    if (!mapInstanceRef.current) return
    const valid = (places || []).filter(hasValidCoords)
    
    // Nếu không có điểm nào được chọn (activePlace = null), reset lại style của các marker
    if (activePlace == null) {
      markersRef.current.forEach(({ outer, inner }, i) => {
        outer.style.transform  = 'scale(1)'
        outer.style.boxShadow  = `0 4px 14px ${activeColor}40, 0 1px 3px rgba(0,0,0,0.1)`
        outer.style.borderColor = activeColor
        outer.style.background = '#fff'
        inner.style.background = i === 0 ? activeColor : i === valid.length-1 ? '#ef4444' : '#f8fafc'
        inner.style.color      = i === 0 || i === valid.length-1 ? '#fff' : activeColor
      })
      return
    }

    const place = valid[activePlace]
    if (!place) return
    
    // Bay mượt mà đến điểm được chọn
    mapInstanceRef.current.flyTo({ center:[place.lng, place.lat], zoom:15.5, speed:1.4, curve:1.2 })
    
    // Hiệu ứng phóng to & sáng màu cho marker đang chọn
    markersRef.current.forEach(({ outer, inner }, i) => {
      const isActive = i === activePlace
      outer.style.transform  = isActive ? 'scale(1.2) translateY(-4px)' : 'scale(1)'
      outer.style.boxShadow  = isActive ? `0 12px 24px ${activeColor}66, 0 4px 8px rgba(0,0,0,0.1)` : `0 4px 14px ${activeColor}40, 0 1px 3px rgba(0,0,0,0.1)`
      outer.style.borderColor = isActive ? '#fff' : activeColor
      outer.style.background = isActive ? activeColor : '#fff'
      inner.style.background = isActive ? '#fff' : (i === 0 ? activeColor : i === valid.length-1 ? '#ef4444' : '#f8fafc')
      inner.style.color      = isActive ? activeColor : (i === 0 || i === valid.length-1 ? '#fff' : activeColor)
    })
  }, [activePlace, activeColor, places])

  const valid = (places || []).filter(hasValidCoords)
  if (!valid.length) return null

  return (
    <div className="goong-map-shell" style={{ borderRadius:24, overflow:'hidden', background:'var(--surface-panel)', boxShadow:'0 8px 30px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column', height:'100%', width:'100%', maxWidth:'100%', boxSizing:'border-box', border:'1px solid var(--border-soft)' }}>
      <div style={{ padding:'14px 20px', background:'var(--surface-panel)', borderBottom:'1px solid var(--border-soft)', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex: 10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:12, height:12, borderRadius:'50%', background:activeColor, display:'inline-block', boxShadow:`0 0 0 3px ${activeColor}22` }} />
          <span style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)', letterSpacing:'-0.3px' }}>Bản đồ lộ trình</span>
        </div>
        <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500, background:'var(--surface-muted)', padding:'4px 10px', borderRadius:20 }}>{valid.length} điểm</span>
      </div>
      <div style={{ position:'relative', minHeight:420, flex:1, width:'100%', background:'var(--surface-muted)' }}>
        {!sdkReady && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, color:'var(--text-muted)', fontSize:14, fontWeight:500 }}>
            <span style={{ display:'inline-block', width:24, height:24, border:'3px solid var(--border-soft)', borderTopColor:activeColor, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            Đang tải bản đồ khu vực...
          </div>
        )}
        <div ref={mapRef} style={{ height:'100%', width:'100%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} .goongjs-popup-content { border-radius: 16px !important; box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important; border: none !important; padding: 12px !important; }`}</style>
      </div>
    </div>
  )
}

function PlaceModal({ item, onClose, activeColor, modalRect }) {
  if (!item) return null

  const tipsArray = typeof item.tips === 'string'
    ? item.tips.split(/[.;]\s+/).filter(t => t.trim().length > 5)
    : (Array.isArray(item.tips) ? item.tips : [])

  return (
    <>
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.4)',
        zIndex:1000, backdropFilter:'blur(4px)', animation:'fadeIn 0.25s ease',
      }} />

      <div className="place-modal-sheet" style={{
          position:'fixed', bottom:0, left:0, right:0,
          background:'var(--surface-panel)',
          zIndex:1001, maxHeight:'88vh', overflowY:'auto',
          animation:'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
          boxShadow:'0 -20px 40px rgba(0,0,0,0.1)',
          fontFamily:"'DM Sans', sans-serif",
          '--sheet-width': `${Math.round(modalRect?.width || 700)}px`,
          '--sheet-left': `${Math.round(modalRect?.left || 16)}px`,
        }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'16px 0 0' }}>
          <div style={{ width:48, height:5, borderRadius:999, background:'var(--border-soft)' }} />
        </div>
        
        <button onClick={onClose} style={{
          position:'absolute', top:20, right:20,
          width:36, height:36, borderRadius:'50%',
          background:'var(--surface-muted)', border:'1px solid var(--border-soft)', cursor:'pointer',
          fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)',
          transition:'all 0.2s', boxShadow:'0 2px 4px rgba(0,0,0,0.02)'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-panel-alt)'; e.currentTarget.style.color = 'var(--text-strong)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >×</button>

        <div style={{ padding:'32px 40px 48px', maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:6, paddingRight:48 }}>
            <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:32, fontWeight:600, color:'var(--text-strong)', margin:0, lineHeight:1.15, letterSpacing:'-0.5px' }}>
              {item.place}
            </h2>
            {item.estimated_cost && (
              <span style={{ fontSize:13, padding:'6px 12px', borderRadius:10, background:'rgba(16,185,129,0.14)', color:'var(--brand-accent)', fontWeight:700, whiteSpace:'nowrap', flexShrink:0, border:'1px solid rgba(16,185,129,0.24)' }}>
                {item.estimated_cost}
              </span>
            )}
          </div>

          {item.address && (
            <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize: 16 }}>📍</span> {item.address}
            </div>
          )}

          {item.description && (
            <div style={{ marginBottom:28, background:'var(--surface-muted)', padding:'20px', borderRadius:20 }}>
              <p style={{ fontSize:15, color:'var(--text-soft)', lineHeight:1.8, margin:0 }}>{item.description}</p>
            </div>
          )}

          {item.highlights?.length > 0 && (
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text-strong)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize: 20 }}>✨</span> Điểm nổi bật
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {item.highlights.map((h, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', background:'var(--surface-panel)', border:'1px solid var(--border-soft)', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:activeColor, color:'white', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2, boxShadow:`0 2px 6px ${activeColor}40` }}>
                      {i+1}
                    </div>
                    <span style={{ fontSize:15, color:'var(--text-soft)', lineHeight:1.6 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tipsArray.length > 0 && (
            <div style={{ background:'rgba(16,185,129,0.10)', borderRadius:20, padding:'20px', marginBottom:28, border:'1px solid rgba(16,185,129,0.20)' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--brand-accent)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize: 20 }}>💡</span> Mẹo du lịch
              </div>
              <ul style={{ margin:0, padding:'0 0 0 20px', display:'flex', flexDirection:'column', gap:10 }}>
                {tipsArray.map((tip, i) => (
                  <li key={i} style={{ fontSize:14, color:'var(--text-soft)', lineHeight:1.6, paddingLeft:4 }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {(item.best_for || item.nearby) && (
            <div style={{ display:'grid', gridTemplateColumns: item.best_for && item.nearby ? '1fr 1fr' : '1fr', gap:16, marginBottom:28 }}>
              {item.best_for && (
                <div style={{ background:'rgba(34,211,238,0.10)', border:'1px solid rgba(34,211,238,0.22)', borderRadius:20, padding:'16px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--brand-primary)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>👥 Phù hợp cho</div>
                  <div style={{ fontSize:14, color:'var(--text-strong)', lineHeight:1.6 }}>{item.best_for}</div>
                </div>
              )}
              {item.nearby && (
                <div style={{ background:'rgba(129,140,248,0.10)', border:'1px solid rgba(129,140,248,0.22)', borderRadius:20, padding:'16px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--accent-indigo)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>🗺 Lân cận</div>
                  <div style={{ fontSize:14, color:'var(--text-strong)', lineHeight:1.6 }}>{item.nearby}</div>
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop:'1px solid var(--border-soft)', paddingTop:12 }}>
            {[
              item.opening_hours     && { icon:'🕐', label:'Giờ mở cửa',        value:item.opening_hours,     color:'var(--text-strong)' },
              item.entrance_fee      && { icon:'🎫', label:'Vé vào cửa',         value:item.entrance_fee,      color:'var(--accent-indigo)' },
              item.duration          && { icon:'⏱', label:'Thời gian dự kiến',value:item.duration,          color:'var(--text-strong)' },
              item.transport_to_next && { icon:'🚗', label:'Di chuyển tiếp theo',value:item.transport_to_next, color:'var(--brand-primary)' },
            ].filter(Boolean).map((row, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 0', borderBottom:'1px solid var(--border-soft)' }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'var(--surface-muted)', border:'1px solid var(--border-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  {row.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>{row.label}</div>
                  <div style={{ fontSize:14, color:row.color, fontWeight:600, marginTop:2 }}>{row.value}</div>
                </div>
              </div>
            ))}

            {item.address && (
              <div className="copy-address-row" style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 0', borderBottom:'1px solid var(--border-soft)', cursor:'pointer', transition:'opacity 0.2s' }}
                onClick={() => navigator.clipboard?.writeText(item.address)}>
                <div style={{ width:40, height:40, borderRadius:12, background:'var(--surface-muted)', border:'1px solid var(--border-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  📋
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#64748b', fontWeight:500 }}>Sao chép địa chỉ</div>
                  <div style={{ fontSize:14, color:'var(--brand-primary)', fontWeight:600, marginTop:2 }}>{item.address}</div>
                </div>
                <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--surface-muted)', padding:'4px 10px', borderRadius:8, flexShrink:0, fontWeight:600 }}>COPY</span>
              </div>
            )}
          </div>

          {item.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(item.address)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                background:activeColor, color:'white',
                padding:'16px', borderRadius:16, marginTop:28,
                textDecoration:'none', fontSize:16, fontWeight:700,
                boxShadow:`0 8px 20px ${activeColor}40`, transition:'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 24px ${activeColor}60` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 8px 20px ${activeColor}40` }}
            >
              📍 Mở trên Google Maps
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 }            to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        .copy-address-row:hover { opacity: 0.7; }
        @media(max-width:1023px){
          .place-modal-sheet{
            left: 0 !important;
            right: 0 !important;
            width: auto !important;
            transform: none !important;
            bottom: 0 !important;
            border-radius: 32px 32px 0 0 !important;
          }
        }
        @media(min-width:1024px){
          .place-modal-sheet{
            width: var(--sheet-width);
            left: var(--sheet-left) !important;
            right: auto !important;
            transform: none;
            border-radius: 32px;
            bottom: 24px;
          }
        }
      `}</style>
    </>
  )
}

function DayView({ day, dayIndex, accommodation, totalBudget = 0 }) {
  const [activePlace, setActivePlace] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const [modalRect, setModalRect] = useState(null)
  const dayDetailRef = useRef(null)
  const activeColor = DAY_COLORS[dayIndex % DAY_COLORS.length]

  const sortedSchedule = useMemo(() => {
    if (!day.schedule) return [];
    return [...day.schedule].sort((a, b) => parseStartTime(a.time) - parseStartTime(b.time));
  }, [day.schedule]);

  const mapPlaces = useMemo(
    () => sortedSchedule
      .filter(hasValidCoords)
      .map(item => ({ place:item.place, address:item.address, lat:item.lat, lng:item.lng, time:item.time })),
    [sortedSchedule]
  )
  
  const fallbackAccommodationPlaces = useMemo(
    () => (accommodation || [])
      .filter(hasValidCoords)
      .map(h => ({ place:h.name, address:h.area, lat:h.lat, lng:h.lng })),
    [accommodation]
  )
  const finalMapPlaces = mapPlaces.length > 0 ? mapPlaces : fallbackAccommodationPlaces

  return (
    <div style={{ marginBottom: 0 }}>
      {modalItem && (
        <PlaceModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          activeColor={activeColor}
          modalRect={modalRect}
        />
      )}

      <div ref={dayDetailRef} className="day-detail-grid">
        <div className="day-map-col">
          <GoongMap key={dayIndex} places={finalMapPlaces} activePlace={activePlace} dayIndex={dayIndex} onMarkerClick={setActivePlace} />
        </div>

        <div className="day-schedule-col">
          {/* Day header */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14, flexWrap:'wrap', paddingLeft: 8 }}>
            <div style={{ width:36, height:36, background:`linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'white', flexShrink:0, boxShadow:`0 6px 16px ${activeColor}40` }}>
              {String(day.day || '').replace(/[^\d]/g, '') || dayIndex + 1}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:activeColor, textTransform:'uppercase', letterSpacing:'1px', marginBottom:2 }}>NGÀY {String(day.day || '').replace(/[^\d]/g, '') || dayIndex + 1}</div>
              <div style={{ fontSize:18, fontWeight:600, color:'var(--text-strong)', fontFamily:"'Fraunces', serif", lineHeight:1.2, letterSpacing:'-0.3px' }}>{day.title}</div>
              {day.weather && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4, fontWeight: 500 }}>🌤️ {day.weather}</div>}
            </div>
          </div>

          {sortedSchedule?.map((item, idx) => {
            const placeIcon = getPlaceIcon(item)
            const hasCoords = hasValidCoords(item)
            const placeIdx = hasCoords ? finalMapPlaces.findIndex(p => p.place === item.place) : -1
            const isActive = placeIdx !== -1 && activePlace === placeIdx

            const openModal = () => {
              const rect = dayDetailRef.current?.getBoundingClientRect?.()
              if (rect) setModalRect({ left: rect.left, width: rect.width })
              setModalItem({ ...item })
            }
            const handleMapClick = (e) => {
              e.stopPropagation()
              if (placeIdx !== -1) setActivePlace(isActive ? null : placeIdx)
            }

            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 156px', gap: 12, alignItems: 'center' }}>
                {/* Card chính */}
                <div
                  className={`schedule-item-row ${isActive ? 'active' : ''}`}
                  onClick={openModal}
                  style={{ '--active-color': activeColor, '--active-bg': `${activeColor}11` }}
                >
                  <div className="schedule-item-icon-wrapper">
                    {idx < sortedSchedule.length - 1 && <div className="schedule-connector" />}
                    <div className={`schedule-item-icon ${isActive ? 'active-icon' : ''}`}>
                      {placeIcon}
                    </div>
                  </div>

                  <div className="schedule-item-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize:12, color:activeColor, fontWeight:700, flexShrink: 0 }}>{item.time}</span>
                      {item.duration && <span style={{ fontSize:11, color: '#94a3b8', fontWeight: 500 }}>• {item.duration}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text-strong)', lineHeight:1.3, letterSpacing:'-0.1px' }}>{item.place}</span>
                      {placeIdx !== -1 && (
                        <span onClick={handleMapClick} className="map-badge">
                          #{placeIdx+1} Bản đồ
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight: 1.5 }}>{item.address}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize:18, color:'#cbd5e1' }}>›</div>
                  </div>
                </div>

                {/* Cost badge cột giữa */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.estimated_cost
                    ? <div className="cost-badge" style={{ textAlign: 'center', whiteSpace: 'normal', lineHeight: 1.4 }}>{item.estimated_cost}</div>
                    : <div style={{ height: 28 }} />
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function ItineraryView({ itinerary, focusDay = null, totalBudget = 0 }) {
  if (!itinerary) return null
  const { days, accommodation, packing_list, budget_breakdown } = itinerary

  const visibleDays = focusDay !== null ? [(days || [])[focusDay]].filter(Boolean) : (days || [])
  const focusDayIndex = focusDay !== null ? focusDay : null

  const totalDays = (days || []).length
  const totalPlaces = (days || []).reduce((sum, day) => sum + (day.schedule?.length || 0), 0)

  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif", width: '100%', margin: '0 auto', padding: '0 8px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');
        
        .premium-card {
          background: white;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.03);
          border: 1px solid #f8fafc;
        }

        .hotel-card {
          border: 1px solid #f1f5f9;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #fdfdfd;
        }
        .hotel-card:hover {
          transform: translateY(-4px);
          border-color: #e0e7ff;
          box-shadow: 0 12px 24px rgba(99,102,241,0.08);
          background: white;
        }

        .pack-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 8px 14px; font-size: 13px; color: #334155; font-weight: 500;
        }

        .budget-list { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .budget-item {
          display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 14px;
          align-items: center; padding: 14px 16px;
          background: #f8fafc; border-radius: 16px; border: 1px solid transparent; transition: all 0.2s;
        }
        .budget-item:hover { background: white; border-color: #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .budget-icon {
          width: 44px; height: 44px; border-radius: 14px; background: white;
          display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .budget-content { min-width: 0; max-width: 100%; text-align: right; }
        .budget-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .budget-value { font-size: 15px; font-weight: 700; color: #0f172a; }

        .day-detail-grid { display: grid; grid-template-columns: 1fr; gap: 24px; width: 100%; }
        .day-map-col { order: 2; }
        .day-schedule-col { order: 1; display: flex; flex-direction: column; gap: 12px; }
        
        .schedule-item-row {
          display: grid; grid-template-columns: 44px minmax(0,1fr) 16px; gap: 12px; align-items: center;
          padding: 12px 16px; background: white; border-radius: 16px; cursor: pointer; border: 1px solid transparent;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
        }
        .schedule-item-row:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.05); border-color: #e2e8f0; }
        .schedule-item-row.active { background: var(--active-bg); border-color: var(--active-color); box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
        
        .schedule-item-icon-wrapper { position: relative; display: flex; justify-content: center; height: 100%; align-items: center; }
        .schedule-connector { position: absolute; width: 2px; background: #e2e8f0; top: 32px; bottom: -22px; left: 50%; transform: translateX(-50%); z-index: 0; }
        .schedule-item-icon {
          width: 36px; height: 36px; border-radius: 50%; background: #f8fafc; border: 2px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center; font-size: 16px; position: relative; z-index: 1; transition: all 0.3s;
        }
        .schedule-item-icon.active-icon { background: white; border-color: var(--active-color); box-shadow: 0 0 0 3px var(--active-bg); }

        .map-badge { font-size: 11px; padding: 4px 10px; border-radius: 8px; background: #f1f5f9; color: #475569; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .map-badge:hover { background: var(--active-color); color: white; }
        
        .cost-badge { font-size: 12px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 6px 12px; border-radius: 10px; border: 1px solid #d1fae5; }
        .schedule-item-meta { text-align: right; display: flex; flex-direction: column; alignItems: flex-end; justify-content: center; min-width: 0; }

        @media(min-width:1024px){
          .day-detail-grid { grid-template-columns: minmax(0,1.4fr) minmax(0,1fr); gap: 32px; align-items: stretch; }
          .day-map-col { order: 2;}
          .day-schedule-col { order: 1; padding-bottom: 0; }
        }
        @media(max-width:900px){
          .schedule-item-row { grid-template-columns: 48px minmax(0,1fr) auto; gap: 12px; padding: 16px; }
          .schedule-item-icon { width: 38px; height: 38px; font-size: 18px; }
          .schedule-connector { top: 38px; bottom: -28px; }
          .bottom-grid { grid-template-columns: 1fr !important; }
        }

        html[data-theme='dark'] .premium-card,
        html[data-theme='dark'] .hotel-card,
        html[data-theme='dark'] .schedule-item-row,
        html[data-theme='dark'] .goong-map-shell {
          background: var(--surface-panel) !important;
          border-color: var(--border-soft) !important;
        }

        html[data-theme='dark'] .pack-chip,
        html[data-theme='dark'] .budget-item,
        html[data-theme='dark'] .budget-icon,
        html[data-theme='dark'] .schedule-item-icon,
        html[data-theme='dark'] .map-badge {
          background: var(--surface-muted) !important;
          border-color: var(--border-soft) !important;
          color: var(--text-soft) !important;
        }

        html[data-theme='dark'] .budget-value,
        html[data-theme='dark'] .budget-label,
        html[data-theme='dark'] .schedule-item-row span,
        html[data-theme='dark'] .premium-card h3,
        html[data-theme='dark'] .hotel-card div {
          color: inherit;
        }
        html[data-theme='dark'] .cost-badge {
        background: rgba(16, 185, 129, 0.1) !important;
        border-color: rgba(16, 185, 129, 0.25) !important;
        color: #34d399 !important;
        }
      `}</style>

      {/* TỔNG QUAN CHUYẾN ĐI - PREMIUM BENTO STYLE */}
      {focusDay === null && totalDays > 0 && (
        <div className="overview-bento" style={{ marginBottom: 48 }}>
          <style>{`
            .bento-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            
            /* --- HERO CARD TÂN TIẾN --- */
            .bento-hero {
              grid-column: 1 / -1; 
              background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); 
              border-radius: 32px; 
              padding: 48px;
              color: white; 
              position: relative; 
              overflow: hidden; 
              box-shadow: 0 24px 50px rgba(15,23,42,0.15);
              min-height: 220px;
              display: flex;
              align-items: center;
            }
            
            /* Hiệu ứng ánh sáng (Glowing Orbs) */
            .hero-orb-1 { position: absolute; top: -50%; left: -10%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 60%); border-radius: 50%; filter: blur(40px); animation: floatOrb 8s infinite ease-in-out alternate; }
            .hero-orb-2 { position: absolute; bottom: -50%; right: -5%; width: 350px; height: 350px; background: radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 60%); border-radius: 50%; filter: blur(40px); animation: floatOrb 10s infinite ease-in-out alternate-reverse; }
            
            @keyframes floatOrb {
              0% { transform: translate(0, 0) scale(1); }
              100% { transform: translate(30px, 40px) scale(1.1); }
            }

            /* --- STAT CARDS HIỆN ĐẠI --- */
            .bento-stat {
              background: white; 
              border-radius: 28px; 
              padding: 24px; 
              border: 1px solid #f1f5f9;
              box-shadow: 0 4px 20px rgba(0,0,0,0.02); 
              display: flex; 
              align-items: center; 
              gap: 20px;
              transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
              cursor: pointer;
              position: relative;
              overflow: hidden;
              z-index: 1;
            }
            .bento-stat::after {
               content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, transparent, var(--stat-glow)); opacity: 0; transition: opacity 0.4s; z-index: -1;
            }
            .bento-stat:hover { 
              transform: translateY(-8px); 
              box-shadow: 0 20px 40px rgba(0,0,0,0.08); 
              border-color: transparent; 
            }
            .bento-stat:hover::after { opacity: 0.08; }

            .bento-icon-box { 
              width: 64px; height: 64px; border-radius: 20px; 
              display: flex; align-items: center; justify-content: center; 
              font-size: 30px; flex-shrink: 0; 
              background: var(--icon-bg); color: var(--icon-color);
              box-shadow: 0 8px 16px var(--icon-shadow);
              transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .bento-stat:hover .bento-icon-box {
              transform: scale(1.1) rotate(-8deg);
            }

            @media (max-width: 900px) {
              .bento-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
              .bento-stat:last-child { grid-column: 1 / -1; }
            }
            @media (max-width: 600px) {
              .bento-grid { grid-template-columns: 1fr; gap: 16px; }
              .bento-hero { padding: 32px 24px; border-radius: 28px; }
              .bento-hero h2 { font-size: 32px !important; }
              .bento-stat { padding: 20px; border-radius: 24px; gap: 16px; }
              .bento-icon-box { width: 56px; height: 56px; font-size: 26px; }
            }
          `}</style>

          <div className="bento-grid">
            {/* HERO CARD */}
            <div className="bento-hero">
              <div className="hero-orb-1" />
              <div className="hero-orb-2" />
              
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', 
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 999, fontSize: 13, fontWeight: 700, color: '#e0e7ff', width: 'max-content', letterSpacing: '1px' 
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 12px #34d399' }} />
                  TỔNG QUAN HÀNH TRÌNH
                </div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(36px, 4vw, 46px)', fontWeight: 600, margin: 0, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
                  Sẵn sàng cho chuyến đi<br/>
                  <span style={{ background: 'linear-gradient(to right, #a5b4fc, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block', marginTop: 4 }}>
                    tuyệt vời tiếp theo ✨
                  </span>
                </h2>
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="bento-stat" style={{ '--icon-bg': 'rgba(34,211,238,0.12)', '--icon-color': 'var(--brand-primary)', '--icon-shadow': 'rgba(34,211,238,0.2)', '--stat-glow': '#22d3ee' }}>
              <div className="bento-icon-box">⏳</div>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Thời gian</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {totalDays} <span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', letterSpacing: '0' }}>Ngày</span>
                </div>
              </div>
            </div>

            <div className="bento-stat" style={{ '--icon-bg': '#ecfdf5', '--icon-color': '#059669', '--icon-shadow': 'rgba(5,150,105,0.2)', '--stat-glow': '#059669' }}>
              <div className="bento-icon-box">📍</div>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Khám phá</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {totalPlaces} <span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', letterSpacing: '0' }}>Điểm đến</span>
                </div>
              </div>
            </div>

            <div className="bento-stat" style={{ '--icon-bg': '#fffbeb', '--icon-color': '#d97706', '--icon-shadow': 'rgba(217,119,6,0.2)', '--stat-glow': '#d97706' }}>
              <div className="bento-icon-box">🌟</div>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Trải nghiệm</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                  Phong phú
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DANH SÁCH CÁC NGÀY */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {visibleDays.map((day, i) => (
          <DayView
            key={day.day || i}
            day={day}
            dayIndex={focusDayIndex !== null ? focusDayIndex : i}
            accommodation={accommodation}
            totalBudget={parseBudgetNumber(totalBudget)}
          />
        ))}
      </div>

      {/* DỰ TOÁN NGÂN SÁCH & HÀNH TRANG */}
      {focusDay === null && (
        <div className="bottom-grid" style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:24, marginTop:40, alignItems:'start', marginBottom: 60 }}>
          {budget_breakdown && (
            <div className="premium-card">
              <h3 style={{ fontSize:18, fontWeight:700, color:'var(--text-strong)', margin:'0 0 20px 0', fontFamily:"'Fraunces', serif" }}>
                💵 Dự toán ngân sách
              </h3>
              <div className="budget-list">
                {Object.entries(budget_breakdown).map(([key, val]) => {
                  const label = BUDGET_KEYS[key] || '📌 ' + key.replace(/_/g, ' ')
                  const icon  = label.match(/^([\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF])/u)?.[0] || '📌'
                  const text  = label.replace(/^([\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF])\s*/u, '')
                  return (
                    <div key={key} className="budget-item">
                      <span className="budget-icon">{icon}</span>
                      <div className="budget-content">
                        <div className="budget-label">{text}</div>
                        <div className="budget-value">{formatBudgetValue(val)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {packing_list?.length > 0 && (
            <div className="premium-card">
              <h3 style={{ fontSize:18, fontWeight:700, color:'var(--text-strong)', margin:'0 0 20px 0', fontFamily:"'Fraunces', serif" }}>🎒 Hành trang cần thiết</h3>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {packing_list.map((item,i) => (
                  <span key={i} className="pack-chip"><span style={{ color:'var(--brand-accent)', fontWeight:800 }}>✓</span> {item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GỢI Ý LƯU TRÚ */}
      {focusDay === null && accommodation?.length > 0 && (
        <div className="premium-card" style={{ marginBottom: 60 }}>
          <h3 style={{ fontSize:18, fontWeight:700, color:'var(--text-strong)', margin:'0 0 20px 0', fontFamily:"'Fraunces', serif" }}>🏨 Gợi ý lưu trú</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
            {accommodation.map((h,i) => (
              <div key={i} className="hotel-card">
                <div style={{ fontWeight:700, fontSize:16, color:'#0f172a', marginBottom:8, letterSpacing:'-0.2px' }}>{h.name}</div>
                <div style={{ fontSize:13, color:'#64748b', marginBottom:12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{fontSize:16}}>📍</span> {h.area}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#059669', padding:'6px 12px', background:'#ecfdf5', borderRadius:8, display:'inline-block', marginBottom:12, border:'1px solid #d1fae5' }}>{h.price_range}</div>
                <div style={{ fontSize:13, color:'#475569', lineHeight:1.6 }}>{h.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}