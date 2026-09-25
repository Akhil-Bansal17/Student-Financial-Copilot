import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PublicRoute } from '@/components/auth/PublicRoute'
import { DashboardPage } from '@/pages/DashboardPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { MorePage } from '@/pages/MorePage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OnboardingPage } from '@/pages/OnboardingPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Protected Main Application Shell Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/more" element={<MorePage />} />
        </Route>
        {/* Protected Onboarding Flow */}
        <Route element={<AuthLayout />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
      </Route>

      {/* Guest-only Auth Routes (redirects to / if authenticated) */}
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      {/* Fallback to Dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
