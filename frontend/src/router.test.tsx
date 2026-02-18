import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout/Layout'
import { OnboardingWizard } from './components/Onboarding/OnboardingWizard'
import { DailyLogPage } from './components/DailyLog/DailyLogPage'

const mockSettingsOnboarded = {
  oura_token_set: false,
  typical_bedtime: null,
  target_wake_time: null,
  caffeine_sensitivity: 'normal',
  timezone: 'America/New_York',
  chronotype: null,
  zip_code: null,
  age: null,
  display_mode: 'circadian',
  circadian_mode_start: '20:00:00',
  onboarding_completed: true,
}

const mockSettingsNotOnboarded = {
  ...mockSettingsOnboarded,
  onboarding_completed: false,
}

function createRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <Layout />,
        children: [
          { path: 'onboarding', element: <OnboardingWizard /> },
          { path: 'log/:date', element: <DailyLogPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
}

describe('Router guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('redirects to onboarding when not completed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/api/settings')) {
        return new Response(JSON.stringify(mockSettingsNotOnboarded))
      }
      return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
    })

    const router = createRouter('/log/2024-01-01')
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
  })

  it('redirects to log when onboarding completed and on /onboarding', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/api/settings')) {
        return new Response(JSON.stringify(mockSettingsOnboarded))
      }
      if (urlStr.includes('/api/daily-log/')) {
        return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
      }
      if (urlStr.includes('/api/red-light-panels')) {
        return new Response(JSON.stringify([]))
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })

    const router = createRouter('/onboarding')
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      // Should redirect away from onboarding - should see daily log page elements
      expect(screen.queryByText('Welcome to Somnus')).not.toBeInTheDocument()
    })
  })

  it('shows layout header', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/api/settings')) {
        return new Response(JSON.stringify(mockSettingsOnboarded))
      }
      if (urlStr.includes('/api/daily-log/')) {
        return new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
      }
      if (urlStr.includes('/api/red-light-panels')) {
        return new Response(JSON.stringify([]))
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })

    const router = createRouter('/log/2024-01-01')
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Somnus')).toBeInTheDocument()
    })
  })
})
