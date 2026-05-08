import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(false)
  const menuRef = useRef(null)

  const handleLogout = () => {
    setOpenMenu(false)
    logout()
    navigate('/')
  }

  // Hàm xử lý cuộn mượt mà đến các section
  const scrollToSection = (e, id) => {
    e.preventDefault()
    if (location.pathname !== '/') {
      navigate(`/#${id}`)
    } else {
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
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
    
    // Xử lý cuộn nếu truy cập từ trang khác có mang theo hash (vd: /#faq)
    if (location.hash) {
      setTimeout(() => {
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
          gap: 8px;
          text-decoration: none;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-strong);
          letter-spacing: -0.3px;
        }

        .nav-brand .brand-icon {
          font-size: 18px;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          justify-content: flex-end;
        }

        .nav-link,
        .nav-ghost,
        .nav-solid {
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          border-radius: 10px;
          padding: 9px 14px;
          border: 1px solid transparent;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .nav-link {
          color: var(--text-soft);
        }

        .nav-link:hover {
          background: var(--nav-link-hover);
          color: var(--text-strong);
        }

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

        .nav-ghost:hover {
          background: var(--nav-link-hover);
          border-color: var(--border-strong);
        }

        .nav-solid {
          color: ${isDark ? '#09111d' : '#ffffff'};
          background: var(--button-solid-bg);
          border-color: var(--button-solid-bg);
        }

        .nav-solid:hover {
          background: var(--button-solid-hover);
          border-color: var(--button-solid-hover);
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

        .theme-toggle-btn:hover {
          background: var(--nav-link-hover);
          border-color: var(--border-strong);
        }

        .nav-user-menu {
          position: relative;
          margin-left: 4px;
        }

        .nav-avatar-btn {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid #dbe3ee;
          background: linear-gradient(135deg, var(--brand-primary), var(--accent-indigo));
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
        }

        .nav-avatar-btn:hover {
          filter: brightness(0.96);
        }

        .nav-menu-popover {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 190px;
          background: var(--surface-panel);
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          box-shadow: var(--shadow-soft);
          padding: 10px;
          z-index: 50;
        }

        .nav-menu-name {
          font-size: 13px;
          color: var(--text-strong);
          font-weight: 600;
          margin: 0 0 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-soft);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-menu-link {
          display: block;
          text-decoration: none;
          color: var(--text-soft);
          background: var(--surface-muted);
          border: 1px solid var(--border-soft);
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
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
          text-align: left;
        }

        .nav-menu-logout:hover {
          background: #ffe4e6;
        }

        @media (max-width: 900px) {
          .nav-user { display: none; }
          .nav-scroll-link { display: none; } /* Ẩn bớt link cuộn trên mobile */
        }

        @media (max-width: 720px) {
          .nav-inner {
            min-height: 56px;
            padding: 8px 12px;
            flex-direction: row;
            align-items: center;
          }

          .nav-links {
            gap: 6px;
            justify-content: flex-end;
          }

          .nav-brand { font-size: 17px; }

          .nav-link,
          .nav-ghost,
          .nav-solid {
            font-size: 13px;
            padding: 7px 10px;
            border-radius: 9px;
          }

          .theme-toggle-btn {
            width: 36px;
            height: 36px;
            border-radius: 10px;
          }

          .nav-avatar-btn {
            width: 34px;
            height: 34px;
            font-size: 13px;
          }
        }
      `}</style>

      <nav className="nav-shell">
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <span className="brand-icon">✈️</span>
            <span>AI Travel</span>
          </Link>

          <div className="nav-links">
            <a onClick={(e) => scrollToSection(e, 'how-it-works')} href="/#how-it-works" className="nav-link nav-scroll-link">Cách hoạt động</a>
            <a onClick={(e) => scrollToSection(e, 'comparison')} href="/#comparison" className="nav-link nav-scroll-link">Ưu điểm</a>
            <a onClick={(e) => scrollToSection(e, 'faq')} href="/#faq" className="nav-link nav-scroll-link">Hỏi đáp</a>

            <div style={{ width: 1, height: 24, background: 'var(--border-soft)', margin: '0 4px' }} className="nav-scroll-link" />

            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            {user ? (
              <>
                <span className="nav-user">Xin chào, {user.name}</span>
                <div className="nav-user-menu" ref={menuRef}>
                  <button
                    onClick={() => setOpenMenu((prev) => !prev)}
                    className="nav-avatar-btn"
                    type="button"
                    aria-label="Mở menu tài khoản"
                  >
                    {user.name?.trim()?.[0] || 'U'}
                  </button>
                  {openMenu && (
                    <div className="nav-menu-popover">
                      <p className="nav-menu-name">{user.name}</p>
                      <Link to="/dashboard" className="nav-menu-link" onClick={() => setOpenMenu(false)}>
                        Chuyến đi của tôi
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" className="nav-menu-link" onClick={() => setOpenMenu(false)}>
                          Quản trị hệ thống
                        </Link>
                      )}
                      <button onClick={handleLogout} className="nav-menu-logout" type="button">
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-ghost">
                  Đăng nhập
                </Link>
                <Link to="/register" className="nav-solid">
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}