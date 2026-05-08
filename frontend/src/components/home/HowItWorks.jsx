const steps = [
  {
    step: '01',
    theme: 'theme-blue',
    icon: '📝',
    accent: 'Khai báo nhanh',
    title: 'Nhập thông tin chuyến đi',
    desc: 'Cho AI biết bạn muốn đi đâu, bao nhiêu ngày, ngân sách và phong cách du lịch bạn mong muốn.',
  },
  {
    step: '02',
    theme: 'theme-indigo',
    icon: '🤖',
    accent: 'AI phân tích',
    title: 'AI phân tích và đề xuất',
    desc: 'Hệ thống tổng hợp dữ liệu điểm đến, sắp xếp lịch trình hợp lý và gợi ý phân bổ chi phí phù hợp.',
  },
  {
    step: '03',
    theme: 'theme-teal',
    icon: '✅',
    accent: 'Sẵn sàng khởi hành',
    title: 'Nhận lịch trình chi tiết',
    desc: 'Bạn có lịch trình theo ngày, địa điểm, chi phí và có thể chỉnh sửa ngay khi cần.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="home-section">
      <div className="home-inner">
        <div className="section-head">
          <span className="section-eyebrow">Đơn giản và nhanh chóng</span>
          <h2 className="section-title">
            Chỉ 3 bước để có lịch trình hoàn chỉnh
          </h2>
        </div>

        <div className="steps-grid">
          {steps.reduce((acc, item, i) => {
            acc.push(
              <div key={i} className={`step-card ${item.theme}`}>
                <div className="step-kicker">
                  <span className="step-number">{item.step}</span>
                  <span className="step-meta">{item.accent}</span>
                </div>
                <div className="step-icon-wrap">
                  <div className="step-icon">{item.icon}</div>
                </div>
                <h3 className="step-title">{item.title}</h3>
                <p className="step-desc">{item.desc}</p>
              </div>
            )

            if (i < steps.length - 1) {
              acc.push(
                <div key={`arrow-${i}`} className="steps-arrow">
                  <span className="steps-arrow-line" />
                  <span className="steps-arrow-glyph">→</span>
                </div>
              )
            }
            return acc
          }, [])}
        </div>
      </div>
    </section>
  )
}
