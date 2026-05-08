// src/pages/Home.jsx
import { useAuth } from '../context/AuthContext'
import HeroSection from '../components/home/HeroSection'
import HowItWorks from '../components/home/HowItWorks'
import ComparisonSection from '../components/home/ComparisonSection'
import FAQSection from '../components/home/FAQSection'
import CTASection from '../components/home/CTASection'
import './Home.css'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="home-root">
      <HeroSection user={user} />
      <div className="home-main-sections">
        <hr className="section-divider" />
        <HowItWorks />
        <hr className="section-divider" />
        <ComparisonSection />
        <hr className="section-divider" />
        <FAQSection />
        <hr className="section-divider" />
        <CTASection user={user} />
      </div>

      <footer className="home-footer">
        © 2026 AI Travel. Đồ án tốt nghiệp ngành CNTT.
      </footer>
    </div>
  )
}
