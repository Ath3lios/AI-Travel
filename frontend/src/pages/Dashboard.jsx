import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import TripForm from '../components/TripForm'
import TripListItem from '../components/dashboard/TripListItem'
import TripListSkeleton from '../components/dashboard/TripListSkeleton'
import DeleteConfirmModal from '../components/dashboard/DeleteConfirmModal'
import { EmptyState } from '../components/ui/StateBlocks'
import useDebouncedValue from '../hooks/useDebouncedValue'
import useDestinationImage from '../hooks/useDestinationImage'

function useHorizontalDragScroll() {
  const rowRef = useRef(null)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    let isDragging = false, startX = 0, startScrollLeft = 0
    const onMouseDown = (e) => { if (e.button !== 0) return; isDragging = true; row.classList.add('dragging'); startX = e.pageX; startScrollLeft = row.scrollLeft }
    const onMouseMove = (e) => { if (!isDragging) return; e.preventDefault(); row.scrollLeft = startScrollLeft - (e.pageX - startX) * 1.2 }
    const stopDragging = () => { isDragging = false; row.classList.remove('dragging') }
    const onWheel = (e) => { if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; row.scrollLeft += e.deltaY; e.preventDefault() }
    row.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopDragging)
    row.addEventListener('mouseleave', stopDragging)
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      row.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopDragging)
      row.removeEventListener('mouseleave', stopDragging)
      row.removeEventListener('wheel', onWheel)
    }
  }, [])
  return rowRef
}

// ── Sample travel guides ──────────────────────────────────────────────────────
const SAMPLE_GUIDES = [
  {
    id: 'sample-hanoi', destination: 'Hà Nội', days: 3, spots: 9, tag: 'Phố cổ & ẩm thực',
    itinerary: {
      trip_summary: { best_time: 'Tháng 10 - 4', estimated_cost: '3-5 triệu/người', weather_note: 'Mát mẻ, dễ chịu' },
      days: [
        { day: 1, title: 'Hồ Hoàn Kiếm & Phố Cổ', weather: '24°C, có mây', schedule: [
          { time: '08:00', place: 'Hồ Hoàn Kiếm', address: 'Đinh Tiên Hoàng, Hoàn Kiếm', period: 'morning', estimated_cost: 'Miễn phí', duration: '45 phút', description: 'Hồ nước biểu tượng trung tâm Hà Nội, nơi có Tháp Rùa huyền thoại và cầu Thê Húc đỏ dẫn vào đền Ngọc Sơn.', highlights: ['Tháp Rùa giữa hồ', 'Cầu Thê Húc màu đỏ son', 'Đền Ngọc Sơn linh thiêng'], tips: 'Đến sớm trước 9h để tránh đông. Cuối tuần có phố đi bộ rất vui. Mua vé đền Ngọc Sơn 30k.', lat: 21.0285, lng: 105.8542 },
          { time: '09:30', place: 'Đền Ngọc Sơn', address: 'Hồ Hoàn Kiếm, Hoàn Kiếm', period: 'morning', estimated_cost: '30.000đ', duration: '30 phút', description: 'Ngôi đền cổ tọa lạc trên đảo nhỏ giữa Hồ Hoàn Kiếm, thờ Trần Hưng Đạo và thánh Văn Xương.', highlights: ['Kiến trúc cổ độc đáo', 'Rùa Hồ Gươm được trưng bày'], tips: 'Mặc trang phục kín đáo khi vào đền.', lat: 21.0293, lng: 105.8525 },
          { time: '11:00', place: 'Bún chả Hương Liên', address: '24 Lê Văn Hưu, Hai Bà Trưng', period: 'morning', estimated_cost: '70.000đ', duration: '45 phút', description: 'Quán bún chả nổi tiếng được Obama ghé thăm năm 2016.', highlights: ['Bún chả Obama', 'Nem cua bể giòn rụm'], tips: 'Đến trước 11h30 tránh xếp hàng.', lat: 21.0245, lng: 105.8456 },
          { time: '14:00', place: 'Văn Miếu - Quốc Tử Giám', address: '58 Quốc Tử Giám, Đống Đa', period: 'afternoon', estimated_cost: '30.000đ', duration: '1.5 giờ', description: 'Trường đại học đầu tiên của Việt Nam, xây dựng năm 1070 thờ Khổng Tử.', highlights: ['82 bia Tiến sĩ', 'Khuê Văn Các biểu tượng Hà Nội'], tips: 'Tránh xoa đầu rùa — bị cấm.', lat: 21.0274, lng: 105.8355 },
          { time: '16:30', place: 'Phố Tạ Hiện - Bia hơi', address: 'Tạ Hiện, Hoàn Kiếm', period: 'afternoon', estimated_cost: '50.000đ', duration: '1 giờ', description: 'Con phố bia hơi sôi động nhất Hà Nội.', highlights: ['Bia hơi Hà Nội 7k/cốc'], tips: 'Ghé trước 18h để có chỗ ngồi tốt.', lat: 21.0349, lng: 105.8514 },
        ]},
        { day: 2, title: 'Lăng Bác & Hồ Tây', weather: '22°C, nắng nhẹ', schedule: [
          { time: '07:30', place: 'Lăng Chủ tịch Hồ Chí Minh', address: 'Hùng Vương, Ba Đình', period: 'morning', estimated_cost: 'Miễn phí', duration: '1.5 giờ', description: 'Công trình lịch sử quan trọng nhất Việt Nam.', highlights: ['Lễ thay gác trang nghiêm', 'Quảng trường Ba Đình'], tips: 'Đến trước 8h, mặc trang phục nghiêm túc. Đóng cửa thứ 2 và thứ 6.', lat: 21.0369, lng: 105.8348 },
          { time: '10:00', place: 'Chùa Một Cột', address: 'Chùa Một Cột, Ba Đình', period: 'morning', estimated_cost: 'Miễn phí', duration: '30 phút', description: 'Ngôi chùa độc đáo hình bông sen nở, xây dựng năm 1049.', highlights: ['Kiến trúc độc nhất vô nhị'], tips: 'Kết hợp thăm Bảo tàng Hồ Chí Minh gần đó.', lat: 21.0358, lng: 105.8341 },
          { time: '14:00', place: 'Hồ Tây - Phủ Tây Hồ', address: 'Tây Hồ, Hà Nội', period: 'afternoon', estimated_cost: '20.000đ', duration: '2 giờ', description: 'Hồ nước lớn nhất Hà Nội với chu vi 17km.', highlights: ['Bánh tôm Hồ Tây nổi tiếng'], tips: 'Thử bánh tôm chiên giòn 40k ven hồ.', lat: 21.0564, lng: 105.8307 },
        ]},
        { day: 3, title: 'Làng lụa & mua sắm', weather: '25°C, nắng', schedule: [
          { time: '09:00', place: 'Làng lụa Vạn Phúc', address: 'Vạn Phúc, Hà Đông', period: 'morning', estimated_cost: 'Miễn phí vào cửa', duration: '2 giờ', description: 'Làng nghề dệt lụa truyền thống hơn 1200 năm tuổi.', highlights: ['Xem dệt lụa thủ công', 'Mua lụa giá tốt'], tips: 'Mặc cả 30-40% so với giá ban đầu.', lat: 20.9780, lng: 105.7651 },
          { time: '14:00', place: 'Chợ Đồng Xuân', address: 'Đồng Xuân, Hoàn Kiếm', period: 'afternoon', estimated_cost: 'Tùy mua sắm', duration: '2 giờ', description: 'Chợ đầu mối lớn nhất Hà Nội.', highlights: ['Đặc sản Hà Nội giá sỉ'], tips: 'Đến lầu 2 mua đồ lưu niệm rẻ hơn.', lat: 21.0381, lng: 105.8491 },
        ]},
      ],
      accommodation: [{ name: 'La Siesta Classic Hang Be', area: 'Phố Cổ', price_range: '800k-1.2tr/đêm', why: 'Trung tâm phố cổ, buffet sáng ngon' }],
      budget_breakdown: { accommodation: '2.4 triệu', food: '600k', transport: '300k', entrance: '200k', shopping: '500k', total: '4-5 triệu/người' },
      packing_list: ['Giày đi bộ', 'Áo khoác mỏng', 'Khẩu trang', 'Kem chống nắng', 'Tiền mặt'],
    }
  },
  {
    id: 'sample-danang', destination: 'Đà Nẵng', days: 4, spots: 11, tag: 'Biển & núi',
    itinerary: {
      trip_summary: { best_time: 'Tháng 5 - 8', estimated_cost: '5-8 triệu/người', weather_note: 'Nắng đẹp, ít mưa' },
      days: [
        { day: 1, title: 'Bãi biển Mỹ Khê & Sơn Trà', weather: '32°C, nắng', schedule: [
          { time: '06:00', place: 'Bãi biển Mỹ Khê', address: 'Mỹ Khê, Sơn Trà, Đà Nẵng', period: 'morning', estimated_cost: 'Miễn phí', duration: '2 giờ', description: 'Một trong những bãi biển đẹp nhất hành tinh theo Forbes, cát trắng mịn dài 9km.', highlights: ['Bình minh tuyệt đẹp 5h30', 'Nước biển trong xanh'], tips: 'Đến trước 7h để có bãi đẹp và mát.', lat: 16.0544, lng: 108.2442 },
          { time: '09:00', place: 'Chùa Linh Ứng Sơn Trà', address: 'Bán đảo Sơn Trà, Đà Nẵng', period: 'morning', estimated_cost: 'Miễn phí', duration: '2 giờ', description: 'Chùa có tượng Phật Bà Quan Âm cao 67m, nhìn ra toàn vịnh Đà Nẵng.', highlights: ['Tượng Phật Bà cao nhất VN', 'View toàn cảnh vịnh'], tips: 'Đi xe máy thuê 120k/ngày. Mang áo khoác vì trên cao lộng gió.', lat: 16.1023, lng: 108.2762 },
          { time: '13:00', place: 'Bún mắm nêm Bà Tám', address: '65 Bình Minh 3, Ngũ Hành Sơn', period: 'afternoon', estimated_cost: '40.000đ', duration: '45 phút', description: 'Quán bún mắm nêm đặc trưng Đà Nẵng.', highlights: ['Bún mắm nêm chuẩn vị'], tips: 'Gọi bún với thịt heo luộc + chả — combo chuẩn nhất.', lat: 16.0123, lng: 108.2451 },
        ]},
        { day: 2, title: 'Hội An cổ kính', weather: '30°C, nắng nhẹ', schedule: [
          { time: '08:00', place: 'Phố cổ Hội An', address: 'Phường Minh An, Hội An', period: 'morning', estimated_cost: '120.000đ', duration: '3 giờ', description: 'Di sản văn hóa UNESCO, phố cổ hơn 400 năm tuổi.', highlights: ['Chùa Cầu Nhật Bản', 'Hội quán Phúc Kiến'], tips: 'Vé 120k gồm 5 điểm tham quan. Đi buổi sáng hoặc chiều tối.', lat: 15.8801, lng: 108.3380 },
          { time: '12:00', place: 'Cao Lầu Bà Bé', address: '26 Thái Phiên, Hội An', period: 'afternoon', estimated_cost: '35.000đ', duration: '45 phút', description: 'Quán cao lầu gia truyền, sợi cao lầu đúng vị duy nhất ở Hội An.', highlights: ['Cao lầu sợi dai đặc biệt'], tips: 'Cao lầu chỉ ngon ở Hội An — phải thử!', lat: 15.8798, lng: 108.3320 },
        ]},
        { day: 3, title: 'Bà Nà Hills - Cầu Vàng', weather: '28°C, mây mù đỉnh núi', schedule: [
          { time: '08:00', place: 'Bà Nà Hills - Cầu Vàng', address: 'Hòa Ninh, Hòa Vang, Đà Nẵng', period: 'morning', estimated_cost: '750.000đ', duration: 'Cả ngày', description: 'Khu du lịch nghỉ dưỡng 1487m, nơi có Cầu Vàng nổi tiếng thế giới.', highlights: ['Cầu Vàng trong bàn tay khổng lồ', 'Làng Pháp cổ điển'], tips: 'Đặt vé online trước 2 ngày giảm 50k. Mang áo khoác dày.', lat: 15.9932, lng: 107.9889 },
        ]},
        { day: 4, title: 'Ngũ Hành Sơn & về nhà', weather: '31°C, nắng', schedule: [
          { time: '08:00', place: 'Ngũ Hành Sơn', address: 'Hòa Hải, Ngũ Hành Sơn, Đà Nẵng', period: 'morning', estimated_cost: '40.000đ', duration: '2 giờ', description: '5 ngọn núi đá cẩm thạch huyền bí với hang động và chùa chiền.', highlights: ['Hang Âm Phủ huyền bí', 'View biển từ đỉnh Thủy Sơn'], tips: 'Đi thang máy lên (15k) tiết kiệm sức.', lat: 16.0013, lng: 108.2634 },
        ]},
      ],
      accommodation: [{ name: 'Fusion Suites Da Nang Beach', area: 'Mỹ Khê', price_range: '1.5-2.5tr/đêm', why: 'Sát biển, bể bơi vô cực' }],
      budget_breakdown: { accommodation: '6 triệu', food: '1.2 triệu', transport: '800k', entrance: '1.1 triệu', total: '9-10 triệu/người' },
      packing_list: ['Đồ bơi', 'Kem chống nắng SPF50+', 'Áo khoác (Bà Nà)', 'Dép xỏ ngón'],
    }
  },
  {
    id: 'sample-hoian', destination: 'Hội An', days: 2, spots: 6, tag: 'Di sản & đèn lồng',
    itinerary: {
      trip_summary: { best_time: 'Tháng 2 - 7', estimated_cost: '2-4 triệu/người', weather_note: 'Khô ráo, dễ chịu' },
      days: [
        { day: 1, title: 'Phố cổ & sông Hoài', weather: '28°C, nắng nhẹ', schedule: [
          { time: '07:00', place: 'Chùa Cầu Nhật Bản', address: 'Nguyễn Thị Minh Khai, Hội An', period: 'morning', estimated_cost: 'Vé tổng hợp 120k', duration: '30 phút', description: 'Cây cầu cổ có mái che duy nhất ở Việt Nam, biểu tượng Hội An.', highlights: ['Kiến trúc Nhật cổ 400 năm'], tips: 'Chụp ảnh đẹp nhất lúc 7h sáng khi vắng người.', lat: 15.8775, lng: 108.3262 },
          { time: '10:00', place: 'Làng rau Trà Quế', address: 'Trà Quế, Cẩm Hà, Hội An', period: 'morning', estimated_cost: '150.000đ', duration: '2 giờ', description: 'Làng rau hữu cơ 400 năm tuổi, tour trải nghiệm làm nông.', highlights: ['Trồng rau và nấu ăn cùng nông dân'], tips: 'Book tour buổi sáng 7h30 để trải nghiệm thu hoạch thật sự.', lat: 15.9012, lng: 108.3498 },
          { time: '19:00', place: 'Phố đèn lồng - Đêm rằm', address: 'Phố cổ Hội An', period: 'evening', estimated_cost: '10.000đ/đèn', duration: '2 giờ', description: 'Đêm rằm tắt điện thắp nến, hàng ngàn đèn lồng lung linh.', highlights: ['Thả đèn hoa đăng xuống sông Hoài'], tips: 'Đúng ngày 14 âm lịch mới có đêm đèn lồng!', lat: 15.8801, lng: 108.3380 },
        ]},
        { day: 2, title: 'Biển An Bàng & làng gốm', weather: '30°C, nắng', schedule: [
          { time: '07:30', place: 'Biển An Bàng', address: 'An Bàng, Cẩm An, Hội An', period: 'morning', estimated_cost: 'Miễn phí', duration: '3 giờ', description: 'Bãi biển yên tĩnh cách phố cổ 3km, ít khách, nước trong.', highlights: ['Nước biển trong xanh', 'Ít đông đúc hơn Cửa Đại'], tips: 'Thuê xe đạp 50k đạp ra biển — trải nghiệm tuyệt vời.', lat: 15.9102, lng: 108.3712 },
          { time: '14:00', place: 'Làng gốm Thanh Hà', address: 'Thanh Hà, Hội An', period: 'afternoon', estimated_cost: '35.000đ', duration: '1.5 giờ', description: 'Làng gốm thủ công 500 năm tuổi, tự tay nặn gốm.', highlights: ['Tự nặn gốm trên bàn xoay'], tips: 'Mang quần cũ vì dính đất.', lat: 15.8743, lng: 108.3178 },
        ]},
      ],
      accommodation: [{ name: 'Vinh Hung Emerald Resort', area: 'Phố cổ', price_range: '600k-1.2tr/đêm', why: 'Nằm trong phố cổ, hồ bơi đẹp' }],
      budget_breakdown: { accommodation: '1.5 triệu', food: '500k', transport: '200k', entrance: '300k', total: '2.5-4 triệu/người' },
      packing_list: ['Áo dài (thuê tại chỗ)', 'Giày thoáng khí', 'Đồ bơi'],
    }
  },
  {
    id: 'sample-sapa', destination: 'Sapa', days: 3, spots: 8, tag: 'Núi rừng & bản làng',
    itinerary: {
      trip_summary: { best_time: 'Tháng 9 - 11 / tháng 3 - 5', estimated_cost: '4-7 triệu/người', weather_note: 'Mát lạnh quanh năm, dưới 20°C' },
      days: [
        { day: 1, title: 'Đỉnh Fansipan & bản Cát Cát', weather: '15°C, có mây', schedule: [
          { time: '08:00', place: 'Cáp treo Fansipan', address: 'Fansipan Legend, Sapa, Lào Cai', period: 'morning', estimated_cost: '750.000đ', duration: '3 giờ', description: 'Lên đỉnh Fansipan 3.143m — nóc nhà Đông Dương.', highlights: ['Đứng trên nóc nhà Đông Dương', 'Mây trắng phủ dưới chân'], tips: 'Mang áo khoác dày và găng tay — đỉnh núi 0-5°C.', lat: 22.3036, lng: 103.7764 },
          { time: '14:00', place: 'Bản Cát Cát', address: 'San Sả Hồ, Sapa', period: 'afternoon', estimated_cost: '70.000đ', duration: '2 giờ', description: "Bản làng người H'Mông đen cổ nhất Sapa.", highlights: ['Ruộng bậc thang vàng óng', 'Thác Cát Cát hùng vĩ'], tips: 'Mặc giày đế bám vì đường dốc trơn.', lat: 22.3237, lng: 103.8312 },
        ]},
        { day: 2, title: 'Thung lũng Mường Hoa', weather: '18°C, nắng đẹp', schedule: [
          { time: '07:30', place: 'Ruộng bậc thang Mường Hoa', address: 'Hầu Thào, Sapa', period: 'morning', estimated_cost: 'Miễn phí', duration: '3 giờ', description: 'Thung lũng ruộng bậc thang được UNESCO công nhận.', highlights: ['Ruộng vàng mùa gặt tháng 9-10'], tips: 'Tháng 9-10 là đỉnh điểm đẹp nhất.', lat: 22.3156, lng: 103.8721 },
          { time: '13:00', place: 'Chợ Bắc Hà', address: 'Bắc Hà, Lào Cai', period: 'afternoon', estimated_cost: 'Miễn phí vào cửa', duration: '2.5 giờ', description: "Phiên chợ vùng cao họp chủ nhật, các dân tộc H'Mông Hoa, Tày, Nùng.", highlights: ["Trang phục H'Mông Hoa rực rỡ", 'Rượu ngô Bắc Hà'], tips: 'Chỉ họp chủ nhật. Đi sớm 7h-9h đông vui nhất.', lat: 22.5308, lng: 104.3052 },
        ]},
        { day: 3, title: 'Trekking bản Tả Van', weather: '16°C, mây mù buổi sáng', schedule: [
          { time: '08:00', place: 'Trekking bản Tả Van', address: 'Tả Van, Sapa', period: 'morning', estimated_cost: '300.000đ (guide)', duration: '4 giờ', description: 'Cung trek dễ đi qua ruộng bậc thang và bản làng Giáy.', highlights: ['Đi qua 3 bản làng dân tộc', 'Suối nước trong mát'], tips: 'Thuê guide người bản địa 300k. Mang áo mưa nếu trời âm u.', lat: 22.2871, lng: 103.8534 },
        ]},
      ],
      accommodation: [{ name: "Pao's Sapa Leisure Hotel", area: 'Trung tâm Sapa', price_range: '800k-1.5tr/đêm', why: 'View núi đẹp, bữa sáng ngon' }],
      budget_breakdown: { accommodation: '2.5 triệu', food: '600k', transport: '500k', entrance: '1.2 triệu', total: '5-7 triệu/người' },
      packing_list: ['Áo khoác dày', 'Giày trekking', 'Găng tay', 'Thuốc say xe', 'Áo mưa nhẹ'],
    }
  },
  {
    id: 'sample-phuquoc', destination: 'Phú Quốc', days: 3, spots: 9, tag: 'Biển đảo thư giãn',
    itinerary: {
      trip_summary: { best_time: 'Tháng 11 - 4', estimated_cost: '6-9 triệu/người', weather_note: 'Nắng đẹp, biển êm' },
      days: [
        { day: 1, title: 'Dinh Cậu & chợ đêm', weather: '29°C, nắng', schedule: [
          { time: '16:30', place: 'Dinh Cậu', address: 'Khu phố 2, Dương Đông', period: 'afternoon', estimated_cost: 'Miễn phí', duration: '1 giờ', description: 'Biểu tượng tâm linh nổi tiếng của đảo, ngắm hoàng hôn rất đẹp.', highlights: ['Ngắm hoàng hôn', 'Khung cảnh biển đá'], tips: 'Đi trước 17h để có vị trí đẹp.', lat: 10.2194, lng: 103.9598 },
          { time: '19:00', place: 'Chợ đêm Phú Quốc', address: 'Bạch Đằng, Dương Đông', period: 'evening', estimated_cost: '150.000đ', duration: '2 giờ', description: 'Thiên đường hải sản và đồ lưu niệm buổi tối.', highlights: ['Hải sản nướng', 'Kem cuộn, đồ handmade'], tips: 'Nên hỏi giá trước khi gọi món.', lat: 10.2207, lng: 103.9609 },
        ]},
        { day: 2, title: 'Bãi Sao & cáp treo Hòn Thơm', weather: '30°C, nắng', schedule: [
          { time: '09:00', place: 'Bãi Sao', address: 'An Thới, Phú Quốc', period: 'morning', estimated_cost: 'Miễn phí', duration: '2.5 giờ', description: 'Bãi biển cát trắng mịn nổi tiếng nhất Phú Quốc.', highlights: ['Nước xanh ngọc', 'Bãi cát mịn'], tips: 'Đi sớm để tránh nắng gắt.', lat: 10.0329, lng: 104.0283 },
          { time: '14:00', place: 'Cáp treo Hòn Thơm', address: 'Ga An Thới, Phú Quốc', period: 'afternoon', estimated_cost: '650.000đ', duration: '3 giờ', description: 'Cáp treo vượt biển dài nhất thế giới ra đảo Hòn Thơm.', highlights: ['View biển từ cabin', 'Công viên nước Aquatopia'], tips: 'Đặt vé online để tiết kiệm thời gian xếp hàng.', lat: 10.0089, lng: 104.0247 },
        ]},
      ],
      accommodation: [{ name: 'Seashells Phu Quoc Hotel', area: 'Dương Đông', price_range: '1.4-2.2tr/đêm', why: 'Vị trí trung tâm, sát biển' }],
      budget_breakdown: { accommodation: '4.5 triệu', food: '1.2 triệu', transport: '900k', activities: '1.5 triệu', total: '6-9 triệu/người' },
      packing_list: ['Đồ bơi', 'Kính mát', 'Kem chống nắng', 'Dép đi biển'],
    },
  },
  {
    id: 'sample-dalat', destination: 'Đà Lạt', days: 3, spots: 8, tag: 'Cao nguyên mộng mơ',
    itinerary: {
      trip_summary: { best_time: 'Tháng 11 - 3', estimated_cost: '4-6 triệu/người', weather_note: 'Sáng lạnh, trưa mát' },
      days: [
        { day: 1, title: 'Hồ Xuân Hương & quảng trường', weather: '21°C, nắng nhẹ', schedule: [
          { time: '08:00', place: 'Hồ Xuân Hương', address: 'Trung tâm Đà Lạt', period: 'morning', estimated_cost: 'Miễn phí', duration: '1.5 giờ', description: 'Biểu tượng trung tâm thành phố, phù hợp đi dạo và chụp ảnh.', highlights: ['View thông thoáng', 'Không khí mát'], tips: 'Thuê xe đạp đôi quanh hồ vào buổi sáng.', lat: 11.9404, lng: 108.4583 },
          { time: '15:00', place: 'Quảng trường Lâm Viên', address: 'Trần Quốc Toản, Đà Lạt', period: 'afternoon', estimated_cost: 'Miễn phí', duration: '1 giờ', description: 'Công trình biểu tượng nụ hoa atiso và bông dã quỳ.', highlights: ['Check-in biểu tượng Đà Lạt'], tips: 'Buổi chiều ánh sáng đẹp để chụp ảnh.', lat: 11.9382, lng: 108.4575 },
        ]},
        { day: 2, title: 'Thác Datanla & đồi chè Cầu Đất', weather: '20°C, mây nhẹ', schedule: [
          { time: '09:00', place: 'Thác Datanla', address: 'QL20, Đà Lạt', period: 'morning', estimated_cost: '80.000đ', duration: '2 giờ', description: 'Thác nổi tiếng với trò máng trượt xuyên rừng.', highlights: ['Máng trượt', 'Rừng thông xanh'], tips: 'Mang giày bám tốt vì đường có đoạn ẩm.', lat: 11.9042, lng: 108.4811 },
          { time: '15:30', place: 'Đồi chè Cầu Đất', address: 'Xuân Trường, Đà Lạt', period: 'afternoon', estimated_cost: 'Miễn phí', duration: '2 giờ', description: 'Đồi chè xanh mướt nổi tiếng, hợp săn mây sáng sớm.', highlights: ['Đồi chè bạt ngàn', 'View đồi cao'], tips: 'Nếu săn mây nên đi từ 5h sáng.', lat: 11.8706, lng: 108.5382 },
        ]},
      ],
      accommodation: [{ name: 'Colline Hotel', area: 'Trung tâm', price_range: '900k-1.6tr/đêm', why: 'Thuận tiện đi lại, gần chợ đêm' }],
      budget_breakdown: { accommodation: '3.2 triệu', food: '900k', transport: '600k', activities: '700k', total: '4-6 triệu/người' },
      packing_list: ['Áo khoác ấm', 'Giày thể thao', 'Ô gấp', 'Thuốc cảm nhẹ'],
    },
  },
  {
    id: 'sample-nhatrang', destination: 'Nha Trang', days: 3, spots: 8, tag: 'Biển xanh nắng vàng',
    itinerary: {
      trip_summary: { best_time: 'Tháng 2 - 8', estimated_cost: '5-7 triệu/người', weather_note: 'Ít mưa, biển đẹp' },
      days: [
        { day: 1, title: 'Biển Trần Phú & hải sản', weather: '30°C, nắng', schedule: [
          { time: '07:30', place: 'Bãi biển Trần Phú', address: 'Đường Trần Phú, Nha Trang', period: 'morning', estimated_cost: 'Miễn phí', duration: '2 giờ', description: 'Bãi biển trung tâm dài và đẹp, thuận tiện vui chơi.', highlights: ['Tắm biển sáng sớm', 'Nhiều quán cà phê view biển'], tips: 'Đi trước 9h để nắng dịu hơn.', lat: 12.2388, lng: 109.1967 },
          { time: '18:30', place: 'Phố hải sản Tháp Bà', address: 'Khu Tháp Bà, Nha Trang', period: 'evening', estimated_cost: '250.000đ', duration: '2 giờ', description: 'Khu ẩm thực hải sản tươi nổi tiếng địa phương.', highlights: ['Hải sản tươi', 'Không khí nhộn nhịp'], tips: 'Ưu tiên quán niêm yết giá rõ ràng.', lat: 12.2653, lng: 109.2034 },
        ]},
        { day: 2, title: 'VinWonders & cáp treo', weather: '31°C, nắng', schedule: [
          { time: '09:00', place: 'VinWonders Nha Trang', address: 'Đảo Hòn Tre', period: 'morning', estimated_cost: '950.000đ', duration: 'Cả ngày', description: 'Công viên giải trí lớn với nhiều trò chơi và show diễn.', highlights: ['Cáp treo vượt biển', 'Show nhạc nước'], tips: 'Nên đi cả ngày để chơi đủ khu.', lat: 12.2021, lng: 109.2438 },
        ]},
      ],
      accommodation: [{ name: 'Liberty Central Nha Trang', area: 'Trần Phú', price_range: '1-1.8tr/đêm', why: 'Ngay trung tâm biển, tiện di chuyển' }],
      budget_breakdown: { accommodation: '3.8 triệu', food: '1 triệu', transport: '700k', activities: '1.5 triệu', total: '5-7 triệu/người' },
      packing_list: ['Đồ bơi', 'Mũ rộng vành', 'Kem chống nắng', 'Túi chống nước'],
    },
  },
]

const DISPLAYED_GUIDES = SAMPLE_GUIDES.slice(0, 3)

// ── Guide Card ────────────────────────────────────────────────────────────────
function GuideCard({ guide, onClick, large }) {
  const imgUrl = useDestinationImage(guide.destination)
  return (
    <div onClick={onClick} style={{
      flexShrink: 0,
      width: large ? '100%' : 190,
      height: large ? 200 : 230,
      borderRadius: 20, overflow: 'hidden',
      position: 'relative', cursor: 'pointer',
      background: imgUrl ? `url(${imgUrl}) center/cover` : 'linear-gradient(135deg,#c7d2fe,#a5b4fc)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.2)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
    >
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)' }} />
      <div style={{ position:'absolute', top:12, left:12 }}>
        <span style={{ fontSize:11, fontWeight:700, background:'rgba(255,255,255,0.2)', backdropFilter:'blur(6px)', color:'white', padding:'3px 10px', borderRadius:999 }}>{guide.tag}</span>
      </div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px' }}>
        <div style={{ fontSize: large ? 17 : 15, fontWeight:700, color:'white', lineHeight:1.2, marginBottom:3, fontFamily:"'Fraunces', serif" }}>
          {guide.days}-Day {guide.destination}
        </div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)' }}>{guide.spots} Spots</div>
      </div>
    </div>
  )
}

// ── Sample Modal ──────────────────────────────────────────────────────────────
function SampleModal({ guide, onClose }) {
  const imgUrl = useDestinationImage(guide?.destination || '')
  if (!guide) return null
  const days = guide.itinerary?.days || []
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, backdropFilter:'blur(3px)', animation:'fadeIn 0.2s ease' }} />
      <div className="guide-modal-sheet" style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--surface-panel-alt)', borderRadius:'24px 24px 0 0', zIndex:1001, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 -8px 40px rgba(0,0,0,0.15)', fontFamily:"'DM Sans', sans-serif" }}>
        {/* Hero */}
        <div style={{ position:'relative', height:200, background: imgUrl ? `url(${imgUrl}) center/cover` : 'linear-gradient(135deg,#c7d2fe,#a5b4fc)', borderRadius:'24px 24px 0 0', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />
          <button onClick={onClose} style={{ position:'absolute', top:14, right:14, width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'none', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          <div style={{ position:'absolute', bottom:16, left:16 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'white', fontFamily:"'Fraunces', serif" }}>{guide.destination}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>{guide.days} ngày · {guide.spots} địa điểm</div>
          </div>
        </div>
        <div style={{ padding:'20px 20px 48px', maxWidth:680, margin:'0 auto' }}>
          {guide.itinerary?.trip_summary && (
            <div style={{ background:'var(--surface-strong)', borderRadius:14, padding:'14px 16px', border:'1px solid var(--border-soft)', marginBottom:20 }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
                {guide.itinerary.trip_summary.best_time && <span style={{ fontSize:13, color:'var(--brand-primary)' }}>🌤️ {guide.itinerary.trip_summary.best_time}</span>}
                {guide.itinerary.trip_summary.estimated_cost && <span style={{ fontSize:13, color:'var(--brand-accent)' }}>💰 {guide.itinerary.trip_summary.estimated_cost}</span>}
                {guide.itinerary.trip_summary.weather_note && <span style={{ fontSize:13, color:'var(--text-muted)' }}>📋 {guide.itinerary.trip_summary.weather_note}</span>}
              </div>
            </div>
          )}
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:0.5 }}>Lịch trình</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
            {days.map((day, i) => (
              <div key={i} style={{ background:'var(--surface-panel)', borderRadius:14, border:'1px solid var(--border-soft)', padding:'14px 16px' }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)', marginBottom:8, fontFamily:"'Fraunces', serif" }}>Ngày {day.day} — {day.title}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {(day.schedule || []).map((s, j) => (
                    <span key={j} style={{ fontSize:12, background:'var(--surface-muted)', color:'var(--text-soft)', padding:'3px 10px', borderRadius:999 }}>{s.place}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--surface-strong)', borderRadius:16, padding:'18px', border:'1px solid var(--border-soft)', textAlign:'center' }}>
            <div style={{ fontSize:14, color:'var(--brand-primary)', fontWeight:600, marginBottom:4 }}>Muốn có lịch trình riêng?</div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14 }}>AI sẽ tạo lịch cá nhân hóa theo ngân sách & sở thích của bạn</div>
            <button onClick={onClose} style={{ background:'linear-gradient(135deg, var(--brand-primary), var(--accent-indigo))', color:'#0b1120', padding:'12px 28px', borderRadius:12, border:'none', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(34,211,238,0.28)', fontFamily:'inherit' }}>
              ✨ Tạo lịch trình của tôi
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUpMobile{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes popInDesktop{
          from{opacity:0; transform:translateX(-50%) translateY(24px)}
          to{opacity:1; transform:translateX(-50%) translateY(0)}
        }
        .guide-modal-sheet{
          animation: slideUpMobile 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        @media (min-width: 1024px) {
          .guide-modal-sheet {
            left: 50% !important;
            right: auto !important;
            /* Nới rộng lên 1100px cho xứng tầm với layout 1280px */
            width: min(1100px, calc(100vw - 64px)); 
            transform: translateX(-50%);
            bottom: 20px; /* Đẩy lên một chút cho thoáng chân */
            border-radius: 28px; /* Tăng bo góc một chút cho sang */
            animation: popInDesktop 0.28s cubic-bezier(0.16,1,0.3,1);
          }
        }
      `}</style>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [trips, setTrips] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pendingDeleteTripId, setPendingDeleteTripId] = useState(null)
  const [selectedGuide, setSelectedGuide] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const debouncedSearch = useDebouncedValue(search, 250)
  const guidesRowRef = useHorizontalDragScroll()

  useEffect(() => {
    api.get('/trips/my-trips').then(res => setTrips(res.data)).finally(() => setLoading(false))
  }, [location.key])

  const handleTripCreated = useCallback((newTrip) => { setShowForm(false); navigate(`/trips/${newTrip.id}`) }, [navigate])
  const handleDelete = useCallback((tripId, e) => { e.stopPropagation(); setPendingDeleteTripId(tripId) }, [])
  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteTripId) return
    const id = pendingDeleteTripId; setPendingDeleteTripId(null)
    await api.delete(`/trips/${id}`)
    setTrips(prev => prev.filter(t => t.id !== id))
  }, [pendingDeleteTripId])

  const filteredTrips = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return q ? trips.filter(t => t.destination.toLowerCase().includes(q)) : trips
  }, [trips, debouncedSearch])

  return (
    <div className='dashboard-page' style={{ fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`
        .dashboard-page { min-height: 100vh; background: linear-gradient(180deg, var(--app-bg) 0%, var(--app-bg-soft) 55%, var(--app-bg) 100%); }
        /* Mobile: single col scroll */
        .guides-scroll { display:flex; gap:12px; overflow-x:auto; padding:4px 20px 12px; scrollbar-width:none; cursor:grab; }
        .guides-scroll::-webkit-scrollbar { display:none; }
        .guides-scroll.dragging { cursor:grabbing; user-select:none; }

        /* Desktop: hide scroll, show grid */
        .guides-grid-desktop { display:none; }

        .dashboard-title { font-family:'Fraunces', serif; font-size:24px; font-weight:600; color:var(--text-strong); margin:0; letter-spacing:-0.5px; }
        .section-title { font-size:16px; font-weight:700; color:var(--text-strong); margin:0 0 12px; }
        .section-subtitle { margin:-6px 0 10px; font-size:12px; color:var(--text-muted); }
        .section-block { margin-bottom: 28px; }
        .create-form-wrap { max-width: 1280px; margin: 0 auto 32px; animation: fadeUp 0.3s both; }
        .trips-head { margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; }
        .trips-count { font-size:12px; color:var(--text-muted); }
        .search-wrap { position:relative; margin-bottom:14px; }
        .search-icon { position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:13px; color:var(--text-muted); pointer-events:none; }
        .search-input { width:100%; box-sizing:border-box; border:1px solid var(--border-soft); border-radius:12px; padding:10px 34px 10px 32px; font-size:13px; outline:none; background:var(--surface-panel); color:var(--text-strong); font-family:inherit; }
        .search-clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:var(--surface-muted); color:var(--text-muted); border-radius:999px; width:20px; height:20px; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center; }
        .new-trip-btn { display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:14px; font-size:14px; font-weight:600; border:none; cursor:pointer; transition:all 0.2s; font-family:inherit; white-space:nowrap; }
        .new-trip-btn.active { background:var(--surface-muted); color:var(--text-muted); }
        .new-trip-btn.inactive { background:linear-gradient(135deg, var(--brand-primary), var(--accent-indigo)); color:#fff; box-shadow:0 4px 16px rgba(34,211,238,0.28); }
        .new-trip-btn.inactive:hover { box-shadow:0 6px 24px rgba(34,211,238,0.36); transform:translateY(-1px); }
        .trips-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; }

        /* Centered layout */
        /* Centered layout - Mở rộng lên 1280px cho Desktop */
        @media (min-width: 900px) {
          .dashboard-header { max-width: 1280px; margin: 0 auto; padding: 26px 24px 0; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
          .dashboard-root { max-width: 1280px; margin: 0 auto; padding: 24px 24px 60px; }
          .guides-scroll { display: none !important; }
          /* Vẫn giữ 3 cột cho Travel Guides, vì khung to ra nên card sẽ rộng ra */
          .guides-grid-desktop { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; } 
        }

        /* Setup cho khung lưới hiển thị 4 cột trên màn hình lớn */
        @media (min-width: 1161px) {
          .trips-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
        }

        /* Màn hình Laptop nhỏ / Tablet nằm ngang: hiển thị 3 cột */
        @media (min-width: 900px) and (max-width: 1160px) {
          .trips-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        }

        /* Mobile */
        @media (max-width: 899px) {
          .dashboard-header { padding: 20px 20px 0; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
          .dashboard-root { padding: 20px 20px 60px; }
          .trips-grid { grid-template-columns: 1fr; gap: 16px; }
        }

        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div className="dashboard-header">
        <div>
          <h1 className='dashboard-title'>Khám phá & lên kế hoạch</h1>
        </div>
        <button className={`new-trip-btn ${showForm ? 'active' : 'inactive'}`} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Đóng' : '✨ Tạo mới'}
        </button>
      </div>

      <div className="dashboard-root">
        {showForm && (
          <div className='create-form-wrap'>
            <TripForm onTripCreated={handleTripCreated} />
          </div>
        )}

        {/* Travel Guides */}
        <div className='section-block'>
          <p className="section-title">Travel Guides</p>
          <p className='section-subtitle'>Lịch trình mẫu để tham khảo nhanh</p>

          {/* Mobile: horizontal scroll */}
          <div ref={guidesRowRef} className="guides-scroll">
            {DISPLAYED_GUIDES.map((guide, idx) => (
              <div key={guide.id} style={{ animation:`fadeUp 0.4s ${idx*0.07}s both` }}>
                <GuideCard guide={guide} onClick={() => setSelectedGuide(guide)} />
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="guides-grid-desktop" style={{ padding:'0 0' }}>
            {DISPLAYED_GUIDES.map((guide, idx) => (
              <div key={guide.id} style={{ animation:`fadeUp 0.4s ${idx*0.07}s both` }}>
                <GuideCard guide={guide} onClick={() => setSelectedGuide(guide)} large />
              </div>
            ))}
          </div>
        </div>

        {/* My Trips */}
        <div>
          <div className='trips-head'>
            <p className="section-title" style={{ margin:0 }}>Chuyến đi của tôi</p>
            {!loading && trips.length > 0 && (
              <span className='trips-count'>{trips.length} chuyến</span>
            )}
          </div>

          {/* Search */}
          <div className='search-wrap'>
            <span className='search-icon'>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo điểm đến..."
              className='search-input' />
            {search && (
              <button onClick={() => setSearch('')} className='search-clear'>✕</button>
            )}
          </div>

          {loading ? <TripListSkeleton /> : filteredTrips.length === 0 ? (
            search ? (
              <EmptyState message={`Không tìm thấy "${debouncedSearch}"`} icon='🔎' />
            ) : (
              <EmptyState message='Chưa có lịch trình. Nhấn ' accentText='✨ Tạo mới!' />
            )
          ) : (
            <div className='trips-grid'>
              {filteredTrips.map((trip, idx) => (
                <TripListItem key={trip.id} trip={trip} index={idx} onClick={() => navigate(`/trips/${trip.id}`)} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedGuide && <SampleModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />}
      {pendingDeleteTripId && <DeleteConfirmModal onConfirm={confirmDelete} onCancel={() => setPendingDeleteTripId(null)} />}
    </div>
  )
}
