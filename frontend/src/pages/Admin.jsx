import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/useTheme'

const PAGE_SIZE = 10

const TABS = [
  { key: 'overview', label: 'Overview', icon: '◎', desc: 'System health & snapshot' },
  { key: 'ai', label: 'AI Monitor', icon: '◌', desc: 'Prompt, model, trace, quality' },
  { key: 'users', label: 'Users', icon: '◐', desc: 'Identity & access' },
  { key: 'trips', label: 'Trips', icon: '◍', desc: 'Trip generation inventory' },
  { key: 'catalog', label: 'Catalog', icon: '◒', desc: 'Destinations, hotels, activities' },
  { key: 'audit', label: 'Audit', icon: '◓', desc: 'Admin action history' },
  { key: 'tools', label: 'Data Tools', icon: '◇', desc: 'Export, import, backup' },
]

const ACTIVITY_CATEGORIES = ['attraction', 'restaurant', 'cafe']

const OVERVIEW_KPI = [
  { key: 'users', label: 'Người dùng', tone: 'cyan' },
  { key: 'active_users', label: 'Đang hoạt động', tone: 'green' },
  { key: 'locked_users', label: 'Đã khóa', tone: 'red' },
  { key: 'admins', label: 'Admin', tone: 'violet' },
  { key: 'trips', label: 'Chuyến đi', tone: 'amber' },
  { key: 'destinations', label: 'Điểm đến', tone: 'cyan' },
  { key: 'hotels', label: 'Khách sạn', tone: 'violet' },
  { key: 'activities', label: 'Hoạt động', tone: 'green' },
]

const AI_MONITOR_CARDS = [
  {
    key: 'prompt',
    eyebrow: 'Prompt Ops',
    title: 'Prompt versioning',
    body: 'Chưa có endpoint quản lý system prompt. Khối này đã sẵn để cắm editor, revision history và rollback sau.',
    status: 'Pending backend',
  },
  {
    key: 'model',
    eyebrow: 'Model Ops',
    title: 'Model & temperature',
    body: 'Dựng sẵn không gian cho model switching và cấu hình độ sáng tạo của agent ngay trên admin UI.',
    status: 'Placeholder ready',
  },
  {
    key: 'hallucination',
    eyebrow: 'Quality Loop',
    title: 'Hallucination reports',
    body: 'Chưa có dữ liệu gắn cờ thủ công. Sau này có thể gắn trực tiếp vào itinerary hoặc địa điểm bị sai.',
    status: 'No reports',
  },
  {
    key: 'trace',
    eyebrow: 'Trace Log',
    title: 'Prompt / raw output',
    body: 'Phù hợp để hiển thị prompt đầu vào, raw output và lỗi parse khi backend bổ sung AI trace log.',
    status: 'Telemetry offline',
  },
]

const CATALOG = {
  destinations: {
    label: 'Điểm đến',
    path: '/catalog/destinations',
    defaults: { name: '', city: '', rating: '', tags: '', description: '', lat: '', lng: '' },
    cols: ['id', 'name', 'city', 'rating', 'tags'],
    fields: [
      { key: 'name', label: 'Tên', required: true },
      { key: 'city', label: 'Thành phố' },
      { key: 'rating', label: 'Rating', type: 'number', step: '0.1' },
      { key: 'tags', label: 'Tags' },
      { key: 'description', label: 'Mô tả', wide: true },
      { key: 'lat', label: 'Lat', type: 'number', step: '0.000001' },
      { key: 'lng', label: 'Lng', type: 'number', step: '0.000001' },
    ],
  },
  hotels: {
    label: 'Khách sạn',
    path: '/catalog/hotels',
    defaults: { destination_id: '', name: '', price_range: '', address: '', rating: '', lat: '', lng: '' },
    cols: ['id', 'destination_id', 'name', 'price_range', 'rating'],
    fields: [
      { key: 'destination_id', label: 'Điểm đến', type: 'destination' },
      { key: 'name', label: 'Tên', required: true },
      { key: 'price_range', label: 'Mức giá' },
      { key: 'address', label: 'Địa chỉ', wide: true },
      { key: 'rating', label: 'Rating', type: 'number', step: '0.1' },
      { key: 'lat', label: 'Lat', type: 'number', step: '0.000001' },
      { key: 'lng', label: 'Lng', type: 'number', step: '0.000001' },
    ],
  },
  activities: {
    label: 'Hoạt động',
    path: '/catalog/activities',
    defaults: { destination_id: '', name: '', category: '', price_range: '', address: '', rating: '', lat: '', lng: '' },
    cols: ['id', 'destination_id', 'name', 'category', 'rating'],
    fields: [
      { key: 'destination_id', label: 'Điểm đến', type: 'destination' },
      { key: 'name', label: 'Tên', required: true },
      { key: 'category', label: 'Danh mục', type: 'category' },
      { key: 'price_range', label: 'Mức giá' },
      { key: 'address', label: 'Địa chỉ', wide: true },
      { key: 'rating', label: 'Rating', type: 'number', step: '0.1' },
      { key: 'lat', label: 'Lat', type: 'number', step: '0.000001' },
      { key: 'lng', label: 'Lng', type: 'number', step: '0.000001' },
    ],
  },
}

const AUDIT_ACTION_OPTIONS = [
  '',
  'USER_UPDATE',
  'USER_BULK_STATUS',
  'USER_DELETE',
  'TRIP_DELETE',
  'TRIP_BULK_DELETE',
  'CATALOG_DESTINATION_CREATE',
  'CATALOG_DESTINATION_UPDATE',
  'CATALOG_DESTINATION_DELETE',
  'CATALOG_HOTEL_CREATE',
  'CATALOG_HOTEL_UPDATE',
  'CATALOG_HOTEL_DELETE',
  'CATALOG_ACTIVITY_CREATE',
  'CATALOG_ACTIVITY_UPDATE',
  'CATALOG_ACTIVITY_DELETE',
  'TOOLS_EXPORT_CSV',
  'TOOLS_BACKUP_DB',
  'TOOLS_IMPORT_CSV',
]

const fmtDate = (value) => (value ? new Date(value).toLocaleString() : '-')
const numOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value))
const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0))
const pct = (value) => (value === null || value === undefined ? '--' : `${Number(value).toFixed(1)}%`)

function buildCatalogPayload(values) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (['destination_id', 'lat', 'lng', 'rating'].includes(key)) return [key, numOrNull(value)]
      return [key, value === '' ? null : value]
    }),
  )
}

function validateCatalogForm(entity, values) {
  const name = String(values.name || '').trim()
  if (!name) return 'Tên là bắt buộc'

  const rating = numOrNull(values.rating)
  if (rating !== null && (rating < 0 || rating > 5)) return 'Rating phải nằm trong khoảng 0 đến 5'

  const lat = numOrNull(values.lat)
  const lng = numOrNull(values.lng)
  if (lat !== null && (lat < -90 || lat > 90)) return 'Latitude không hợp lệ'
  if (lng !== null && (lng < -180 || lng > 180)) return 'Longitude không hợp lệ'

  if ((entity === 'hotels' || entity === 'activities') && !values.destination_id) {
    return 'Cần chọn điểm đến'
  }

  return ''
}

function ShellPanel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`shell-panel ${className}`.trim()}>
      {(title || subtitle || action) && (
        <div className="section-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="section-copy">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function Pager({ offset, total, onPrev, onNext }) {
  const end = Math.min(offset + PAGE_SIZE, total)
  return (
    <div className="pager">
      <span>Hiển thị {total ? offset + 1 : 0}-{end} / {total}</span>
      <button className="btn" type="button" disabled={offset === 0} onClick={onPrev}>Trước</button>
      <button className="btn" type="button" disabled={end >= total} onClick={onNext}>Sau</button>
    </div>
  )
}

function EmptyState({ title, hint }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {hint && <div>{hint}</div>}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function ConfirmText({ itemType, itemLabel }) {
  return `Bạn có chắc muốn xóa ${itemType}${itemLabel ? ` "${itemLabel}"` : ''}?`
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ marginBottom: 12 }}>
          <h3>{title}</h3>
          <button className="btn" type="button" onClick={onClose}>Đóng</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CatalogInput({ field, value, onChange, destinations }) {
  if (field.type === 'destination') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chọn điểm đến</option>
        {destinations.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'category') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chọn danh mục</option>
        {ACTIVITY_CATEGORIES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={field.type || 'text'}
      step={field.step}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
    />
  )
}

function CatalogForm({ config, form, onChange, onSubmit, onCancel, editing, destinations, submitting }) {
  return (
    <ShellPanel
      title={editing ? `Cập nhật ${config.label.toLowerCase()}` : `Tạo ${config.label.toLowerCase()} mới`}
      subtitle="Sửa dữ liệu nguồn đang cấp cho AI planner và dashboard người dùng."
      className="panel-soft"
    >
      <div className="form-grid">
        {config.fields.map((field) => (
          <label key={field.key} className={field.wide ? 'field field-wide' : 'field'}>
            <span>{field.label}</span>
            <CatalogInput
              field={field}
              value={form[field.key]}
              onChange={(nextValue) => onChange(field.key, nextValue)}
              destinations={destinations}
            />
          </label>
        ))}
      </div>
      <div className="ctrl">
        <button className="btn btn-primary" type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mới'}
        </button>
        {editing && <button className="btn" type="button" onClick={onCancel} disabled={submitting}>Hủy</button>}
      </div>
    </ShellPanel>
  )
}

function KpiCard({ label, value, tone }) {
  return (
    <div className={`metric-card tone-${tone || 'cyan'}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{formatNumber(value)}</p>
    </div>
  )
}

function MiniList({ items, renderItem, emptyTitle, emptyHint }) {
  if (!items.length) return <EmptyState title={emptyTitle} hint={emptyHint} />
  return <div className="list">{items.map(renderItem)}</div>
}

export default function Admin() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [tab, setTab] = useState('overview')
  const [toast, setToast] = useState('')
  const [overview, setOverview] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [entity, setEntity] = useState('destinations')
  const [editingCatalogId, setEditingCatalogId] = useState(null)
  const [catalogSubmitting, setCatalogSubmitting] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const [tripDetail, setTripDetail] = useState(null)
  const [loadingTripDetail, setLoadingTripDetail] = useState(false)
  const [destinations, setDestinations] = useState([])

  const [users, setUsers] = useState({ items: [], total: 0, offset: 0, q: '', role: '', isActive: '', selected: [], loading: false })
  const [trips, setTrips] = useState({ items: [], total: 0, offset: 0, q: '', userId: '', selected: [], loading: false })
  const [catalog, setCatalog] = useState({
    items: [],
    total: 0,
    offset: 0,
    q: '',
    destinationId: '',
    category: '',
    loading: false,
    form: { ...CATALOG.destinations.defaults },
  })
  const [audit, setAudit] = useState({ items: [], total: 0, offset: 0, q: '', action: '', loading: false })
  const [importing, setImporting] = useState('')

  const currentCatalogConfig = CATALOG[entity]
  const alerts = overview?.alerts || []
  const stats = overview?.stats || {}
  const recentUsers = overview?.recent_users || []
  const recentTrips = overview?.recent_trips || []
  const topDestinations = overview?.top_destinations || []
  const apiHealth = overview?.api_health || {}

  const activityCategories = useMemo(() => {
    const fromItems = catalog.items.map((item) => item.category).filter(Boolean)
    return Array.from(new Set([...ACTIVITY_CATEGORIES, ...fromItems]))
  }, [catalog.items])

  const derivedHealth = useMemo(() => {
    const totalRequests = Number(apiHealth.total_requests || 0)
    const failedRequests = Number(apiHealth.failed_requests || 0)
    const successRate = totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests) * 100 : null
    const systemState = alerts.length ? 'Attention' : failedRequests > 0 ? 'Degraded' : 'Stable'
    return { totalRequests, failedRequests, successRate, systemState }
  }, [alerts.length, apiHealth.failed_requests, apiHealth.total_requests])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  const pushToast = useCallback((message) => {
    setToast(message)
    window.clearTimeout(window.__adminToastTimer)
    window.__adminToastTimer = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const resetCatalogForm = useCallback((nextEntity = entity) => {
    setEditingCatalogId(null)
    setCatalog((prev) => ({ ...prev, form: { ...CATALOG[nextEntity].defaults } }))
  }, [entity])

  const loadDestinations = useCallback(async () => {
    try {
      const res = await api.get('/catalog/destinations', { params: { limit: 200, offset: 0 } })
      setDestinations(res.data.items || [])
    } catch {
      setDestinations([])
    }
  }, [])

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true)
    try {
      const res = await api.get('/admin/overview')
      setOverview(res.data)
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Không tải được tổng quan')
    } finally {
      setLoadingOverview(false)
    }
  }, [pushToast])

  const loadUsers = useCallback(async (nextOffset = users.offset) => {
    setUsers((prev) => ({ ...prev, loading: true }))
    try {
      const res = await api.get('/admin/users', {
        params: {
          limit: PAGE_SIZE,
          offset: nextOffset,
          q: users.q || undefined,
          role: users.role || undefined,
          is_active: users.isActive || undefined,
        },
      })
      setUsers((prev) => ({ ...prev, loading: false, offset: nextOffset, items: res.data.items || [], total: res.data.total || 0, selected: [] }))
    } catch (err) {
      setUsers((prev) => ({ ...prev, loading: false }))
      pushToast(err.response?.data?.detail || 'Không tải được danh sách người dùng')
    }
  }, [pushToast, users.isActive, users.q, users.role, users.offset])

  const loadTrips = useCallback(async (nextOffset = trips.offset) => {
    setTrips((prev) => ({ ...prev, loading: true }))
    try {
      const res = await api.get('/admin/trips', {
        params: {
          limit: PAGE_SIZE,
          offset: nextOffset,
          q: trips.q || undefined,
          user_id: trips.userId ? Number(trips.userId) : undefined,
        },
      })
      setTrips((prev) => ({ ...prev, loading: false, offset: nextOffset, items: res.data.items || [], total: res.data.total || 0, selected: [] }))
    } catch (err) {
      setTrips((prev) => ({ ...prev, loading: false }))
      pushToast(err.response?.data?.detail || 'Không tải được danh sách chuyến đi')
    }
  }, [pushToast, trips.offset, trips.q, trips.userId])

  const loadCatalog = useCallback(async (nextOffset = catalog.offset) => {
    setCatalog((prev) => ({ ...prev, loading: true }))
    try {
      const params = { limit: PAGE_SIZE, offset: nextOffset, q: catalog.q || undefined }
      if (entity === 'hotels' || entity === 'activities') {
        params.destination_id = catalog.destinationId ? Number(catalog.destinationId) : undefined
      }
      if (entity === 'activities') {
        params.category = catalog.category || undefined
      }
      const res = await api.get(currentCatalogConfig.path, { params })
      setCatalog((prev) => ({
        ...prev,
        loading: false,
        offset: nextOffset,
        items: res.data.items || [],
        total: res.data.total || 0,
      }))
    } catch (err) {
      setCatalog((prev) => ({ ...prev, loading: false }))
      pushToast(err.response?.data?.detail || 'Không tải được danh mục')
    }
  }, [catalog.category, catalog.destinationId, catalog.offset, catalog.q, currentCatalogConfig.path, entity, pushToast])

  const loadAudit = useCallback(async (nextOffset = audit.offset) => {
    setAudit((prev) => ({ ...prev, loading: true }))
    try {
      const res = await api.get('/admin/audit-logs', {
        params: { limit: PAGE_SIZE, offset: nextOffset, q: audit.q || undefined, action: audit.action || undefined },
      })
      setAudit((prev) => ({ ...prev, loading: false, offset: nextOffset, items: res.data.items || [], total: res.data.total || 0 }))
    } catch (err) {
      setAudit((prev) => ({ ...prev, loading: false }))
      pushToast(err.response?.data?.detail || 'Không tải được nhật ký hệ thống')
    }
  }, [audit.action, audit.offset, audit.q, pushToast])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { loadDestinations() }, [loadDestinations])
  useEffect(() => { if (tab === 'users') loadUsers(0) }, [loadUsers, tab])
  useEffect(() => { if (tab === 'trips') loadTrips(0) }, [loadTrips, tab])
  useEffect(() => { if (tab === 'catalog') loadCatalog(0) }, [loadCatalog, tab, entity])
  useEffect(() => { if (tab === 'audit') loadAudit(0) }, [loadAudit, tab])

  async function updateUser(id, payload) {
    setActionBusy(`user-${id}`)
    try {
      await api.patch(`/admin/users/${id}`, payload)
      pushToast('Đã cập nhật người dùng')
      loadUsers(users.offset)
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Cập nhật thất bại')
    } finally {
      setActionBusy('')
    }
  }

  async function deleteUser(id, name) {
    if (!window.confirm(ConfirmText({ itemType: 'người dùng', itemLabel: name || id }))) return
    setActionBusy(`user-delete-${id}`)
    try {
      await api.delete(`/admin/users/${id}`)
      pushToast('Đã xóa người dùng')
      loadUsers(users.offset)
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Xóa người dùng thất bại')
    } finally {
      setActionBusy('')
    }
  }

  async function bulkUserStatus(isActive) {
    if (!users.selected.length) return
    setActionBusy('users-bulk')
    try {
      await api.post('/admin/users/bulk-status', { user_ids: users.selected.map(Number), is_active: isActive })
      pushToast(`Đã cập nhật ${users.selected.length} người dùng`)
      loadUsers(users.offset)
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Cập nhật hàng loạt thất bại')
    } finally {
      setActionBusy('')
    }
  }

  async function openTripDetail(id) {
    setLoadingTripDetail(true)
    try {
      const res = await api.get(`/admin/trips/${id}`)
      setTripDetail(res.data)
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Không tải được chi tiết chuyến đi')
    } finally {
      setLoadingTripDetail(false)
    }
  }

  async function deleteTrip(id, destination) {
    if (!window.confirm(ConfirmText({ itemType: 'chuyến đi', itemLabel: destination || id }))) return
    setActionBusy(`trip-delete-${id}`)
    try {
      await api.delete(`/admin/trips/${id}`)
      pushToast('Đã xóa chuyến đi')
      if (tripDetail?.id === String(id)) setTripDetail(null)
      loadTrips(trips.offset)
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Xóa chuyến đi thất bại')
    } finally {
      setActionBusy('')
    }
  }

  async function bulkDeleteTrips() {
    if (!trips.selected.length || !window.confirm(`Bạn có chắc muốn xóa ${trips.selected.length} chuyến đi đã chọn?`)) return
    setActionBusy('trips-bulk-delete')
    try {
      await api.post('/admin/trips/bulk-delete', { trip_ids: trips.selected.map(Number) })
      pushToast(`Đã xóa ${trips.selected.length} chuyến đi`)
      setTripDetail(null)
      loadTrips(trips.offset)
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Xóa hàng loạt thất bại')
    } finally {
      setActionBusy('')
    }
  }

  function startEditCatalog(row) {
    setEditingCatalogId(row.id)
    setCatalog((prev) => ({
      ...prev,
      form: {
        ...currentCatalogConfig.defaults,
        ...Object.fromEntries(currentCatalogConfig.fields.map((field) => [field.key, row[field.key] ?? ''])),
      },
    }))
  }

  async function submitCatalog() {
    const validationMessage = validateCatalogForm(entity, catalog.form)
    if (validationMessage) {
      pushToast(validationMessage)
      return
    }

    setCatalogSubmitting(true)
    try {
      const payload = buildCatalogPayload(catalog.form)
      if (editingCatalogId) {
        await api.put(`${currentCatalogConfig.path}/${editingCatalogId}`, payload)
        pushToast('Đã cập nhật bản ghi')
      } else {
        await api.post(currentCatalogConfig.path, payload)
        pushToast('Đã tạo bản ghi mới')
      }
      resetCatalogForm()
      loadCatalog(editingCatalogId ? catalog.offset : 0)
      loadDestinations()
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Không lưu được bản ghi')
    } finally {
      setCatalogSubmitting(false)
    }
  }

  async function deleteCatalog(row) {
    const itemLabel = row.name || row.id
    if (!window.confirm(ConfirmText({ itemType: currentCatalogConfig.label.toLowerCase(), itemLabel }))) return
    setActionBusy(`catalog-delete-${row.id}`)
    try {
      await api.delete(`${currentCatalogConfig.path}/${row.id}`)
      pushToast('Đã xóa bản ghi')
      if (editingCatalogId === row.id) resetCatalogForm()
      loadCatalog(catalog.offset)
      loadDestinations()
      loadOverview()
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Xóa thất bại')
    } finally {
      setActionBusy('')
    }
  }

  async function download(path, fallbackName) {
    setActionBusy(`download-${fallbackName}`)
    try {
      const res = await api.get(path, { responseType: 'blob' })
      const cd = res.headers['content-disposition']
      const match = cd?.match(/filename="(.+)"/)
      const filename = match?.[1] || fallbackName
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      pushToast(`Đã tải ${filename}`)
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Tải xuống thất bại')
    } finally {
      setActionBusy('')
    }
  }

  async function importCsv(importEntity, file) {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setImporting(importEntity)
    try {
      const res = await api.post(`/admin/tools/import/${importEntity}.csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      pushToast(`Đã nhập ${res.data.inserted} dòng`)
      loadOverview()
      loadDestinations()
      if (tab === 'catalog' && entity === importEntity) loadCatalog(0)
    } catch (err) {
      pushToast(err.response?.data?.detail || 'Nhập dữ liệu thất bại')
    } finally {
      setImporting('')
    }
  }

  return (
    <div className={`admin-shell ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');
        .admin-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(34, 211, 238, 0.12), transparent 28%),
            radial-gradient(circle at top right, rgba(129, 140, 248, 0.12), transparent 22%),
            linear-gradient(180deg, #07111f 0%, #0a1527 46%, #08101d 100%);
          color: #e5eef8;
          font-family: 'IBM Plex Sans', sans-serif;
          padding: 20px;
        }
        .admin-layout {
          max-width: 1480px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 20px;
        }
        .admin-sidebar, .admin-main {
          min-width: 0;
        }
        .admin-sidebar {
          position: sticky;
          top: 20px;
          align-self: start;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(8, 15, 28, 0.84);
          backdrop-filter: blur(18px);
          border-radius: 28px;
          padding: 22px;
          box-shadow: 0 28px 80px rgba(2, 8, 23, 0.35);
        }
        .brand-kicker {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #7dd3fc;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .brand-title {
          margin: 0;
          font: 700 30px 'Space Grotesk', sans-serif;
          letter-spacing: -0.04em;
          color: #f8fbff;
        }
        .brand-copy {
          margin: 10px 0 0;
          color: #8aa0be;
          line-height: 1.6;
          font-size: 14px;
        }
        .system-status {
          margin-top: 18px;
          display: grid;
          gap: 14px;
          padding: 16px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(17, 24, 39, 0.94), rgba(15, 23, 42, 0.72));
          border: 1px solid rgba(125, 211, 252, 0.12);
        }
        .status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          color: #b6c5d9;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(15, 118, 110, 0.14);
          border: 1px solid rgba(45, 212, 191, 0.16);
          color: #99f6e4;
          font-weight: 700;
        }
        .status-pill.warn {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.2);
          color: #fcd34d;
        }
        .status-pill.danger {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(248, 113, 113, 0.24);
          color: #fca5a5;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 0 0 currentColor;
          animation: pulse 1.6s infinite;
        }
        .side-tabs {
          margin-top: 22px;
          display: grid;
          gap: 10px;
        }
        .side-tab {
          width: 100%;
          text-align: left;
          border: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(15, 23, 42, 0.55);
          border-radius: 18px;
          padding: 14px 16px;
          color: #d9e6f5;
          cursor: pointer;
        }
        .side-tab.active {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.16), rgba(129, 140, 248, 0.16));
          border-color: rgba(125, 211, 252, 0.34);
          box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.08), 0 16px 34px rgba(5, 10, 20, 0.32);
        }
        .side-tab-top {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        .side-tab-icon {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(148, 163, 184, 0.12);
          color: #7dd3fc;
          font-size: 15px;
        }
        .side-tab small {
          display: block;
          color: #7890ad;
          font-size: 12px;
          line-height: 1.45;
        }
        .sidebar-footer {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          display: grid;
          gap: 8px;
          color: #90a4c0;
          font-size: 12px;
        }
        .admin-main {
          display: grid;
          gap: 18px;
        }
        .topbar, .shell-panel, .hero-card {
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(8, 15, 28, 0.74);
          backdrop-filter: blur(18px);
          box-shadow: 0 30px 90px rgba(2, 8, 23, 0.34);
        }
        .topbar {
          border-radius: 26px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .topbar h1 {
          margin: 0;
          font: 700 28px 'Space Grotesk', sans-serif;
          letter-spacing: -0.04em;
        }
        .topbar p {
          margin: 6px 0 0;
          color: #8ba0ba;
          font-size: 14px;
        }
        .head-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
        }
        .admin-identity {
          padding: 10px 14px;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(15, 23, 42, 0.56);
        }
        .admin-identity strong {
          display: block;
          font-size: 14px;
        }
        .admin-identity span {
          display: block;
          color: #7c93b1;
          font-size: 12px;
          margin-top: 3px;
        }
        .hero-card {
          border-radius: 30px;
          padding: 24px;
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.95fr);
          gap: 18px;
          overflow: hidden;
          position: relative;
        }
        .hero-card::after {
          content: '';
          position: absolute;
          inset: auto -40px -60px auto;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(34, 211, 238, 0.12), transparent 62%);
          pointer-events: none;
        }
        .hero-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(34, 211, 238, 0.1);
          color: #7dd3fc;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 14px;
        }
        .hero-title {
          margin: 0;
          font: 700 38px 'Space Grotesk', sans-serif;
          letter-spacing: -0.05em;
          line-height: 1.05;
          max-width: 10ch;
        }
        .hero-copy {
          margin: 14px 0 0;
          color: #91a7c2;
          font-size: 15px;
          line-height: 1.7;
          max-width: 58ch;
        }
        .hero-meta {
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .hero-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.62);
          border: 1px solid rgba(148, 163, 184, 0.12);
          color: #d3e0ef;
          font-size: 13px;
        }
        .hero-side {
          display: grid;
          gap: 14px;
          align-content: start;
        }
        .hero-side-card {
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(180deg, rgba(12, 20, 36, 0.96), rgba(11, 18, 33, 0.82));
          border: 1px solid rgba(148, 163, 184, 0.14);
        }
        .hero-side-card h3 {
          margin: 0 0 8px;
          font-size: 15px;
        }
        .hero-side-card p {
          margin: 0;
          color: #88a0bb;
          font-size: 13px;
          line-height: 1.6;
        }
        .hero-side-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .hero-stat {
          border-radius: 18px;
          padding: 16px;
          background: rgba(16, 24, 40, 0.74);
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        .hero-stat span {
          display: block;
          color: #7c94b0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 6px;
        }
        .hero-stat strong {
          font: 700 26px 'Space Grotesk', sans-serif;
          color: #f8fbff;
          letter-spacing: -0.04em;
        }
        .dashboard-grid {
          display: grid;
          gap: 18px;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .metric-card {
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(180deg, rgba(14, 21, 36, 0.96), rgba(10, 17, 30, 0.82));
          border: 1px solid rgba(148, 163, 184, 0.12);
          position: relative;
          overflow: hidden;
        }
        .metric-card::before {
          content: '';
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          height: 2px;
          background: var(--metric-accent, #22d3ee);
        }
        .tone-cyan { --metric-accent: #22d3ee; }
        .tone-green { --metric-accent: #34d399; }
        .tone-red { --metric-accent: #fb7185; }
        .tone-violet { --metric-accent: #a78bfa; }
        .tone-amber { --metric-accent: #fbbf24; }
        .metric-label {
          margin: 0;
          color: #7d94af;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 700;
        }
        .metric-value {
          margin: 10px 0 0;
          font: 700 30px 'Space Grotesk', sans-serif;
          letter-spacing: -0.05em;
          color: #f8fbff;
        }
        .ops-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 18px;
        }
        .stack-grid {
          display: grid;
          gap: 18px;
        }
        .shell-panel {
          border-radius: 26px;
          padding: 20px;
        }
        .panel-soft {
          background: rgba(12, 20, 35, 0.72);
        }
        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }
        .section-head h3 {
          margin: 0;
          font-size: 17px;
          color: #f8fbff;
        }
        .section-copy {
          margin: 6px 0 0;
          color: #7f96b2;
          line-height: 1.6;
          font-size: 13px;
        }
        .list {
          display: grid;
          gap: 10px;
        }
        .list-item {
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          background: rgba(15, 23, 42, 0.56);
        }
        .list-item strong {
          display: block;
          margin-bottom: 4px;
          color: #f8fbff;
        }
        .muted {
          color: #8399b5;
          font-size: 13px;
          line-height: 1.55;
        }
        .alert {
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(251, 191, 36, 0.2);
          background: rgba(120, 53, 15, 0.2);
          color: #fde68a;
        }
        .alert strong {
          display: block;
          color: #fef3c7;
          margin-bottom: 4px;
        }
        .ctrl {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .ctrl input, .ctrl select, .field input, .field select {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 13px;
          background: rgba(15, 23, 42, 0.62);
          color: #eef6ff;
          min-width: 0;
          outline: none;
        }
        .ctrl input::placeholder {
          color: #6f88a5;
        }
        .btn {
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(15, 23, 42, 0.62);
          color: #e5eef8;
          border-radius: 14px;
          padding: 10px 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-theme {
          min-width: 118px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #22d3ee, #818cf8);
          color: #06101d;
          border-color: transparent;
        }
        .btn-warn {
          background: rgba(127, 29, 29, 0.32);
          border-color: rgba(248, 113, 113, 0.24);
          color: #fecaca;
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .table-shell {
          overflow: auto;
          border-radius: 20px;
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        .t {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: 760px;
        }
        .t th, .t td {
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          padding: 12px 10px;
          text-align: left;
          vertical-align: top;
          background: rgba(9, 16, 28, 0.65);
        }
        .t th {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #7f96b2;
          background: rgba(14, 20, 34, 0.9);
        }
        .chip {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .chip.admin { background: rgba(109, 40, 217, 0.16); color: #c4b5fd; border-color: rgba(167, 139, 250, 0.18); }
        .chip.user { background: rgba(8, 145, 178, 0.14); color: #a5f3fc; border-color: rgba(103, 232, 249, 0.16); }
        .chip.active { background: rgba(6, 95, 70, 0.24); color: #99f6e4; border-color: rgba(45, 212, 191, 0.16); }
        .chip.locked { background: rgba(127, 29, 29, 0.28); color: #fecaca; border-color: rgba(248, 113, 113, 0.22); }
        .pager {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          margin-top: 14px;
          color: #8aa0bc;
          font-size: 13px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .field {
          display: grid;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
          color: #9eb0c8;
        }
        .field-wide {
          grid-column: span 3;
        }
        .empty-state {
          display: grid;
          gap: 4px;
          place-items: center;
          text-align: center;
          padding: 34px 16px;
          color: #7990ad;
          border: 1px dashed rgba(148, 163, 184, 0.22);
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.42);
        }
        .toast {
          position: fixed;
          right: 18px;
          bottom: 18px;
          background: rgba(8, 15, 28, 0.94);
          color: #f8fbff;
          padding: 12px 14px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 13px;
          max-width: 360px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          box-shadow: 0 20px 50px rgba(2, 8, 23, 0.4);
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 50;
          backdrop-filter: blur(8px);
        }
        .modal {
          width: min(1120px, 100%);
          max-height: 88vh;
          overflow: auto;
          background: #091220;
          border-radius: 26px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          box-shadow: 0 32px 90px rgba(2, 8, 23, 0.58);
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .detail-row {
          display: grid;
          gap: 6px;
          padding: 12px 14px;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.58);
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        .detail-row span {
          font-size: 11px;
          color: #7b93b0;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .trip-day {
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 18px;
          padding: 14px;
          background: rgba(15, 23, 42, 0.5);
          margin-bottom: 10px;
        }
        .trip-day h4 {
          margin: 0 0 8px;
          font-size: 15px;
        }
        .schedule-item {
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          padding-top: 8px;
          margin-top: 8px;
        }
        .detail-code, .audit-detail {
          background: rgba(4, 10, 18, 0.95);
          color: #cfe2f7;
          border-radius: 16px;
          padding: 12px;
          font-size: 12px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .ai-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .ai-card {
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(180deg, rgba(14, 21, 36, 0.94), rgba(10, 16, 28, 0.82));
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        .ai-card .eyebrow {
          display: block;
          color: #7dd3fc;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .ai-card h4 {
          margin: 0 0 8px;
          font-size: 16px;
        }
        .ai-card p {
          margin: 0;
          color: #89a0bb;
          line-height: 1.65;
          font-size: 13px;
        }
        .ai-status {
          margin-top: 12px;
          display: inline-flex;
          border-radius: 999px;
          padding: 5px 10px;
          background: rgba(148, 163, 184, 0.14);
          color: #c7d4e4;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .trace-list {
          display: grid;
          gap: 10px;
        }
        .trace-item {
          border-radius: 18px;
          padding: 14px;
          background: rgba(15, 23, 42, 0.54);
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        .trace-item strong {
          display: block;
          margin-bottom: 5px;
        }
        .trace-item code {
          color: #7dd3fc;
          font-family: inherit;
        }
        .admin-shell.theme-light {
          background:
            radial-gradient(circle at top left, rgba(34, 211, 238, 0.16), transparent 28%),
            radial-gradient(circle at top right, rgba(129, 140, 248, 0.14), transparent 22%),
            linear-gradient(180deg, #eef6ff 0%, #e2eefc 46%, #f6f9ff 100%);
          color: #0f172a;
        }
        .admin-shell.theme-light .admin-sidebar,
        .admin-shell.theme-light .topbar,
        .admin-shell.theme-light .shell-panel,
        .admin-shell.theme-light .hero-card {
          background: rgba(255, 255, 255, 0.88);
          border-color: rgba(148, 163, 184, 0.22);
          box-shadow: 0 24px 60px rgba(148, 163, 184, 0.18);
        }
        .admin-shell.theme-light .brand-title,
        .admin-shell.theme-light .hero-stat strong,
        .admin-shell.theme-light .metric-value,
        .admin-shell.theme-light .section-head h3,
        .admin-shell.theme-light .list-item strong,
        .admin-shell.theme-light .topbar h1 {
          color: #0f172a;
        }
        .admin-shell.theme-light .brand-copy,
        .admin-shell.theme-light .topbar p,
        .admin-shell.theme-light .hero-copy,
        .admin-shell.theme-light .section-copy,
        .admin-shell.theme-light .muted,
        .admin-shell.theme-light .hero-side-card p,
        .admin-shell.theme-light .status-row,
        .admin-shell.theme-light .pager,
        .admin-shell.theme-light .field,
        .admin-shell.theme-light .side-tab small,
        .admin-shell.theme-light .sidebar-footer,
        .admin-shell.theme-light .metric-label,
        .admin-shell.theme-light .hero-stat span,
        .admin-shell.theme-light .detail-row span,
        .admin-shell.theme-light .admin-identity span,
        .admin-shell.theme-light .t th {
          color: #4b637f;
        }
        .admin-shell.theme-light .system-status,
        .admin-shell.theme-light .hero-side-card,
        .admin-shell.theme-light .metric-card,
        .admin-shell.theme-light .ai-card,
        .admin-shell.theme-light .detail-code,
        .admin-shell.theme-light .audit-detail {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.95));
          border-color: rgba(148, 163, 184, 0.2);
          color: #0f172a;
        }
        .admin-shell.theme-light .side-tab,
        .admin-shell.theme-light .admin-identity,
        .admin-shell.theme-light .hero-chip,
        .admin-shell.theme-light .hero-stat,
        .admin-shell.theme-light .list-item,
        .admin-shell.theme-light .trace-item,
        .admin-shell.theme-light .trip-day,
        .admin-shell.theme-light .detail-row,
        .admin-shell.theme-light .empty-state,
        .admin-shell.theme-light .t th,
        .admin-shell.theme-light .t td {
          background: rgba(248, 250, 252, 0.95);
          border-color: rgba(148, 163, 184, 0.22);
          color: #0f172a;
        }
        .admin-shell.theme-light .ctrl input,
        .admin-shell.theme-light .ctrl select,
        .admin-shell.theme-light .field input,
        .admin-shell.theme-light .field select,
        .admin-shell.theme-light .btn {
          background: #ffffff;
          color: #0f172a;
          border-color: rgba(148, 163, 184, 0.26);
        }
        .admin-shell.theme-light .ctrl input::placeholder {
          color: #64748b;
        }
        .admin-shell.theme-light .btn-primary {
          color: #06101d;
          border-color: transparent;
        }
        .admin-shell.theme-light .modal {
          background: #ffffff;
          border-color: rgba(148, 163, 184, 0.22);
          box-shadow: 0 30px 80px rgba(148, 163, 184, 0.26);
        }
        .admin-shell.theme-light .toast {
          background: rgba(255, 255, 255, 0.96);
          color: #0f172a;
          border-color: rgba(148, 163, 184, 0.22);
          box-shadow: 0 24px 60px rgba(148, 163, 184, 0.26);
        }
        .admin-shell.theme-light .brand-kicker,
        .admin-shell.theme-light .hero-label,
        .admin-shell.theme-light .ai-card .eyebrow,
        .admin-shell.theme-light .trace-item code,
        .admin-shell.theme-light .side-tab-icon {
          color: #0369a1;
        }
        .admin-shell.theme-light .hero-label,
        .admin-shell.theme-light .side-tab-icon {
          background: rgba(14, 165, 233, 0.12);
        }
        .admin-shell.theme-light .hero-title,
        .admin-shell.theme-light .hero-chip,
        .admin-shell.theme-light .admin-identity strong,
        .admin-shell.theme-light .hero-side-card h3,
        .admin-shell.theme-light .ai-card h4,
        .admin-shell.theme-light .trace-item strong,
        .admin-shell.theme-light .trip-day h4,
        .admin-shell.theme-light .detail-code,
        .admin-shell.theme-light .audit-detail,
        .admin-shell.theme-light .detail-row strong,
        .admin-shell.theme-light .status-row strong,
        .admin-shell.theme-light .t td,
        .admin-shell.theme-light .t td strong,
        .admin-shell.theme-light .chip {
          color: #0f172a;
        }
        .admin-shell.theme-light .hero-chip,
        .admin-shell.theme-light .admin-identity,
        .admin-shell.theme-light .trace-item,
        .admin-shell.theme-light .detail-row,
        .admin-shell.theme-light .trip-day,
        .admin-shell.theme-light .list-item {
          background: rgba(248, 250, 252, 0.98);
        }
        .admin-shell.theme-light .status-pill {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(5, 150, 105, 0.18);
          color: #047857;
        }
        .admin-shell.theme-light .status-pill.warn {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(217, 119, 6, 0.2);
          color: #b45309;
        }
        .admin-shell.theme-light .status-pill.danger {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(220, 38, 38, 0.18);
          color: #b91c1c;
        }
        .admin-shell.theme-light .btn-warn {
          background: #fff1f2;
          border-color: rgba(248, 113, 113, 0.28);
          color: #b91c1c;
        }
        .admin-shell.theme-light .chip.admin {
          background: rgba(109, 40, 217, 0.12);
          color: #6d28d9;
          border-color: rgba(109, 40, 217, 0.18);
        }
        .admin-shell.theme-light .chip.user {
          background: rgba(14, 165, 233, 0.12);
          color: #0369a1;
          border-color: rgba(14, 165, 233, 0.18);
        }
        .admin-shell.theme-light .chip.active {
          background: rgba(16, 185, 129, 0.12);
          color: #047857;
          border-color: rgba(16, 185, 129, 0.18);
        }
        .admin-shell.theme-light .chip.locked {
          background: rgba(244, 63, 94, 0.12);
          color: #be123c;
          border-color: rgba(244, 63, 94, 0.2);
        }
        .admin-shell.theme-light .empty-state strong,
        .admin-shell.theme-light .alert strong {
          color: #0f172a;
        }
        .admin-shell.theme-light .alert {
          background: #fffbeb;
          border-color: rgba(245, 158, 11, 0.22);
          color: #92400e;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 currentColor; }
          70% { box-shadow: 0 0 0 10px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @media (max-width: 1260px) {
          .admin-layout { grid-template-columns: 1fr; }
          .admin-sidebar { position: static; }
          .hero-card, .ops-grid { grid-template-columns: 1fr; }
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 860px) {
          .admin-shell { padding: 14px; }
          .topbar, .shell-panel, .hero-card, .admin-sidebar { border-radius: 22px; }
          .metric-grid, .ai-grid, .form-grid, .detail-grid, .hero-side-grid { grid-template-columns: 1fr; }
          .field-wide { grid-column: span 1; }
          .hero-title { font-size: 30px; }
          .topbar h1 { font-size: 24px; }
        }
      `}</style>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="brand-kicker">AI Travel Planner</div>
          <h1 className="brand-title">Admin Control Center</h1>
          <p className="brand-copy">
            Không gian vận hành riêng cho admin, ưu tiên giám sát hệ thống, dữ liệu nguồn và các khối AI telemetry trong tương lai.
          </p>

          <div className="system-status">
            <div className="status-row">
              <span>System state</span>
              <span className={`status-pill ${derivedHealth.systemState === 'Stable' ? '' : derivedHealth.systemState === 'Attention' ? 'warn' : 'danger'}`}>
                <span className="pulse-dot" />
                {derivedHealth.systemState}
              </span>
            </div>
            <div className="status-row">
              <span>Total requests</span>
              <strong>{formatNumber(derivedHealth.totalRequests)}</strong>
            </div>
            <div className="status-row">
              <span>Success rate</span>
              <strong>{pct(derivedHealth.successRate)}</strong>
            </div>
          </div>

          <div className="side-tabs">
            {TABS.map((item) => (
              <button key={item.key} type="button" className={`side-tab ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>
                <div className="side-tab-top">
                  <span className="side-tab-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <div>Admin route độc lập với user-facing navbar.</div>
            <div>Thiết kế ưu tiên dark operations layout và mở rộng AI monitor.</div>
          </div>
        </aside>

        <main className="admin-main">
          <div className="topbar">
            <div>
              <h1>{TABS.find((item) => item.key === tab)?.label || 'Admin'}</h1>
              <p>Giữ nguyên khả năng quản trị hiện có, nhưng chuyển trải nghiệm sang mô hình control center riêng cho vận hành.</p>
            </div>
            <div className="head-actions">
              <div className="admin-identity">
                <strong>{user?.name || 'Admin'}</strong>
                <span>{user?.email || 'Không có email'}</span>
              </div>
              <button className="btn btn-theme" type="button" onClick={toggleTheme}>
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <button className="btn" type="button" onClick={loadOverview} disabled={loadingOverview}>
                {loadingOverview ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
              </button>
              <button className="btn btn-warn" type="button" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>

          {tab === 'overview' && (
            <div className="dashboard-grid">
              <section className="hero-card">
                <div>
                  <div className="hero-label">
                    <span className="pulse-dot" />
                    Agent oversight
                  </div>
                  <h2 className="hero-title">Control tower cho hệ thống AI travel planner</h2>
                  <p className="hero-copy">
                    Theo dõi trạng thái API, sức khỏe dữ liệu, chuyến đi gần đây và các khối monitoring dành cho AI agent trong một workspace độc lập với trải nghiệm người dùng cuối.
                  </p>
                  <div className="hero-meta">
                    <div className="hero-chip">Admin hiện tại: {overview?.current_admin?.name || user?.name || 'N/A'}</div>
                    <div className="hero-chip">5xx errors: {formatNumber(derivedHealth.failedRequests)}</div>
                    <div className="hero-chip">Alerts: {formatNumber(alerts.length)}</div>
                  </div>
                </div>

                <div className="hero-side">
                  <div className="hero-side-grid">
                    <div className="hero-stat">
                      <span>API success rate</span>
                      <strong>{pct(derivedHealth.successRate)}</strong>
                    </div>
                    <div className="hero-stat">
                      <span>Admin actions</span>
                      <strong>{formatNumber(stats.admins || 0)}</strong>
                    </div>
                  </div>
                  <div className="hero-side-card">
                    <h3>AI telemetry readiness</h3>
                    <p>Prompt control, reasoning log, hallucination reports và trace log đã có vị trí hiển thị, nhưng hiện chưa có backend telemetry riêng để cấp dữ liệu thật.</p>
                  </div>
                  <div className="hero-side-card">
                    <h3>Hướng mở rộng tiếp theo</h3>
                    <p>Khi backend bổ sung AI metrics, tab `AI Monitor` có thể nhận trực tiếp token cost, latency, model config và raw outputs mà không cần thay layout.</p>
                  </div>
                </div>
              </section>

              <div className="metric-grid">
                {OVERVIEW_KPI.map((item) => (
                  <KpiCard key={item.key} label={item.label} value={stats[item.key] ?? 0} tone={item.tone} />
                ))}
              </div>

              <div className="metric-grid">
                <div className="metric-card tone-cyan">
                  <p className="metric-label">AI token usage</p>
                  <p className="metric-value">--</p>
                  <div className="muted">Cần backend telemetry để theo dõi token theo model/provider.</div>
                </div>
                <div className="metric-card tone-violet">
                  <p className="metric-label">Average latency</p>
                  <p className="metric-value">--</p>
                  <div className="muted">Chưa có số đo riêng cho pipeline tạo itinerary.</div>
                </div>
                <div className="metric-card tone-green">
                  <p className="metric-label">AI success / fail</p>
                  <p className="metric-value">{pct(derivedHealth.successRate)}</p>
                  <div className="muted">Tạm lấy theo sức khỏe request API hiện có.</div>
                </div>
                <div className="metric-card tone-amber">
                  <p className="metric-label">Trace coverage</p>
                  <p className="metric-value">0%</p>
                  <div className="muted">AI trace log chưa được backend ghi nhận.</div>
                </div>
              </div>

              <div className="ops-grid">
                <div className="stack-grid">
                  <ShellPanel title="Cảnh báo hệ thống" subtitle="Các tín hiệu cần admin chú ý ngay trong vòng vận hành hiện tại.">
                    {loadingOverview ? <p className="muted">Đang tải dữ liệu tổng quan...</p> : alerts.length === 0 ? (
                      <EmptyState title="Không có cảnh báo nổi bật" hint="Hệ thống chưa ghi nhận vấn đề nghiêm trọng trong snapshot hiện tại." />
                    ) : alerts.map((item) => (
                      <div key={`${item.code}-${item.message}`} className="alert">
                        <strong>{item.code}</strong>
                        <div>{item.message}</div>
                      </div>
                    ))}
                  </ShellPanel>

                  <ShellPanel title="Chuyến đi gần đây" subtitle="Dùng để rà soát đầu ra mới sinh ra từ hệ thống.">
                    <MiniList
                      items={recentTrips}
                      emptyTitle="Chưa có chuyến đi gần đây"
                      emptyHint="Tạo thêm itinerary để có dữ liệu kiểm tra đầu ra."
                      renderItem={(item) => (
                        <div key={item.id} className="list-item">
                          <strong>{item.destination}</strong>
                          <div className="muted">{item.user_name || `User #${item.user_id}`} • {item.days} ngày • {fmtDate(item.created_at)}</div>
                        </div>
                      )}
                    />
                  </ShellPanel>
                </div>

                <div className="stack-grid">
                  <ShellPanel title="Điểm đến được tạo nhiều" subtitle="Tín hiệu nhu cầu để tối ưu nguồn dữ liệu AI và catalog.">
                    <MiniList
                      items={topDestinations}
                      emptyTitle="Chưa có dữ liệu"
                      emptyHint="Cần thêm trip generation để xuất hiện heat."
                      renderItem={(item) => (
                        <div key={item.destination} className="list-item">
                          <strong>{item.destination}</strong>
                          <div className="muted">{item.trip_count} chuyến đi</div>
                        </div>
                      )}
                    />
                  </ShellPanel>

                  <ShellPanel title="Người dùng mới" subtitle="Giúp admin quan sát tăng trưởng và rà soát account mới tạo.">
                    <MiniList
                      items={recentUsers}
                      emptyTitle="Chưa có người dùng mới"
                      emptyHint="Danh sách sẽ xuất hiện khi hệ thống có đăng ký mới."
                      renderItem={(item) => (
                        <div key={item.id} className="list-item">
                          <strong>{item.name}</strong>
                          <div className="muted">{item.email}</div>
                        </div>
                      )}
                    />
                  </ShellPanel>
                </div>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="dashboard-grid">
              <ShellPanel title="AI Monitor" subtitle="Khung quản trị cho prompt, model, trace log và vòng phản hồi của agent.">
                <div className="ai-grid">
                  {AI_MONITOR_CARDS.map((item) => (
                    <article key={item.key} className="ai-card">
                      <span className="eyebrow">{item.eyebrow}</span>
                      <h4>{item.title}</h4>
                      <p>{item.body}</p>
                      <span className="ai-status">{item.status}</span>
                    </article>
                  ))}
                </div>
              </ShellPanel>

              <div className="ops-grid">
                <ShellPanel
                  title="Reasoning / Trace preview"
                  subtitle="Mô phỏng vị trí hiển thị cho thought flow, search trace và raw AI outputs khi backend sẵn sàng."
                >
                  <div className="trace-list">
                    <div className="trace-item">
                      <strong>Prompt & model control</strong>
                      <div className="muted">Model hiện tại chưa được expose qua API admin. Khu vực này phù hợp cho `model`, `temperature` và version note.</div>
                    </div>
                    <div className="trace-item">
                      <strong>Reasoning log</strong>
                      <div className="muted">Chưa có luồng suy luận hoặc search steps được lưu. Có thể hiển thị agent checkpoints, nguồn tham khảo và post-processing ở đây.</div>
                    </div>
                    <div className="trace-item">
                      <strong>Trace log</strong>
                      <div className="muted">Kỳ vọng: prompt input, raw output, parse status, retry count, latency và token usage cho từng trip generation.</div>
                    </div>
                  </div>
                </ShellPanel>

                <ShellPanel
                  title="AI readiness snapshot"
                  subtitle="Những tín hiệu thật đang có và những khoảng trống backend cần lấp."
                >
                  <div className="trace-list">
                    <div className="trace-item">
                      <strong>API health</strong>
                      <div className="muted"><code>{formatNumber(derivedHealth.totalRequests)}</code> request tổng, <code>{formatNumber(derivedHealth.failedRequests)}</code> lỗi 5xx.</div>
                    </div>
                    <div className="trace-item">
                      <strong>Trip inventory</strong>
                      <div className="muted"><code>{formatNumber(stats.trips || 0)}</code> chuyến đi đã lưu, dùng làm nền cho quality review và hallucination reporting.</div>
                    </div>
                    <div className="trace-item">
                      <strong>Missing telemetry</strong>
                      <div className="muted">Token cost, AI latency, prompt revision, model switching, hallucination flags, raw completion logs.</div>
                    </div>
                  </div>
                </ShellPanel>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <ShellPanel title="User Operations" subtitle="Quản lý quyền, trạng thái và các thao tác hàng loạt cho tài khoản.">
              <div className="ctrl">
                <input placeholder="Tìm theo tên hoặc email" value={users.q} onChange={(e) => setUsers((prev) => ({ ...prev, q: e.target.value }))} />
                <select value={users.role} onChange={(e) => setUsers((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="">Tất cả vai trò</option>
                  <option value="admin">Quản trị viên</option>
                  <option value="user">Người dùng</option>
                </select>
                <select value={users.isActive} onChange={(e) => setUsers((prev) => ({ ...prev, isActive: e.target.value }))}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="true">Đang hoạt động</option>
                  <option value="false">Đã khóa</option>
                </select>
                <button className="btn btn-primary" type="button" onClick={() => loadUsers(0)}>Áp dụng</button>
                <button className="btn" type="button" onClick={() => bulkUserStatus(true)} disabled={!users.selected.length || actionBusy === 'users-bulk'}>Mở khóa hàng loạt</button>
                <button className="btn btn-warn" type="button" onClick={() => bulkUserStatus(false)} disabled={!users.selected.length || actionBusy === 'users-bulk'}>Khóa hàng loạt</button>
              </div>

              {users.loading ? <p className="muted">Đang tải người dùng...</p> : !users.items.length ? (
                <EmptyState title="Không có người dùng phù hợp" hint="Thử thay đổi bộ lọc hoặc tạo thêm dữ liệu." />
              ) : (
                <div className="table-shell">
                  <table className="t">
                    <thead>
                      <tr>
                        <th />
                        <th>ID</th>
                        <th>Tên</th>
                        <th>Email</th>
                        <th>Vai trò</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={users.selected.includes(item.id)}
                              onChange={(e) => setUsers((prev) => ({
                                ...prev,
                                selected: e.target.checked ? [...prev.selected, item.id] : prev.selected.filter((selectedId) => selectedId !== item.id),
                              }))}
                            />
                          </td>
                          <td>{item.id}</td>
                          <td>{item.name}</td>
                          <td>{item.email}</td>
                          <td><span className={`chip ${item.role}`}>{item.role}</span></td>
                          <td><span className={`chip ${item.is_active ? 'active' : 'locked'}`}>{item.is_active ? 'đang hoạt động' : 'đã khóa'}</span></td>
                          <td>{fmtDate(item.created_at)}</td>
                          <td>
                            <div className="ctrl" style={{ marginBottom: 0 }}>
                              <button className="btn" type="button" disabled={Boolean(actionBusy)} onClick={() => updateUser(item.id, { role: item.role === 'admin' ? 'user' : 'admin' })}>Đổi vai trò</button>
                              <button className="btn" type="button" disabled={Boolean(actionBusy)} onClick={() => updateUser(item.id, { is_active: !item.is_active })}>{item.is_active ? 'Khóa' : 'Mở khóa'}</button>
                              <button className="btn btn-warn" type="button" disabled={Boolean(actionBusy)} onClick={() => deleteUser(item.id, item.name)}>Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Pager offset={users.offset} total={users.total} onPrev={() => loadUsers(Math.max(0, users.offset - PAGE_SIZE))} onNext={() => loadUsers(users.offset + PAGE_SIZE)} />
            </ShellPanel>
          )}

          {tab === 'trips' && (
            <ShellPanel title="Trip Inventory" subtitle="Rà soát itinerary đã tạo, mở chi tiết và xóa khi cần.">
              <div className="ctrl">
                <input placeholder="Điểm đến, tên hoặc email người dùng" value={trips.q} onChange={(e) => setTrips((prev) => ({ ...prev, q: e.target.value }))} />
                <input placeholder="ID người dùng" value={trips.userId} onChange={(e) => setTrips((prev) => ({ ...prev, userId: e.target.value }))} />
                <button className="btn btn-primary" type="button" onClick={() => loadTrips(0)}>Áp dụng</button>
                <button className="btn btn-warn" type="button" onClick={bulkDeleteTrips} disabled={!trips.selected.length || actionBusy === 'trips-bulk-delete'}>Xóa hàng loạt</button>
              </div>

              {trips.loading ? <p className="muted">Đang tải chuyến đi...</p> : !trips.items.length ? (
                <EmptyState title="Không có chuyến đi phù hợp" hint="Thử thay đổi bộ lọc hoặc tạo thêm dữ liệu." />
              ) : (
                <div className="table-shell">
                  <table className="t">
                    <thead>
                      <tr>
                        <th />
                        <th>ID</th>
                        <th>Người dùng</th>
                        <th>Điểm đến</th>
                        <th>Số ngày</th>
                        <th>Ngân sách</th>
                        <th>Ngày tạo</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={trips.selected.includes(item.id)}
                              onChange={(e) => setTrips((prev) => ({
                                ...prev,
                                selected: e.target.checked ? [...prev.selected, item.id] : prev.selected.filter((selectedId) => selectedId !== item.id),
                              }))}
                            />
                          </td>
                          <td>{item.id}</td>
                          <td>
                            <strong>{item.user_name || `User #${item.user_id}`}</strong>
                            <div className="muted">{item.user_email || `ID: ${item.user_id}`}</div>
                          </td>
                          <td>{item.destination}</td>
                          <td>{item.days}</td>
                          <td>{item.budget}</td>
                          <td>{fmtDate(item.created_at)}</td>
                          <td>
                            <div className="ctrl" style={{ marginBottom: 0 }}>
                              <button className="btn" type="button" onClick={() => openTripDetail(item.id)} disabled={loadingTripDetail}>Xem chi tiết</button>
                              <button className="btn btn-warn" type="button" disabled={Boolean(actionBusy)} onClick={() => deleteTrip(item.id, item.destination)}>Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Pager offset={trips.offset} total={trips.total} onPrev={() => loadTrips(Math.max(0, trips.offset - PAGE_SIZE))} onNext={() => loadTrips(trips.offset + PAGE_SIZE)} />
            </ShellPanel>
          )}

          {tab === 'catalog' && (
            <div className="dashboard-grid">
              <ShellPanel title="Catalog Operations" subtitle="Quản lý nguồn dữ liệu mà AI dùng để gợi ý lịch trình và hiển thị điểm đến.">
                <div className="ctrl">
                  <select
                    value={entity}
                    onChange={(e) => {
                      const next = e.target.value
                      setEntity(next)
                      setCatalog((prev) => ({
                        ...prev,
                        offset: 0,
                        q: '',
                        destinationId: '',
                        category: '',
                        form: { ...CATALOG[next].defaults },
                      }))
                      setEditingCatalogId(null)
                    }}
                  >
                    {Object.entries(CATALOG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
                  </select>
                  <input placeholder={`Tìm ${currentCatalogConfig.label.toLowerCase()} theo tên`} value={catalog.q} onChange={(e) => setCatalog((prev) => ({ ...prev, q: e.target.value }))} />
                  {(entity === 'hotels' || entity === 'activities') && (
                    <select value={catalog.destinationId} onChange={(e) => setCatalog((prev) => ({ ...prev, destinationId: e.target.value }))}>
                      <option value="">Tất cả điểm đến</option>
                      {destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  )}
                  {entity === 'activities' && (
                    <select value={catalog.category} onChange={(e) => setCatalog((prev) => ({ ...prev, category: e.target.value }))}>
                      <option value="">Tất cả danh mục</option>
                      {activityCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  )}
                  <button className="btn btn-primary" type="button" onClick={() => loadCatalog(0)}>Tìm kiếm</button>
                </div>
              </ShellPanel>

              <CatalogForm
                config={currentCatalogConfig}
                form={catalog.form}
                editing={Boolean(editingCatalogId)}
                destinations={destinations}
                submitting={catalogSubmitting}
                onChange={(key, value) => setCatalog((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))}
                onSubmit={submitCatalog}
                onCancel={() => resetCatalogForm()}
              />

              <ShellPanel title={`${currentCatalogConfig.label} hiện có`} subtitle="Giữ nguyên CRUD hiện có, chỉ đổi cách trình bày theo admin shell mới.">
                {catalog.loading ? <p className="muted">Đang tải danh mục...</p> : !catalog.items.length ? (
                  <EmptyState title={`Không có ${currentCatalogConfig.label.toLowerCase()} phù hợp`} hint="Thử thay đổi bộ lọc hoặc tạo mới bản ghi." />
                ) : (
                  <div className="table-shell">
                    <table className="t">
                      <thead>
                        <tr>
                          {currentCatalogConfig.cols.map((column) => <th key={column}>{column}</th>)}
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalog.items.map((row) => (
                          <tr key={row.id}>
                            {currentCatalogConfig.cols.map((column) => <td key={`${row.id}-${column}`}>{String(row[column] ?? '')}</td>)}
                            <td>
                              <div className="ctrl" style={{ marginBottom: 0 }}>
                                <button className="btn" type="button" onClick={() => startEditCatalog(row)} disabled={catalogSubmitting}>Sửa</button>
                                <button className="btn btn-warn" type="button" onClick={() => deleteCatalog(row)} disabled={Boolean(actionBusy)}>Xóa</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pager offset={catalog.offset} total={catalog.total} onPrev={() => loadCatalog(Math.max(0, catalog.offset - PAGE_SIZE))} onNext={() => loadCatalog(catalog.offset + PAGE_SIZE)} />
              </ShellPanel>
            </div>
          )}

          {tab === 'audit' && (
            <ShellPanel title="Audit Log" subtitle="Nhật ký hành động admin hiện có. Có thể mở rộng thành AI trace log khi backend bổ sung dữ liệu.">
              <div className="ctrl">
                <input placeholder="Tìm trong chi tiết log" value={audit.q} onChange={(e) => setAudit((prev) => ({ ...prev, q: e.target.value }))} />
                <select value={audit.action} onChange={(e) => setAudit((prev) => ({ ...prev, action: e.target.value }))}>
                  {AUDIT_ACTION_OPTIONS.map((item) => (
                    <option key={item || 'all'} value={item}>{item || 'Tất cả hành động'}</option>
                  ))}
                </select>
                <button className="btn btn-primary" type="button" onClick={() => loadAudit(0)}>Tìm kiếm</button>
              </div>

              {audit.loading ? <p className="muted">Đang tải nhật ký hệ thống...</p> : !audit.items.length ? (
                <EmptyState title="Không có log phù hợp" hint="Thử đổi từ khóa hoặc bộ lọc hành động." />
              ) : (
                <div className="table-shell">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Người thao tác</th>
                        <th>Hành động</th>
                        <th>Đối tượng</th>
                        <th>Chi tiết</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.items.map((log) => (
                        <tr key={log.id}>
                          <td>{log.id}</td>
                          <td>{log.actor_user_id}</td>
                          <td>{log.action}</td>
                          <td>{log.target_type}:{log.target_id || '-'}</td>
                          <td className="audit-detail">{JSON.stringify(log.detail || {}, null, 2)}</td>
                          <td>{fmtDate(log.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Pager offset={audit.offset} total={audit.total} onPrev={() => loadAudit(Math.max(0, audit.offset - PAGE_SIZE))} onNext={() => loadAudit(audit.offset + PAGE_SIZE)} />
            </ShellPanel>
          )}

          {tab === 'tools' && (
            <div className="dashboard-grid">
              <ShellPanel title="Export / backup" subtitle="Tải dữ liệu vận hành ra ngoài để backup hoặc xử lý offline.">
                <div className="ctrl">
                  {['users', 'trips', 'destinations', 'hotels', 'activities', 'audit_logs'].map((item) => (
                    <button key={item} className="btn" type="button" disabled={Boolean(actionBusy)} onClick={() => download(`/admin/tools/export/${item}.csv`, `${item}.csv`)}>
                      Xuất {item}.csv
                    </button>
                  ))}
                </div>
                <div className="ctrl">
                  <button className="btn btn-primary" type="button" disabled={Boolean(actionBusy)} onClick={() => download('/admin/tools/backup/sqlite', 'travel_planner.db')}>
                    Tải file backup
                  </button>
                </div>
              </ShellPanel>

              <ShellPanel title="Import catalog data" subtitle="Nạp lại dữ liệu gốc cho destinations, hotels và activities.">
                {['destinations', 'hotels', 'activities'].map((item) => (
                  <div className="ctrl" key={item}>
                    <label style={{ minWidth: 130, fontWeight: 700 }}>{item}.csv</label>
                    <input type="file" accept=".csv,text/csv" disabled={Boolean(importing)} onChange={(e) => importCsv(item, e.target.files?.[0])} />
                    {importing === item && <span className="muted">Đang nhập...</span>}
                  </div>
                ))}
              </ShellPanel>
            </div>
          )}
        </main>
      </div>

      {tripDetail && (
        <Modal title={`Chi tiết chuyến đi #${tripDetail.id}`} onClose={() => setTripDetail(null)}>
          <div className="detail-grid">
            <DetailRow label="Người dùng" value={tripDetail.user_name || tripDetail.user_email || tripDetail.user_id} />
            <DetailRow label="Điểm đến" value={tripDetail.destination} />
            <DetailRow label="Số ngày" value={String(tripDetail.days || '-')} />
            <DetailRow label="Ngân sách" value={tripDetail.budget} />
            <DetailRow label="Travel style" value={tripDetail.travel_style} />
            <DetailRow label="Số người" value={String(tripDetail.people || '-')} />
            <DetailRow label="Ngày tạo" value={fmtDate(tripDetail.created_at)} />
          </div>

          {tripDetail.trip_summary && (
            <ShellPanel title="Tóm tắt AI" subtitle="Snapshot dữ liệu AI trả về đã lưu cùng itinerary." className="panel-soft">
              <div className="detail-grid">
                <DetailRow label="Best time" value={tripDetail.trip_summary.best_time} />
                <DetailRow label="Estimated cost" value={tripDetail.trip_summary.estimated_cost} />
                <DetailRow label="Weather note" value={tripDetail.trip_summary.weather_note} />
                <DetailRow label="Destination" value={tripDetail.trip_summary.destination} />
              </div>
            </ShellPanel>
          )}

          <ShellPanel title="Lịch trình từng ngày" subtitle="Dùng để kiểm tra đầu ra itinerary mà AI đã ghi vào hệ thống." className="panel-soft">
            {!tripDetail.itinerary_days?.length ? <EmptyState title="Chưa có lịch trình chi tiết" /> : tripDetail.itinerary_days.map((day) => (
              <div key={`day-${day.day}`} className="trip-day">
                <h4>Ngày {day.day}: {day.title || tripDetail.destination}</h4>
                {day.weather && <div className="muted">{day.weather}</div>}
                {(day.schedule || []).map((item, index) => (
                  <div key={`schedule-${day.day}-${index}`} className="schedule-item">
                    <strong>{item.time || '--:--'} • {item.place || 'Đang cập nhật'}</strong>
                    <div className="muted">{item.period || ''}{item.address ? ` • ${item.address}` : ''}</div>
                    {item.description && <div>{item.description}</div>}
                  </div>
                ))}
              </div>
            ))}
          </ShellPanel>

          <ShellPanel title="Dữ liệu itinerary thô" subtitle="Khung phù hợp cho trace/debug khi cần soi đầu ra JSON hoặc điều tra lỗi parse." className="panel-soft">
            <pre className="detail-code">{JSON.stringify(tripDetail.itinerary || {}, null, 2)}</pre>
          </ShellPanel>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
