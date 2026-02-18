import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingWizard } from './OnboardingWizard'

const mockSettings = {
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
  onboarding_completed: false,
}

function mockFetchResponses() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    if (urlStr === '/api/settings' && (!init || init.method === undefined)) {
      return new Response(JSON.stringify(mockSettings))
    }
    if (urlStr === '/api/settings' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string)
      return new Response(JSON.stringify({ ...mockSettings, ...body }))
    }
    return new Response(JSON.stringify({}), { status: 404 })
  })
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <OnboardingWizard />
    </MemoryRouter>,
  )
}

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders welcome step first', async () => {
    mockFetchResponses()
    renderWizard()
    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
  })

  it('shows progress bar', async () => {
    mockFetchResponses()
    renderWizard()
    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
    expect(document.querySelector('.onboarding-progress-bar')).toBeInTheDocument()
  })

  it('navigates to next step on Get Started click', async () => {
    mockFetchResponses()
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Get Started'))
    expect(screen.getByText('Oura Ring Integration')).toBeInTheDocument()
  })

  it('can navigate back from Oura step', async () => {
    mockFetchResponses()
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Back'))
    expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
  })

  it('can skip Oura step', async () => {
    mockFetchResponses()
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Get Started'))
    await user.click(screen.getByText('Skip'))
    expect(screen.getByText('Sleep Profile')).toBeInTheDocument()
  })

  it('reaches done step after all navigation', async () => {
    mockFetchResponses()
    const user = userEvent.setup()
    renderWizard()
    await waitFor(() => {
      expect(screen.getByText('Welcome to Somnus')).toBeInTheDocument()
    })
    // Welcome → Oura
    await user.click(screen.getByText('Get Started'))
    // Oura → Sleep Profile
    await user.click(screen.getByText('Skip'))
    // Sleep Profile → Tracking Setup
    await user.click(screen.getByText('Next'))
    // Tracking Setup → Data Storage
    await user.click(screen.getByText('Next'))
    // Data Storage → Done
    await user.click(screen.getByText('Next'))
    expect(screen.getByText("You're All Set!")).toBeInTheDocument()
  })

  it('shows loading state while fetching settings', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
    renderWizard()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
