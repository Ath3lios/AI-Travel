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
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

// Rule icon theo tu ngu Viet Nam + cham diem theo ngu canh.
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
  { icon: '☕', strong: ['ca phe', 'cafe'], weak: ['tra sua', 'coffee'] },
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
    // Loai tru match nhiem (vi du "bai do xe", "pho di bo"...)
    const negativeHits = (rule.negative || []).reduce((sum, phrase) => sum + countPhraseHits(allText, phrase), 0)
    if (negativeHits > 0) return -1000

    // Uu tien ten dia diem > dia chi > mo ta/transport.
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
function GoongMap({ places, activePlace, dayIndex = 0 }) {
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
        map.fitBounds(bounds, { padding: 55, maxZoom: 15, duration: 600 })
        const coords = valid.map(p => [p.lng, p.lat])
        map.addSource('route-bg', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates:coords }}})
        map.addLayer({ id:'route-bg', type:'line', source:'route-bg', layout:{'line-join':'round','line-cap':'round'}, paint:{'line-color':'#000','line-width':7,'line-opacity':0.07}})
        map.addSource('route-main', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates:coords }}})
        map.addLayer({ id:'route-main', type:'line', source:'route-main', layout:{'line-join':'round','line-cap':'round'}, paint:{'line-color':activeColor,'line-width':3.5,'line-opacity':0.9,'line-dasharray':[2,1.8]}})
      }

      valid.forEach((place, idx) => {
        const isFirst = idx === 0, isLast = idx === valid.length - 1
        const outer = document.createElement('div')
        outer.style.cssText = `width:36px;height:36px;border-radius:50%;background:#fff;border:3px solid ${activeColor};display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 10px ${activeColor}55;transition:transform 0.18s,box-shadow 0.18s;font-family:'DM Sans',sans-serif;`
        const inner = document.createElement('div')
        inner.style.cssText = `width:22px;height:22px;border-radius:50%;background:${isFirst?activeColor:isLast?'#ef4444':'#f1f5f9'};display:flex;align-items:center;justify-content:center;font-size:${isFirst||isLast?'12':'11'}px;font-weight:800;color:${isFirst||isLast?'#fff':activeColor};border:${isFirst||isLast?'none':`1.5px solid ${activeColor}`};transition:background 0.18s;`
        inner.textContent = isFirst ? '▶' : isLast ? '⚑' : String(idx+1)
        outer.appendChild(inner)

        const popup = new window.goongjs.Popup({ offset:24, closeButton:false, maxWidth:'220px' })
          .setHTML(`<div style="font-family:'DM Sans',sans-serif;padding:5px 2px"><div style="display:flex;align-items:flex-start;gap:7px"><span style="min-width:20px;height:20px;border-radius:50%;background:${activeColor};color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px;flex-shrink:0">${idx+1}</span><div><div style="font-size:13px;font-weight:700;color:#0f0f1a;line-height:1.3">${place.place}</div>${place.address?`<div style="font-size:11px;color:#94a3b8;margin-top:2px">📍 ${place.address}</div>`:''}${place.time?`<div style="font-size:11px;color:${activeColor};margin-top:2px;font-weight:600">🕐 ${place.time}</div>`:''}${idx<valid.length-1?`<div style="font-size:10px;color:#94a3b8;margin-top:4px;border-top:1px solid #f1f5f9;padding-top:4px">➜ ${valid[idx+1].place}</div>`:''}</div></div></div>`)

        outer.addEventListener('mouseenter', () => popup.addTo(map))
        outer.addEventListener('mouseleave', () => popup.remove())
        new window.goongjs.Marker({ element:outer, anchor:'center' }).setLngLat([place.lng, place.lat]).addTo(map)
        markersRef.current.push({ outer, inner })
      })
    })

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [sdkReady, places, dayIndex, activeColor])

  useEffect(() => {
    if (!mapInstanceRef.current || activePlace == null) return
    const valid = (places || []).filter(hasValidCoords)
    const place = valid[activePlace]
    if (!place) return
    mapInstanceRef.current.flyTo({ center:[place.lng, place.lat], zoom:16, speed:1.2, curve:1 })
    markersRef.current.forEach(({ outer, inner }, i) => {
      const isActive = i === activePlace
      outer.style.transform  = isActive ? 'scale(1.3)' : 'scale(1)'
      outer.style.boxShadow  = isActive ? `0 6px 22px ${activeColor}77` : `0 2px 10px ${activeColor}55`
      inner.style.background = isActive ? activeColor : (i === 0 ? activeColor : i === valid.length-1 ? '#ef4444' : '#f1f5f9')
      inner.style.color      = isActive ? '#fff' : (i === 0 || i === valid.length-1 ? '#fff' : activeColor)
    })
  }, [activePlace, activeColor, places])

  const valid = (places || []).filter(hasValidCoords)
  if (!valid.length) return null

  return (
    <div className="goong-map-shell" style={{ borderRadius:16, overflow:'hidden', border:'1px solid #e2e8f0', boxShadow:'0 2px 16px rgba(0,0,0,0.07)', display:'flex', flexDirection:'column', height:'100%', width:'100%', maxWidth:'100%', boxSizing:'border-box' }}>
      <div style={{ padding:'10px 16px', background:'#fafafa', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:10, height:10, borderRadius:'50%', background:activeColor, display:'inline-block' }} />
          <span style={{ fontSize:13, fontWeight:600, color:'#475569' }}>🗺️ Lộ trình ngày</span>
        </div>
        <span style={{ fontSize:11, color:'#94a3b8' }}>{valid.length} điểm · Hover xem chi tiết</span>
      </div>
      <div style={{ position:'relative', minHeight:390, flex:1, width:'100%', background:'#e8edf2' }}>
        {!sdkReady && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'#94a3b8', fontSize:13 }}>
            <span style={{ display:'inline-block', width:16, height:16, border:'2px solid #e2e8f0', borderTopColor:activeColor, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            Đang tải bản đồ...
          </div>
        )}
        <div ref={mapRef} style={{ height:'100%', width:'100%' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
      <div style={{ padding:'10px 16px', background:'#fafafa', borderTop:'1px solid #f1f5f9', display:'flex', gap:4, overflowX:'auto', alignItems:'center' }}>
        {valid.map((p, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:i===0?activeColor:'#fff', border:`2px solid ${activeColor}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'800', color:i===0?'#fff':activeColor, flexShrink:0 }}>
              {i===0?'▶':i+1}
            </div>
            <span style={{ fontSize:11, color:'#475569', maxWidth:88, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.place}</span>
            {i < valid.length-1 && <span style={{ color:activeColor, fontSize:12, marginLeft:2, flexShrink:0 }}>→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaceModal({ item, onClose, activeColor, modalRect }) {
  if (!item) return null

  const tipsArray = item.tips
    ? item.tips.split(/[.;]\s+/).filter(t => t.trim().length > 5)
    : []

  return (
    <>
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
        zIndex:1000, backdropFilter:'blur(2px)', animation:'fadeIn 0.2s ease',
      }} />

      <div className="place-modal-sheet" style={{
          position:'fixed', bottom:0, left:0, right:0,
          background:'white', borderRadius:'24px 24px 0 0',
          zIndex:1001, maxHeight:'88vh', overflowY:'auto',
          animation:'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.15)',
          fontFamily:"'DM Sans', sans-serif",
          '--sheet-width': `${Math.round(modalRect?.width || 700)}px`,
          '--sheet-left': `${Math.round(modalRect?.left || 16)}px`,
        }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:40, height:4, borderRadius:999, background:'#e2e8f0' }} />
        </div>
        <button onClick={onClose} style={{
          position:'absolute', top:16, right:16,
          width:32, height:32, borderRadius:'50%',
          background:'#f1f5f9', border:'none', cursor:'pointer',
          fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b',
        }}>×</button>

        <div style={{ padding:'24px 24px 48px' }}>

          {/* Title + cost */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:4, paddingRight:42 }}>
            <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:26, fontWeight:600, color:'#0f172a', margin:0, lineHeight:1.2 }}>
              {item.place}
            </h2>
            {item.estimated_cost && (
              <span style={{ fontSize:12, padding:'2px 8px', borderRadius:6, background:'#f0fdf4', color:'#16a34a', fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>
                {item.estimated_cost}
              </span>
            )}
          </div>

          {/* Address */}
          {item.address && (
            <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16 }}>📍 {item.address}</div>
          )}

          {/* Description */}
          {item.description && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', marginBottom:8 }}>Về địa điểm này</div>
              <p style={{ fontSize:14, color:'#64748b', lineHeight:1.75, margin:0 }}>{item.description}</p>
            </div>
          )}

          {/* Highlights */}
          {item.highlights?.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', marginBottom:10 }}>✨ Điểm nổi bật</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {item.highlights.map((h, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:activeColor, color:'white', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                      {i+1}
                    </div>
                    <span style={{ fontSize:14, color:'#374151', lineHeight:1.6 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {tipsArray.length > 0 && (
            <div style={{ background:'#fffbeb', borderRadius:14, padding:'14px 16px', marginBottom:20, border:'1px solid #fde68a' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#92400e', marginBottom:10 }}>💡 Lưu ý hữu ích</div>
              <ul style={{ margin:0, padding:'0 0 0 16px', display:'flex', flexDirection:'column', gap:6 }}>
                {tipsArray.map((tip, i) => (
                  <li key={i} style={{ fontSize:13, color:'#78350f', lineHeight:1.6 }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Best for + Nearby */}
          {(item.best_for || item.nearby) && (
            <div style={{ display:'grid', gridTemplateColumns: item.best_for && item.nearby ? '1fr 1fr' : '1fr', gap:12, marginBottom:20 }}>
              {item.best_for && (
                <div style={{ background:'#f0f9ff', borderRadius:12, padding:'12px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#0369a1', marginBottom:4 }}>👥 Phù hợp cho</div>
                  <div style={{ fontSize:13, color:'#0f172a', lineHeight:1.5 }}>{item.best_for}</div>
                </div>
              )}
              {item.nearby && (
                <div style={{ background:'#f0fdf4', borderRadius:12, padding:'12px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#16a34a', marginBottom:4 }}>📍 Lân cận</div>
                  <div style={{ fontSize:13, color:'#0f172a', lineHeight:1.5 }}>{item.nearby}</div>
                </div>
              )}
            </div>
          )}

          {/* Info rows */}
          <div style={{ borderTop:'1px solid #f1f5f9' }}>
            {[
              item.opening_hours     && { icon:'🕐', label:'Giờ mở cửa',        value:item.opening_hours,     color:null },
              item.entrance_fee      && { icon:'🎫', label:'Vé vào cửa',         value:item.entrance_fee,      color:'#6366f1' },
              item.duration          && { icon:'⏱',  label:'Thời gian',          value:item.duration,          color:null },
              item.transport_to_next && { icon:'🗺️', label:'Di chuyển tiếp theo',value:item.transport_to_next, color:'#0369a1' },
            ].filter(Boolean).map((row, i, arr) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:i < arr.length-1 ? '1px solid #f8fafc' : 'none' }}>
                <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>{row.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{row.label}</div>
                  <div style={{ fontSize:13, color:row.color||'#0f172a', fontWeight:500, marginTop:1 }}>{row.value}</div>
                </div>
              </div>
            ))}

            {item.address && (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid #f8fafc', cursor:'copy' }}
                onClick={() => navigator.clipboard?.writeText(item.address)}>
                <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>📋</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Sao chép địa chỉ</div>
                  <div style={{ fontSize:13, color:'#6366f1', fontWeight:500, marginTop:1 }}>{item.address}</div>
                </div>
                <span style={{ fontSize:11, color:'#94a3b8', background:'#f8fafc', padding:'2px 8px', borderRadius:6, flexShrink:0 }}>copy</span>
              </div>
            )}

            {item.website && (
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0' }}>
                <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>🌐</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>Website</div>
                  <a href={item.website} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:13, color:'#6366f1', fontWeight:500, textDecoration:'none' }}>
                    {item.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Direction button */}
          {item.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(item.address)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                background:activeColor, color:'white',
                padding:'14px', borderRadius:14, marginTop:20,
                textDecoration:'none', fontSize:14, fontWeight:600,
                boxShadow:`0 4px 16px ${activeColor}44`,
              }}>
              📍 Chỉ đường
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 }            to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @media(max-width:1023px){
          .place-modal-sheet{
            left: 0 !important;
            right: 0 !important;
            width: auto !important;
            transform: none !important;
            bottom: 0 !important;
            border-radius: 24px 24px 0 0 !important;
          }
        }
        @media(min-width:1024px){
          .place-modal-sheet{
            width: var(--sheet-width);
            left: var(--sheet-left) !important;
            right: auto !important;
            transform: none;
            border-radius: 24px;
            bottom: 20px;
          }
        }
      `}</style>
    </>
  )
}
// ── Single Day View ──────────────────────────────────────────────────────────
function DayView({ day, dayIndex, accommodation }) {
  const [activePlace, setActivePlace] = useState(null)
  const [modalItem, setModalItem] = useState(null)
  const [modalRect, setModalRect] = useState(null)
  const dayDetailRef = useRef(null)
  const activeColor = DAY_COLORS[dayIndex % DAY_COLORS.length]

  const mapPlaces = useMemo(
    () => (day.schedule || [])
      .filter(hasValidCoords)
      .map(item => ({ place:item.place, address:item.address, lat:item.lat, lng:item.lng, time:item.time })),
    [day.schedule]
  )
  const fallbackAccommodationPlaces = useMemo(
    () => (accommodation || [])
      .filter(hasValidCoords)
      .map(h => ({ place:h.name, address:h.area, lat:h.lat, lng:h.lng })),
    [accommodation]
  )
  const finalMapPlaces = mapPlaces.length > 0 ? mapPlaces : fallbackAccommodationPlaces

  return (
    <div>
      {/* Place Detail Modal */}
      {modalItem && (
        <PlaceModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          activeColor={activeColor}
          modalRect={modalRect}
        />
      )}

      {/* Day header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ width:36, height:36, background:activeColor, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'white', flexShrink:0 }}>
          {day.day}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', fontFamily:"'Fraunces', serif" }}>{day.title}</div>
          {day.weather && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>🌡️ {day.weather}</div>}
        </div>
      </div>

        <div ref={dayDetailRef} className="day-detail-grid">
        {/* Map: mobile ở trên, desktop ở bên phải */}
        <div className="day-map-col">
          <GoongMap key={`${dayIndex}-${activePlace}`} places={finalMapPlaces} activePlace={activePlace} dayIndex={dayIndex} />
        </div>

        {/* Schedule: mobile ở dưới, desktop ở bên trái */}
          <div className="day-schedule-col" style={{ background:'white', borderRadius:16, border:'1px solid #f1f5f9', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.03)' }}>
            {day.schedule?.map((item, idx) => {
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
              <div key={idx}
                className="schedule-item-row"
                onClick={openModal}
                style={{ display:'grid', gridTemplateColumns:'48px minmax(0,1fr) 112px', gap:12, alignItems:'center', padding:'15px 16px', border:'1px solid '+(isActive ? '#c7d2fe' : '#e5e7eb'), borderRadius:12, marginBottom: idx < day.schedule.length-1 ? 12 : 0, cursor:'pointer', background:isActive ? '#eef2ff' : 'white', transition:'background 0.15s, border-color 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#fafbff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.05)' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' } }}
              >
                {/* Time */}
                <div className="schedule-item-icon" style={{ display:'flex', justifyContent:'center' }}>
                  <div style={{ width:34, height:34, borderRadius:'50%', background:isActive ? '#e0e7ff' : '#f8fafc', border:'1px solid '+(isActive ? '#c7d2fe' : '#e2e8f0'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                    {placeIcon}
                  </div>
                </div>
                {/* Content */}
                <div className="schedule-item-content" style={{ minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#0f172a', lineHeight:1.35, minWidth:0, maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.place}</span>
                  {placeIdx !== -1 && (
                    <span onClick={handleMapClick} style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background:'#eef2ff', color:'#6366f1', fontWeight:600, cursor:'pointer' }}>
                      #{placeIdx+1} bản đồ
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>📍 {item.address}</div>
              </div>
              {/* Cost + chevron */}
              <div className="schedule-item-meta" style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'center', minHeight:52, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#16a34a', lineHeight:1.3, maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.estimated_cost}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, lineHeight:1.3, maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>⏱ {item.duration}</div>
                <div style={{ fontSize:15, color:'#cbd5e1', marginTop:5 }}>›</div>
              </div>
            </div>
          )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Export ──────────────────────────────────────────────────────────────
// focusDay: null = hiện tất cả, number = chỉ hiện ngày đó
export default function ItineraryView({ itinerary, focusDay = null }) {
  if (!itinerary) return null
  const { days, accommodation, packing_list, budget_breakdown } = itinerary

  const visibleDays = focusDay !== null ? [days[focusDay]].filter(Boolean) : (days || [])
  const focusDayIndex = focusDay !== null ? focusDay : null

  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Fraunces:wght@300;600&display=swap');
        .hotel-card{border:1px solid #f1f5f9;border-radius:14px;padding:14px 18px;transition:all 0.2s;background:white}
        .hotel-card:hover{border-color:#e0e7ff;box-shadow:0 4px 16px rgba(99,102,241,0.06)}
        .pack-chip{display:inline-flex;align-items:center;gap:5px;background:#f8fafc;border:1px solid #f1f5f9;border-radius:8px;padding:5px 10px;font-size:12px;color:#475569}
        .budget-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #f8fafc}
        .budget-row:last-child{border-bottom:none}
        .day-detail-grid{display:grid;grid-template-columns:1fr;gap:12px;width:100%;max-width:100%;min-width:0}
        .day-map-col{order:1}
        .day-schedule-col{order:2}
        .day-map-col,.day-schedule-col{width:100%;max-width:100%;min-width:0;box-sizing:border-box}
        @media(min-width:1024px){
          .day-detail-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:stretch}
          .day-map-col,.day-schedule-col{height:100%}
          .day-map-col{order:2}
          .day-schedule-col{order:1}
        }
        @media(max-width:900px){
          .day-detail-grid{gap:8px}
          .day-schedule-col{
            padding:clamp(5px,1.5vw,8px)!important;
            overflow-x:visible;
            width:100%;
            max-width:100%;
            min-width:0;
            box-sizing:border-box;
            border-radius:clamp(12px,4vw,16px) !important;
          }
          .schedule-item-row{
            display:flex !important;
            align-items:center !important;
            gap:clamp(6px,2vw,10px) !important;
            padding:clamp(7px,2.1vw,10px) !important;
            width:100% !important;
            max-width:100% !important;
            box-sizing:border-box !important;
            margin-left:0 !important;
            margin-right:0 !important;
            overflow:hidden !important;
            border-width:1px !important;
            border-radius:clamp(10px,3.6vw,14px) !important;
            box-shadow:none !important;
          }
          .schedule-item-icon{flex:0 0 clamp(30px,8.5vw,36px)}
          .schedule-item-content{flex:1 1 auto;min-width:0}
          .schedule-item-meta{flex:0 0 clamp(64px,20vw,76px);min-width:clamp(64px,20vw,76px)}
          .schedule-item-row *{min-width:0}
          .schedule-item-meta{padding-left:2px}
          .bottom-grid{grid-template-columns:1fr!important}
          .accommodation-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* Days */}
      <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
        {visibleDays.map((day, i) => (
          <DayView
            key={day.day}
            day={day}
            dayIndex={focusDayIndex !== null ? focusDayIndex : i}
            accommodation={accommodation}
          />
        ))}
      </div>

      {/* Budget + Packing — chỉ hiện khi xem tất cả */}
      {focusDay === null && (
        <div className="bottom-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:24 }}>
          {budget_breakdown && (
            <div style={{ background:'white', borderRadius:16, border:'1px solid #f1f5f9', padding:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:'0 0 14px 0' }}>💵 Phân bổ ngân sách</h3>
              {Object.entries(budget_breakdown).map(([key, val]) => (
                <div key={key} className="budget-row">
                  <span style={{ fontSize:13, color:'#475569' }}>{BUDGET_KEYS[key] || '📌 '+key.replace(/_/g,' ')}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{val}</span>
                </div>
              ))}
            </div>
          )}
          {packing_list?.length > 0 && (
            <div style={{ background:'white', borderRadius:16, border:'1px solid #f1f5f9', padding:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:'0 0 14px 0' }}>🎒 Đồ cần mang</h3>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {packing_list.map((item,i) => (
                  <span key={i} className="pack-chip"><span style={{ color:'#16a34a', fontWeight:600 }}>✓</span> {item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accommodation — chỉ hiện khi xem tất cả */}
      {focusDay === null && accommodation?.length > 0 && (
        <div style={{ background:'white', borderRadius:16, border:'1px solid #f1f5f9', padding:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.03)', marginTop:16 }}>
          <h3 style={{ fontSize:14, fontWeight:700, color:'#0f172a', margin:'0 0 14px 0' }}>🏨 Chỗ ở gợi ý</h3>
          <div className="accommodation-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
            {accommodation.map((h,i) => (
              <div key={i} className="hotel-card">
                <div style={{ fontWeight:600, fontSize:13, color:'#0f172a', marginBottom:5 }}>{h.name}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginBottom:7 }}>📍 {h.area}</div>
                <div style={{ fontSize:12, fontWeight:600, color:'#16a34a', padding:'3px 8px', background:'#f0fdf4', borderRadius:6, display:'inline-block', marginBottom:7 }}>{h.price_range}</div>
                <div style={{ fontSize:11, color:'#94a3b8', lineHeight:1.6 }}>{h.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
