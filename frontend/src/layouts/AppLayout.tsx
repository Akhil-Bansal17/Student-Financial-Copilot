import { Outlet, useLocation } from 'react-router-dom'
import { DesktopSidebar } from '@/components/layout/DesktopSidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'

const routeTitles: Record<string, string> = {
  '/': 'Financial Overview',
  '/activity': 'Activity & Transactions',
  '/insights': 'Spending Insights',
  '/goals': 'Savings Goals',
  '/more': 'Settings & Preferences',
}

export function AppLayout() {
  const location = useLocation()
  const currentTitle = routeTitles[location.pathname]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased overflow-x-hidden">
      {/* Desktop Sidebar (Left) */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Header title={currentTitle} />

        {/* Scrollable Page Body */}
        {/* pb-24 on mobile ensures bottom navigation doesn't clip page content */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed at bottom on phones) */}
      <BottomNav />
    </div>
  )
}
