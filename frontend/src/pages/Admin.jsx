import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 10
const TABS = ['overview', 'users', 'trips', 'catalog', 'audit', 'tools']
const TAB_LABELS = {
  overview: 'Tổng quan',
  users: 'Người dùng',
  trips: 'Chuyến đi',
  catalog: 'Danh mục',
  audit: 'Audit Log',
  tools: 'Dữ liệu',
}

const ACTIVITY_CATEGORIES = ['attraction', 'restaurant', 'cafe']

const OVERVIEW_KPI = [
  { key: 'users', label: 'Người dùng' },
  { key: 'active_users', label: 'Đang hoạt động' },
  { key: 'locked_users', label: 'Đã khóa' },
  { key: 'admins', label: 'Admin' },
  { key: 'trips', label: 'Chuyến đi' },
  { key: 'destinations', label: 'Điểm đến' },
  { key: 'hotels', label: 'Khách sạn' },
  { key: 'activities', label: 'Hoạt động' },
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
    <div className="card subtle">
      <div className="section-head">
        <h3>{editing ? `Cập nhật ${config.label.toLowerCase()}` : `Tạo ${config.label.toLowerCase()} mới`}</h3>
      </div>
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
        <button className="btn dark" type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mới'}
        </button>
        {editing && <button className="btn" type="button" onClick={onCancel} disabled={submitting}>Hủy</button>}
      </div>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
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

  const activityCategories = useMemo(() => {
    const fromItems = catalog.items.map((item) => item.category).filter(Boolean)
    return Array.from(new Set([...ACTIVITY_CATEGORIES, ...fromItems]))
  }, [catalog.items])

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
  }, [pushToast, users.isActive, users.q, users.role])

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
  }, [pushToast, trips.q, trips.userId])

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
  }, [catalog.category, catalog.destinationId, catalog.q, currentCatalogConfig.path, entity, pushToast])

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
  }, [audit.action, audit.q, pushToast])

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
    <div className="admin-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:wght@500;600&display=swap');
        .admin-shell { min-height: 100vh; background: #f8fafc; color: #0f172a; font-family: 'DM Sans', sans-serif; padding: 24px 16px 40px; }
        .wrap { max-width: 1260px; margin: 0 auto; }
        .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .head-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .title { margin: 0; font: 600 32px 'Fraunces', serif; }
        .sub { margin: 6px 0 0; color: #64748b; font-size: 14px; }
        .admin-meta { color: #475569; font-size: 13px; font-weight: 700; }
        .tabs { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
        .tab { border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; padding: 8px 12px; font-weight: 700; cursor: pointer; }
        .tab.on { background: #0f172a; border-color: #0f172a; color: #fff; }
        .card { margin-top: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); }
        .card.subtle { background: #f8fafc; box-shadow: none; }
        .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .section-head h3 { margin: 0; font-size: 16px; }
        .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        .two-col { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; }
        .three-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .kpi { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 12px; }
        .kpi-label { margin: 0; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .kpi-value { margin: 6px 0 0; font-size: 24px; font-weight: 700; }
        .list { display: grid; gap: 8px; }
        .list-item { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 10px 12px; }
        .list-item strong { display: block; margin-bottom: 4px; }
        .muted { color: #64748b; font-size: 13px; }
        .alert { border: 1px solid #fde68a; background: #fffbeb; color: #92400e; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
        .ctrl { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .ctrl input, .ctrl select, .field input, .field select { border: 1px solid #cbd5e1; border-radius: 9px; padding: 8px 10px; font-size: 13px; background: #fff; min-width: 0; }
        .btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 9px; padding: 8px 11px; font-weight: 700; cursor: pointer; }
        .btn.dark { background: #0f172a; border-color: #0f172a; color: #fff; }
        .btn.warn { background: #fff1f2; border-color: #fda4af; color: #b91c1c; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        a.btn { text-decoration: none; display: inline-flex; align-items: center; }
        .t { width: 100%; border-collapse: collapse; font-size: 13px; }
        .t th, .t td { border-bottom: 1px solid #f1f5f9; padding: 10px 8px; text-align: left; vertical-align: top; }
        .t th { font-size: 11px; text-transform: uppercase; color: #64748b; }
        .chip { display: inline-flex; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; }
        .chip.admin { background: #ede9fe; color: #5b21b6; }
        .chip.user { background: #e0f2fe; color: #0369a1; }
        .chip.active { background: #dcfce7; color: #166534; }
        .chip.locked { background: #fee2e2; color: #991b1b; }
        .pager { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
        .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
        .field { display: grid; gap: 6px; font-size: 12px; font-weight: 700; color: #475569; }
        .field-wide { grid-column: span 3; }
        .empty-state { display: grid; gap: 4px; place-items: center; text-align: center; padding: 28px 12px; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; }
        .toast { position: fixed; right: 16px; bottom: 16px; background: #111827; color: #fff; padding: 10px 12px; border-radius: 10px; font-weight: 700; font-size: 13px; max-width: 360px; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
        .modal { width: min(980px, 100%); max-height: 88vh; overflow: auto; background: #fff; border-radius: 14px; padding: 16px; box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28); }
        .detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .detail-row { display: grid; gap: 6px; padding: 10px 12px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .detail-row span { font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; }
        .trip-day { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc; margin-bottom: 10px; }
        .trip-day h4 { margin: 0 0 8px; font-size: 15px; }
        .schedule-item { border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
        .detail-code { background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12px; overflow: auto; white-space: pre-wrap; }
        .audit-detail { max-width: 320px; white-space: pre-wrap; word-break: break-word; color: #334155; }
        @media (max-width: 1100px) {
          .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .two-col, .three-col, .form-grid, .detail-grid { grid-template-columns: 1fr 1fr; }
          .field-wide { grid-column: span 2; }
        }
        @media (max-width: 760px) {
          .grid, .two-col, .three-col, .form-grid, .detail-grid { grid-template-columns: 1fr; }
          .field-wide { grid-column: span 1; }
        }
      `}</style>

      <div className="wrap">
        <div className="head">
          <div>
            <h1 className="title">Trang Quản Trị</h1>
            <p className="sub">Theo dõi người dùng, chuyến đi, danh mục và dữ liệu hệ thống.</p>
          </div>
          <div className="head-actions">
            <span className="admin-meta">{user?.name || 'Admin'}{user?.email ? ` • ${user.email}` : ''}</span>
            <Link to="/dashboard" className="btn">Về dashboard</Link>
            <button className="btn" type="button" onClick={loadOverview} disabled={loadingOverview}>Làm mới dữ liệu</button>
            <button className="btn warn" type="button" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((item) => (
            <button key={item} type="button" className={`tab ${tab === item ? 'on' : ''}`} onClick={() => setTab(item)}>
              {TAB_LABELS[item] || item}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="card">
            {loadingOverview ? <p>Đang tải dữ liệu tổng quan...</p> : (
              <>
                <div className="grid">
                  {OVERVIEW_KPI.map((item) => (
                    <div key={item.key} className="kpi">
                      <p className="kpi-label">{item.label}</p>
                      <p className="kpi-value">{stats[item.key] ?? 0}</p>
                    </div>
                  ))}
                </div>

                <div className="three-col" style={{ marginTop: 14 }}>
                  <div className="card subtle">
                    <div className="section-head"><h3>Cảnh báo hệ thống</h3></div>
                    {alerts.length === 0 ? <EmptyState title="Không có cảnh báo" hint="Hệ thống hiện không ghi nhận vấn đề nổi bật." /> : alerts.map((item) => (
                      <div key={`${item.code}-${item.message}`} className="alert">
                        <strong>{item.code}</strong>
                        <div>{item.message}</div>
                      </div>
                    ))}
                  </div>

                  <div className="card subtle">
                    <div className="section-head"><h3>Điểm đến có nhiều chuyến đi</h3></div>
                    {topDestinations.length === 0 ? <EmptyState title="Chưa có dữ liệu" hint="Hãy tạo thêm chuyến đi để thấy thống kê này." /> : (
                      <div className="list">
                        {topDestinations.map((item) => (
                          <div key={item.destination} className="list-item">
                            <strong>{item.destination}</strong>
                            <div className="muted">{item.trip_count} chuyến đi</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card subtle">
                    <div className="section-head"><h3>API & admin hiện tại</h3></div>
                    <div className="list">
                      <div className="list-item">
                        <strong>{overview?.current_admin?.name || '-'}</strong>
                        <div className="muted">{overview?.current_admin?.email || '-'}</div>
                      </div>
                      <div className="list-item">
                        <strong>{overview?.api_health?.total_requests || 0} request</strong>
                        <div className="muted">{overview?.api_health?.failed_requests || 0} lỗi 5xx</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="two-col" style={{ marginTop: 14 }}>
                  <div className="card subtle">
                    <div className="section-head"><h3>Người dùng mới</h3></div>
                    {recentUsers.length === 0 ? <EmptyState title="Chưa có người dùng mới" /> : (
                      <div className="list">
                        {recentUsers.map((item) => (
                          <div key={item.id} className="list-item">
                            <strong>{item.name}</strong>
                            <div className="muted">{item.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card subtle">
                    <div className="section-head"><h3>Chuyến đi gần đây</h3></div>
                    {recentTrips.length === 0 ? <EmptyState title="Chưa có chuyến đi" /> : (
                      <div className="list">
                        {recentTrips.map((item) => (
                          <div key={item.id} className="list-item">
                            <strong>{item.destination}</strong>
                            <div className="muted">{item.user_name || `User #${item.user_id}`} • {item.days} ngày • {fmtDate(item.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="card">
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
              <button className="btn dark" type="button" onClick={() => loadUsers(0)}>Áp dụng</button>
              <button className="btn" type="button" onClick={() => bulkUserStatus(true)} disabled={!users.selected.length || actionBusy === 'users-bulk'}>Mở khóa hàng loạt</button>
              <button className="btn warn" type="button" onClick={() => bulkUserStatus(false)} disabled={!users.selected.length || actionBusy === 'users-bulk'}>Khóa hàng loạt</button>
            </div>

            {users.loading ? <p>Đang tải người dùng...</p> : !users.items.length ? (
              <EmptyState title="Không có người dùng phù hợp" hint="Thử thay đổi bộ lọc hoặc tạo thêm dữ liệu." />
            ) : (
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
                  {users.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={users.selected.includes(user.id)}
                          onChange={(e) => setUsers((prev) => ({
                            ...prev,
                            selected: e.target.checked ? [...prev.selected, user.id] : prev.selected.filter((item) => item !== user.id),
                          }))}
                        />
                      </td>
                      <td>{user.id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td><span className={`chip ${user.role}`}>{user.role}</span></td>
                      <td><span className={`chip ${user.is_active ? 'active' : 'locked'}`}>{user.is_active ? 'đang hoạt động' : 'đã khóa'}</span></td>
                      <td>{fmtDate(user.created_at)}</td>
                      <td>
                        <div className="ctrl" style={{ marginBottom: 0 }}>
                          <button className="btn" type="button" disabled={Boolean(actionBusy)} onClick={() => updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' })}>Đổi vai trò</button>
                          <button className="btn" type="button" disabled={Boolean(actionBusy)} onClick={() => updateUser(user.id, { is_active: !user.is_active })}>{user.is_active ? 'Khóa' : 'Mở khóa'}</button>
                          <button className="btn warn" type="button" disabled={Boolean(actionBusy)} onClick={() => deleteUser(user.id, user.name)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Pager offset={users.offset} total={users.total} onPrev={() => loadUsers(Math.max(0, users.offset - PAGE_SIZE))} onNext={() => loadUsers(users.offset + PAGE_SIZE)} />
          </div>
        )}

        {tab === 'trips' && (
          <div className="card">
            <div className="ctrl">
              <input placeholder="Điểm đến, tên hoặc email người dùng" value={trips.q} onChange={(e) => setTrips((prev) => ({ ...prev, q: e.target.value }))} />
              <input placeholder="ID người dùng" value={trips.userId} onChange={(e) => setTrips((prev) => ({ ...prev, userId: e.target.value }))} />
              <button className="btn dark" type="button" onClick={() => loadTrips(0)}>Áp dụng</button>
              <button className="btn warn" type="button" onClick={bulkDeleteTrips} disabled={!trips.selected.length || actionBusy === 'trips-bulk-delete'}>Xóa hàng loạt</button>
            </div>

            {trips.loading ? <p>Đang tải chuyến đi...</p> : !trips.items.length ? (
              <EmptyState title="Không có chuyến đi phù hợp" hint="Thử thay đổi bộ lọc hoặc tạo thêm dữ liệu." />
            ) : (
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
                  {trips.items.map((trip) => (
                    <tr key={trip.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={trips.selected.includes(trip.id)}
                          onChange={(e) => setTrips((prev) => ({
                            ...prev,
                            selected: e.target.checked ? [...prev.selected, trip.id] : prev.selected.filter((item) => item !== trip.id),
                          }))}
                        />
                      </td>
                      <td>{trip.id}</td>
                      <td>
                        <strong>{trip.user_name || `User #${trip.user_id}`}</strong>
                        <div className="muted">{trip.user_email || `ID: ${trip.user_id}`}</div>
                      </td>
                      <td>{trip.destination}</td>
                      <td>{trip.days}</td>
                      <td>{trip.budget}</td>
                      <td>{fmtDate(trip.created_at)}</td>
                      <td>
                        <div className="ctrl" style={{ marginBottom: 0 }}>
                          <button className="btn" type="button" onClick={() => openTripDetail(trip.id)} disabled={loadingTripDetail}>Xem chi tiết</button>
                          <button className="btn warn" type="button" disabled={Boolean(actionBusy)} onClick={() => deleteTrip(trip.id, trip.destination)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Pager offset={trips.offset} total={trips.total} onPrev={() => loadTrips(Math.max(0, trips.offset - PAGE_SIZE))} onNext={() => loadTrips(trips.offset + PAGE_SIZE)} />
          </div>
        )}

        {tab === 'catalog' && (
          <div className="card">
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
              <button className="btn dark" type="button" onClick={() => loadCatalog(0)}>Tìm kiếm</button>
            </div>

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

            {catalog.loading ? <p>Đang tải danh mục...</p> : !catalog.items.length ? (
              <EmptyState title={`Không có ${currentCatalogConfig.label.toLowerCase()} phù hợp`} hint="Thử thay đổi bộ lọc hoặc tạo mới bản ghi." />
            ) : (
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
                          <button className="btn warn" type="button" onClick={() => deleteCatalog(row)} disabled={Boolean(actionBusy)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Pager offset={catalog.offset} total={catalog.total} onPrev={() => loadCatalog(Math.max(0, catalog.offset - PAGE_SIZE))} onNext={() => loadCatalog(catalog.offset + PAGE_SIZE)} />
          </div>
        )}

        {tab === 'audit' && (
          <div className="card">
            <div className="ctrl">
              <input placeholder="Tìm trong chi tiết log" value={audit.q} onChange={(e) => setAudit((prev) => ({ ...prev, q: e.target.value }))} />
              <select value={audit.action} onChange={(e) => setAudit((prev) => ({ ...prev, action: e.target.value }))}>
                {AUDIT_ACTION_OPTIONS.map((item) => (
                  <option key={item || 'all'} value={item}>{item || 'Tất cả hành động'}</option>
                ))}
              </select>
              <button className="btn dark" type="button" onClick={() => loadAudit(0)}>Tìm kiếm</button>
            </div>

            {audit.loading ? <p>Đang tải nhật ký hệ thống...</p> : !audit.items.length ? (
              <EmptyState title="Không có log phù hợp" hint="Thử đổi từ khóa hoặc bộ lọc hành động." />
            ) : (
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
            )}

            <Pager offset={audit.offset} total={audit.total} onPrev={() => loadAudit(Math.max(0, audit.offset - PAGE_SIZE))} onNext={() => loadAudit(audit.offset + PAGE_SIZE)} />
          </div>
        )}

        {tab === 'tools' && (
          <div className="card">
            <div className="section-head"><h3>Export CSV</h3></div>
            <div className="ctrl">
              {['users', 'trips', 'destinations', 'hotels', 'activities', 'audit_logs'].map((item) => (
                <button key={item} className="btn" type="button" disabled={Boolean(actionBusy)} onClick={() => download(`/admin/tools/export/${item}.csv`, `${item}.csv`)}>
                  Xuất {item}.csv
                </button>
              ))}
            </div>

            <div className="section-head"><h3>Backup SQLite</h3></div>
            <div className="ctrl">
              <button className="btn dark" type="button" disabled={Boolean(actionBusy)} onClick={() => download('/admin/tools/backup/sqlite', 'travel_planner.db')}>
                Tải file backup
              </button>
            </div>

            <div className="section-head"><h3>Import CSV</h3></div>
            {['destinations', 'hotels', 'activities'].map((item) => (
              <div className="ctrl" key={item}>
                <label style={{ minWidth: 130, fontWeight: 700 }}>{item}.csv</label>
                <input type="file" accept=".csv,text/csv" disabled={Boolean(importing)} onChange={(e) => importCsv(item, e.target.files?.[0])} />
                {importing === item && <span className="muted">Đang nhập...</span>}
              </div>
            ))}
          </div>
        )}
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
            <div className="card subtle">
              <div className="section-head"><h3>Tóm tắt AI</h3></div>
              <div className="detail-grid">
                <DetailRow label="Best time" value={tripDetail.trip_summary.best_time} />
                <DetailRow label="Estimated cost" value={tripDetail.trip_summary.estimated_cost} />
                <DetailRow label="Weather note" value={tripDetail.trip_summary.weather_note} />
                <DetailRow label="Destination" value={tripDetail.trip_summary.destination} />
              </div>
            </div>
          )}

          <div className="card subtle">
            <div className="section-head"><h3>Lịch trình từng ngày</h3></div>
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
          </div>

          <div className="card subtle">
            <div className="section-head"><h3>Dữ liệu itinerary thô</h3></div>
            <pre className="detail-code">{JSON.stringify(tripDetail.itinerary || {}, null, 2)}</pre>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
