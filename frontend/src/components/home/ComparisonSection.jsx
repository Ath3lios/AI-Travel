const manualItems = [
  'Mất 2-4 giờ tìm kiếm thông tin',
  'Dễ bỏ sót địa điểm hay',
  'Tính chi phí thủ công, dễ sai',
  'Không biết thứ tự tham quan tối ưu',
  'Phải tra nhiều website khác nhau',
]

const aiItems = [
  'Lịch trình hoàn chỉnh trong 30 giây',
  'AI gợi ý đầy đủ địa điểm nổi bật',
  'Tự động tính và phân bổ ngân sách',
  'Tối ưu thứ tự tham quan theo giờ',
  'Tất cả trong một nền tảng duy nhất',
]

export default function ComparisonSection() {
  return (
    <section id="comparison" className="home-section">
      <div className="home-inner narrow">
        <div className="section-head">
          <span className="section-eyebrow">Tại sao chọn AI Travel?</span>
          <h2 className="section-title">
            AI giúp bạn tiết kiệm
            <br />
            <em className="compare-title-em">hàng giờ lên kế hoạch</em>
          </h2>
        </div>

        <div className="compare-grid">
          <div className="glass-card compare-card">
            <div className="compare-head">
              <div className="compare-icon manual">😕</div>
              <div>
                <div className="compare-heading">Tự lên kế hoạch</div>
                <div className="compare-subheading">Cách truyền thống</div>
              </div>
            </div>
            {manualItems.map((text, i) => (
              <div key={i} className={`compare-item${i < manualItems.length - 1 ? ' with-divider' : ''}`}>
                <span className="compare-item-danger">✕</span>
                <span className="compare-item-text">{text}</span>
              </div>
            ))}
          </div>

          <div className="glass-card compare-card recommended">
            <div className="compare-chip">ĐỀ XUẤT</div>
            <div className="compare-head">
              <div className="compare-icon ai">✈️</div>
              <div>
                <div className="compare-heading">Dùng AI Travel</div>
                <div className="compare-subheading ai">Thông minh và tự động</div>
              </div>
            </div>
            {aiItems.map((text, i) => (
              <div key={i} className={`compare-item${i < aiItems.length - 1 ? ' with-divider ai' : ''}`}>
                <span className="compare-item-ok">✓</span>
                <span className="compare-item-text ai">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}