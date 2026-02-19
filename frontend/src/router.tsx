import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout/Layout'
import { OnboardingWizard } from './components/Onboarding/OnboardingWizard'
import { DailyLogPage } from './components/DailyLog/DailyLogPage'
import { DashboardPage } from './components/Dashboard/DashboardPage'
import { AnalysisPage } from './components/Analysis/AnalysisPage'
import { RecommendationsPage } from './components/Recommendations/RecommendationsPage'
import { ReportsPage } from './components/Reports/ReportsPage'
import { SettingsPage } from './components/Settings/SettingsPage'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to={`/log/${todayStr()}`} replace /> },
      { path: 'onboarding', element: <OnboardingWizard /> },
      { path: 'log', element: <Navigate to={`/log/${todayStr()}`} replace /> },
      { path: 'log/:date', element: <DailyLogPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'analysis', element: <AnalysisPage /> },
      { path: 'recommendations', element: <RecommendationsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
