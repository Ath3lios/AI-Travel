import { Link } from 'react-router-dom'

export default function CTASection({ user }) {
  return (
    <section className="cta-wrap">
      <div className="cta-box">
        <div className="cta-orb a" />
        <div className="cta-orb b" />
        <div className="cta-grid-pattern" />

        <div className="cta-content">
          <div className="cta-mini-cards" aria-hidden="true">
            <div className="cta-mini-card">✈️ Lịch trình theo ngày</div>
            <div className="cta-mini-card">💸 Có ước tính ngân sách</div>
            <div className="cta-mini-card">🧭 Tùy chỉnh theo sở thích</div>
          </div>

          <h2 className="cta-title">
            Sẵn sàng cho chuyến đi tiếp theo?<br />
            <em>Bắt đầu ngay hôm nay</em>
          </h2>

          <p className="cta-lead">
            Nhập thông tin cơ bản, nhận lịch trình chỉ sau vài giây và tùy chỉnh dễ dàng theo nhu cầu thực tế của bạn.
          </p>

          <Link 
            to={user ? '/dashboard' : '/register'} 
            className="btn-primary" // Mình bỏ class cta-btn-light đi để tránh xung đột màu cũ
            style={{
              color: '#fff',
              background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', // Cùng mã màu gradient xanh
              boxShadow: '0 6px 16px rgba(0, 114, 255, 0.25)',
              border: 'none',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 10px 24px rgba(0, 114, 255, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 114, 255, 0.25)'
            }}
          >
            Tạo lịch trình miễn phí ngay →
          </Link>
        </div>
      </div>
    </section>
  )
}
