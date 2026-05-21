import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const sliderImageModules = import.meta.glob('../../assets/hero-slider/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
})

const desktopCarouselImages = Object.entries(sliderImageModules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([, src]) => src)

export default function HeroSection({ user }) {
  const [activeDesktopSlide, setActiveDesktopSlide] = useState(0)
  const frameRef = useRef(null)
  const rafRef = useRef(0)
  const pointerRef = useRef({ x: 0, y: 0 })
  
  useEffect(() => {
    if (desktopCarouselImages.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveDesktopSlide((prev) => (prev + 1) % desktopCarouselImages.length)
    }, 4000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  function updateFrameTilt(clientX, clientY) {
    const frame = frameRef.current
    if (!frame) return

    const rect = frame.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const relativeX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    const relativeY = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1)
    const tiltX = (0.5 - relativeY) * 7
    const tiltY = (relativeX - 0.5) * 9

    frame.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`)
    frame.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`)
    frame.style.setProperty('--glare-x', `${(relativeX * 100).toFixed(1)}%`)
    frame.style.setProperty('--glare-y', `${(relativeY * 100).toFixed(1)}%`)
  }

  function handleFramePointerMove(event) {
    pointerRef.current.x = event.clientX
    pointerRef.current.y = event.clientY

    if (rafRef.current) return

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0
      updateFrameTilt(pointerRef.current.x, pointerRef.current.y)
    })
  }

  function handleFramePointerLeave() {
    const frame = frameRef.current
    if (!frame) return

    frame.style.setProperty('--tilt-x', '0deg')
    frame.style.setProperty('--tilt-y', '0deg')
    frame.style.setProperty('--glare-x', '50%')
    frame.style.setProperty('--glare-y', '35%')
  }

  return (
    <section className="hero-bg hero-onboarding">
      <div className="hero-bg-pattern" />
      <div className="hero-shell">
        <div className="hero-grid hero-onboarding-grid">
          
          <div className="hero-copy">
            <div className="badge"><span>✦</span> AI Travel</div>
            
            <h1 className="hero-title">
              {'Biến ý tưởng nghỉ dưỡng thành '}<em>lịch trình sẵn sàng khởi hành</em>
            </h1>
            
            <p className="hero-lead">
              Từ điểm đến, ngân sách đến sở thích cá nhân, AI Travel dựng ngay một kế hoạch rõ ràng
              theo ngày, đủ chi phí, đủ nhịp đi chơi và đủ thông tin để bạn ra quyết định nhanh.
            </p>

            <div className="btn-group hero-actions" style={{ marginTop: '24px' }}>
              <Link to={user ? '/dashboard' : '/register'} className="btn-primary">
                Tạo lịch trình ngay
              </Link>
            </div>
          </div>

          {/* CỘT BÊN PHẢI (ẢNH CAROUSEL) */}
          <div className="hero-scene" aria-hidden="true">
            <div
              ref={frameRef}
              className="hero-frame-carousel"
              onMouseMove={handleFramePointerMove}
              onMouseLeave={handleFramePointerLeave}
            >
              <div className="hero-frame-window">
                {desktopCarouselImages.length > 0 ? (
                  desktopCarouselImages.map((imageSrc, idx) => (
                    <img
                      key={`${imageSrc}-${idx}`}
                      src={imageSrc}
                      alt=""
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      fetchPriority={idx === 0 ? 'high' : undefined}
                      decoding="async"
                      className={`hero-frame-slide${idx === activeDesktopSlide ? ' is-active' : ''}`}
                    />
                  ))
                ) : (
                  <div className="hero-frame-empty">Thêm ảnh vào thư mục src/assets/hero-slider</div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  )
}
