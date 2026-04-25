import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const TripDetail = lazy(() => import('./pages/TripDetail'))
const Admin = lazy(() => import('./pages/Admin'))

function RouteLoading() {
  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
      Đang tải...
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <RouteLoading />
  return user ? children : <Navigate to="/login" />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <RouteLoading />
  if (!user) return <Navigate to="/login" />
  return user.role === 'admin' ? children : <Navigate to="/dashboard" />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/trips/:id" element={<PrivateRoute><TripDetail /></PrivateRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
