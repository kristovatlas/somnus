import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WarningBanner } from './WarningBanner'

describe('WarningBanner', () => {
  it('renders nothing when no warnings', () => {
    const { container } = render(<WarningBanner warnings={[]} onDismiss={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders warning messages', () => {
    render(<WarningBanner warnings={['Late caffeine', 'High stress']} onDismiss={vi.fn()} />)
    expect(screen.getByText('Late caffeine')).toBeInTheDocument()
    expect(screen.getByText('High stress')).toBeInTheDocument()
  })

  it('has alert role', () => {
    render(<WarningBanner warnings={['Test']} onDismiss={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss clicked', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<WarningBanner warnings={['Test']} onDismiss={onDismiss} />)
    await user.click(screen.getByLabelText('Dismiss warnings'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
