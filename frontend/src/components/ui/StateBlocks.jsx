export function LoadingState({ message = 'Đang tải dữ liệu...' }) {
  return (
    <div
      style={{
        background: 'var(--surface-panel)',
        borderRadius: 16,
        border: '1px solid var(--border-soft)',
        padding: '36px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}
    >
      <span style={{ fontSize: 24, display: 'inline-block', marginBottom: 8 }}>⚙️</span>
      <div>{message}</div>
    </div>
  )
}

export function EmptyState({ icon = '✈️', message, accentText }) {
  return (
    <div
      style={{
        background: 'var(--surface-panel)',
        borderRadius: 16,
        border: '1.5px dashed #c7d2fe',
        padding: '36px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
        {message}
        {accentText ? <strong style={{ color: 'var(--accent-indigo)' }}>{accentText}</strong> : null}
      </p>
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div
      style={{
        background: '#fff5f5',
        border: '1px solid #fee2e2',
        borderRadius: 10,
        padding: '10px 14px',
        color: '#ef4444',
        fontSize: 13,
      }}
    >
      ⚠️ {message}
    </div>
  )
}
