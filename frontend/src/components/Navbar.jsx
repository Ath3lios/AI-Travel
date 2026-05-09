import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(false)
  const menuRef = useRef(null)

  const isAdmin = user?.role === 'admin'
  const accountHomePath = isAdmin ? '/admin' : '/dashboard'
  const accountHomeLabel = isAdmin ? 'Dashboard admin' : 'Chuyến đi của tôi'

  const handleLogout = () => {
    setOpenMenu(false)
    logout()
    navigate('/')
  }

  const scrollToSection = (e, id) => {
    e.preventDefault()
    if (location.pathname !== '/') {
      navigate(`/#${id}`)
      return
    }

    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpenMenu(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    if (location.hash) {
      window.setTimeout(() => {
        const id = location.hash.replace('#', '')
        const element = document.getElementById(id)
        if (element) element.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [location.hash])

  return (
    <>
      <style>{`
        .nav-shell {
          position: sticky;
          top: 0;
          z-index: 40;
          backdrop-filter: blur(10px);
          background: var(--nav-bg);
          border-bottom: 1px solid var(--nav-border);
          box-shadow: var(--nav-shadow);
        }

        .nav-inner {
          max-width: none;
          width: 100%;
          margin: 0 auto;
          min-height: 64px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .nav-brand {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          transition: transform 0.2s ease;
        }

        .nav-brand:hover {
          transform: scale(1.02);
        }

        .nav-logo-img {
          height: 36px;
          width: auto;
          display: block;
          object-fit: contain;
          transition: all 0.3s ease;
          filter: ${isDark ? 'invert(1) hue-rotate(180deg) brightness(1.5) contrast(1.2)' : 'none'};
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          justify-content: flex-end;
        }

        .nav-link, .nav-ghost, .nav-solid {
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          border-radius: 10px;
          padding: 9px 14px;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        .nav-link { color: var(--text-soft); }
        .nav-link:hover { background: var(--nav-link-hover); color: var(--text-strong); }

        .nav-user {
          font-size: 13px;
          color: var(--text-muted);
          padding: 0 4px;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-ghost {
          color: var(--text-strong);
          border-color: var(--button-ghost-border);
          background: var(--button-ghost-bg);
        }

        .nav-solid {
          color: ${isDark ? '#09111d' : '#ffffff'};
          background: var(--button-solid-bg);
          border-color: var(--button-solid-bg);
        }

        .theme-toggle-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid var(--button-ghost-border);
          background: var(--button-ghost-bg);
          color: var(--text-strong);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .nav-avatar-btn {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid #dbe3ee;
          background: linear-gradient(135deg, var(--brand-primary), var(--accent-indigo));
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .nav-menu-popover {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 190px;
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          padding: 10px;
          z-index: 50;
        }

        .nav-menu-link {
          display: block;
          padding: 9px 12px;
          color: var(--text-soft);
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          border-radius: 10px;
          border: 1px solid var(--border-soft);
          background: var(--surface-muted);
        }

        .nav-menu-link:hover {
          background: var(--nav-link-hover);
          color: var(--text-strong);
        }

        .nav-menu-logout {
          width: 100%;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #b91c1c;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
        }

        @media (max-width: 720px) {
          .nav-inner { min-height: 56px; padding: 8px 12px; }
          .nav-logo-img { height: 32px; }
          .nav-scroll-link { display: none; }
        }
      `}</style>

      <nav className="nav-shell">
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <img src="/logo_navbar.png" alt="AI Travel Logo" className="nav-logo-img" />
          </Link>

          <div className="nav-links">
            <a onClick={(e) => scrollToSection(e, 'how-it-works')} href="/#how-it-works" className="nav-link nav-scroll-link">Hướng dẫn</a>
            <a onClick={(e) => scrollToSection(e, 'comparison')} href="/#comparison" className="nav-link nav-scroll-link">Ưu điểm</a>
            <a onClick={(e) => scrollToSection(e, 'faq')} href="/#faq" className="nav-link nav-scroll-link">Hỏi đáp</a>

            <div style={{ width: 1, height: 24, background: 'var(--border-soft)', margin: '0 4px' }} className="nav-scroll-link" />

            <button type="button" className="theme-toggle-btn" onClick={toggleTheme}>
              {isDark ? '☀️' : '🌙'}
            </button>

            {user ? (
              <>
                <span className="nav-user">Xin chào, {user.name}</span>
                <div className="nav-user-menu" ref={menuRef}>
                  <button onClick={() => setOpenMenu((prev) => !prev)} className="nav-avatar-btn" type="button">
                    {user.name?.trim()?.[0] || 'U'}
                  </button>
                  {openMenu && (
                    <div className="nav-menu-popover">
                      <Link to={accountHomePath} className="nav-menu-link" style={{ textDecoration: 'none' }} onClick={() => setOpenMenu(false)}>
                        {accountHomeLabel}
                      </Link>
                      <button onClick={handleLogout} className="nav-menu-logout" type="button">Đăng xuất</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-ghost">Đăng nhập</Link>
                <Link to="/register" className="nav-solid">Đăng ký</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
