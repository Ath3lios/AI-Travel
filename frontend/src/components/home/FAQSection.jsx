import { useState } from 'react'

const faqs = [
  {
    category: 'Tính năng',
    q: 'AI Travel Planner hoạt động như thế nào?',
    a: 'Bạn nhập thông tin chuyến đi như điểm đến, ngày đi, ngân sách và phong cách du lịch. Hệ thống gửi dữ liệu cho AI để tạo lịch trình chi tiết theo từng mốc thời gian.',
  },
  {
    category: 'Chi phí',
    q: 'Sử dụng có mất phí không?',
    a: 'Hiện tại bạn có thể bắt đầu miễn phí. Chỉ cần đăng ký tài khoản là có thể tạo lịch trình.',
  },
  {
    category: 'Chi phí',
    q: 'Lịch trình có phù hợp với ngân sách thấp không?',
    a: 'Có. AI tự điều chỉnh gợi ý địa điểm, ăn uống và lưu trú theo mức ngân sách bạn đặt.',
  },
  {
    category: 'Tính năng',
    q: 'Tôi có thể lưu nhiều lịch trình cùng lúc không?',
    a: 'Có. Các lịch trình được lưu theo tài khoản để bạn mở lại và chỉnh sửa bất kỳ lúc nào.',
  },
  {
    category: 'Tính năng',
    q: 'AI có gợi ý chính xác cho từng vùng miền Việt Nam không?',
    a: 'Có. Hệ thống ưu tiên dữ liệu theo điểm đến cụ thể và đưa ra đề xuất phù hợp bối cảnh địa phương.',
  },
  {
    category: 'Tính năng',
    q: 'Lịch trình có tính phương tiện di chuyển không?',
    a: 'Có. Khi nhập nơi xuất phát, AI sẽ gợi ý phương tiện phù hợp và phân bổ chi phí vào tổng ngân sách.',
  },
  {
    category: 'Tính năng',
    q: 'Có thể tạo lịch trình cho nhóm đông người không?',
    a: 'Có. Bạn nhập số người tham gia, hệ thống sẽ tính toán chi phí và hoạt động phù hợp quy mô nhóm.',
  },
  {
    category: 'Tính năng',
    q: 'Nếu lịch trình chưa phù hợp thì sao?',
    a: 'Bạn có thể chỉnh thông tin và tạo lại. Mỗi lần tạo có thể cho ra phương án mới để bạn chọn.',
  },
  {
    category: 'Kỹ thuật',
    q: 'Dữ liệu của tôi có được bảo mật không?',
    a: 'Có. Hệ thống áp dụng xác thực JWT và các biện pháp bảo mật cần thiết cho tài khoản người dùng.',
  },
]

const categories = ['Tất cả', 'Tính năng', 'Chi phí', 'Kỹ thuật']

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Tất cả')

  const filteredFaqs = faqs.filter((faq) => (
    activeCategory === 'Tất cả' || faq.category === activeCategory
  ))

  return (
    <section className="home-section">
      <div className="home-inner faq">
        <div className="section-head">
          <span className="section-eyebrow">Giải đáp thắc mắc</span>
          <h2 className="section-title">Câu hỏi thường gặp</h2>
        </div>

        <div className="faq-toolbar">
          <div className="faq-tabs">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`faq-tab${activeCategory === category ? ' active' : ''}`}
                onClick={() => {
                  setActiveCategory(category)
                  setOpenIndex(null)
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="faq-list">
          {filteredFaqs.map((faq, i) => (
            <div key={`${faq.category}-${faq.q}`} className={`faq-item${openIndex === i ? ' open' : ''}`}>
              <button onClick={() => setOpenIndex(openIndex === i ? null : i)} className="faq-btn">
                <span>
                  <small className="faq-category">{faq.category}</small>
                  {faq.q}
                </span>
                <div className="faq-plus">
                  <span>+</span>
                </div>
              </button>

              {openIndex === i && (
                <div className="faq-answer">
                  <div className="faq-sep" />
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
