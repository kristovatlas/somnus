import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { OuraSection } from './OuraSection'
import type { UserSettingsOut, UserSettingsUpdate } from '../../types'

const baseSettings: UserSettingsOut = {
  oura_token_set: false,
  typical_bedtime: '22:30:00',
  target_wake_time: '06:30:00',
  caffeine_sensitivity: 'normal',
  timezone: 'America/New_York',
  chronotype: 'intermediate',
  zip_code: null,
  age: 30,
  display_mode: 'circadian',
  circadian_mode_start: '20:00:00',
  onboarding_completed: true,
  last_oura_sync: null,
}

describe('OuraSection', () => {
  let mockUpdate: Mock<(data: UserSettingsUpdate) => Promise<UserSettingsOut>>

  beforeEach(() => {
    vi.restoreAllMocks()
    mockUpdate = vi.fn<(data: UserSettingsUpdate) => Promise<UserSettingsOut>>()
      .mockResolvedValue({ ...baseSettings, oura_token_set: true })
  })

  it('shows token input when not connected', () => {
    render(<OuraSection settings={baseSettings} onUpdate={mockUpdate} />)
    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Paste your Oura PAT here')).toBeInTheDocument()
  })

  it('save button disabled when input empty', () => {
    render(<OuraSection settings={baseSettings} onUpdate={mockUpdate} />)
    expect(screen.getByText('Save')).toBeDisabled()
  })

  it('calls onUpdate with token when saved', async () => {
    const user = userEvent.setup()
    render(<OuraSection settings={baseSettings} onUpdate={mockUpdate} />)

    await user.type(screen.getByPlaceholderText('Paste your Oura PAT here'), 'my-token')
    await user.click(screen.getByText('Save'))

    expect(mockUpdate).toHaveBeenCalledWith({ oura_token: 'my-token' })
  })

  it('shows sync button when connected', () => {
    const connected = { ...baseSettings, oura_token_set: true }
    render(<OuraSection settings={connected} onUpdate={mockUpdate} />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Sync Now')).toBeInTheDocument()
  })

  it('shows remove token button when connected', () => {
    const connected = { ...baseSettings, oura_token_set: true }
    render(<OuraSection settings={connected} onUpdate={mockUpdate} />)
    expect(screen.getByText('Remove Token')).toBeInTheDocument()
  })

  it('calls onUpdate with null token when removed', async () => {
    const user = userEvent.setup()
    const connected = { ...baseSettings, oura_token_set: true }
    mockUpdate.mockResolvedValue({ ...baseSettings, oura_token_set: false })
    render(<OuraSection settings={connected} onUpdate={mockUpdate} />)

    await user.click(screen.getByText('Remove Token'))
    expect(mockUpdate).toHaveBeenCalledWith({ oura_token: null })
  })

  it('shows last sync timestamp', () => {
    const connected = {
      ...baseSettings,
      oura_token_set: true,
      last_oura_sync: '2026-02-15T12:00:00Z',
    }
    render(<OuraSection settings={connected} onUpdate={mockUpdate} />)
    expect(screen.getByText(/Last sync:/)).toBeInTheDocument()
  })

  it('shows sync result after successful sync', async () => {
    const user = userEvent.setup()
    const connected = { ...baseSettings, oura_token_set: true }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        synced_count: 5,
        start_date: '2026-02-10',
        end_date: '2026-02-15',
        errors: [],
      })),
    )

    render(<OuraSection settings={connected} onUpdate={mockUpdate} />)
    await user.click(screen.getByText('Sync Now'))

    await waitFor(() => {
      expect(screen.getByText(/Synced 5 day\(s\)/)).toBeInTheDocument()
    })
  })

  it('shows error on sync failure', async () => {
    const user = userEvent.setup()
    const connected = { ...baseSettings, oura_token_set: true }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 }),
    )

    render(<OuraSection settings={connected} onUpdate={mockUpdate} />)
    await user.click(screen.getByText('Sync Now'))

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument()
    })
  })
})
