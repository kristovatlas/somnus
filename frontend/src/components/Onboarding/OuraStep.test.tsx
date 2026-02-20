import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OuraStep } from './OuraStep'

vi.mock('../../api/oura', () => ({
  syncOura: vi.fn(() => Promise.resolve({
    synced_count: 0,
    start_date: '2026-02-01',
    end_date: '2026-02-20',
    errors: [],
  })),
}))

import { syncOura } from '../../api/oura'

describe('OuraStep', () => {
  let mockUpdate: ReturnType<typeof vi.fn>
  let mockNext: ReturnType<typeof vi.fn>
  let mockBack: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate = vi.fn(() => Promise.resolve())
    mockNext = vi.fn()
    mockBack = vi.fn()
  })

  it('shows token input when not connected', () => {
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    expect(screen.getByPlaceholderText('Paste your Oura token')).toBeInTheDocument()
  })

  it('shows already configured message when token is set', () => {
    render(
      <OuraStep ouraTokenSet={true} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    expect(screen.getByText('Oura token is already configured.')).toBeInTheDocument()
  })

  it('shows Save & Continue when token entered', async () => {
    const user = userEvent.setup()
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    await user.type(screen.getByPlaceholderText('Paste your Oura token'), 'my-token')
    expect(screen.getByRole('button', { name: 'Save & Continue' })).toBeInTheDocument()
  })

  it('calls onUpdate with token on Save & Continue', async () => {
    const user = userEvent.setup()
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    await user.type(screen.getByPlaceholderText('Paste your Oura token'), 'my-token')
    await user.click(screen.getByRole('button', { name: 'Save & Continue' }))

    expect(mockUpdate).toHaveBeenCalledWith({ oura_token: 'my-token' })
  })

  it('triggers background sync after saving token', async () => {
    const user = userEvent.setup()
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    await user.type(screen.getByPlaceholderText('Paste your Oura token'), 'my-token')
    await user.click(screen.getByRole('button', { name: 'Save & Continue' }))

    await waitFor(() => {
      expect(syncOura).toHaveBeenCalledTimes(1)
    })
  })

  it('advances to next step after saving', async () => {
    const user = userEvent.setup()
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    await user.type(screen.getByPlaceholderText('Paste your Oura token'), 'my-token')
    await user.click(screen.getByRole('button', { name: 'Save & Continue' }))

    await waitFor(() => {
      expect(mockNext).toHaveBeenCalledTimes(1)
    })
  })

  it('does not sync when skipping', async () => {
    const user = userEvent.setup()
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(syncOura).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it('still advances if sync fails', async () => {
    vi.mocked(syncOura).mockRejectedValueOnce(new Error('API error'))

    const user = userEvent.setup()
    render(
      <OuraStep ouraTokenSet={false} onUpdate={mockUpdate} onNext={mockNext} onBack={mockBack} />,
    )
    await user.type(screen.getByPlaceholderText('Paste your Oura token'), 'my-token')
    await user.click(screen.getByRole('button', { name: 'Save & Continue' }))

    await waitFor(() => {
      expect(mockNext).toHaveBeenCalledTimes(1)
    })
  })
})
