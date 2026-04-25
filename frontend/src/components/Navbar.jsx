import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [openMenu, setOpenMenu] = useState(false)
  const menuRef = useRef(null)

  const handleLogout = () => {
    setOpenMenu(false)
    logout()
    navigate('/')
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <>
      <style>{`
        .nav-shell {
          position: sticky;
          top: 0;
          z-index: 40;
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.92);
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
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
          color: #0f172a;
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
        }

        .nav-link {
          color: #334155;
        }

        .nav-link:hover {
          background: #f8fafc;
          color: #0f172a;
        }

        .nav-user {
          font-size: 13px;
          color: #64748b;
          padding: 0 4px;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-ghost {
          color: #0f172a;
          border-color: #dbe3ee;
          background: #ffffff;
        }

        .nav-ghost:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .nav-solid {
          color: #ffffff;
          background: #0f172a;
          border-color: #0f172a;
        }

        .nav-solid:hover {
          background: #1e293b;
          border-color: #1e293b;
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
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
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
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
          padding: 10px;
          z-index: 50;
        }

        .nav-menu-name {
          font-size: 13px;
          color: #0f172a;
          font-weight: 600;
          margin: 0 0 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-menu-link {
          display: block;
          text-decoration: none;
          color: #334155;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .nav-menu-link:hover {
          background: #f1f5f9;
          color: #0f172a;
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
          .nav-user {
            display: none;
          }
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

          .nav-brand {
            font-size: 17px;
          }

          .nav-link,
          .nav-ghost,
          .nav-solid {
            font-size: 13px;
            padding: 7px 10px;
            border-radius: 9px;
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
