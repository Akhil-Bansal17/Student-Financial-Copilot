import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { MorePage } from '@/pages/MorePage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OnboardingPage } from '@/pages/OnboardingPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Main Application Shell Routes */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/more" element={<MorePage />} />
      </Route>

      {/* Auth & Onboarding Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Fallback to Dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
