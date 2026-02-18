import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CopyDayButton } from './CopyDayButton'

describe('CopyDayButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows trigger button initially', () => {
    render(<CopyDayButton targetDate="2024-06-15" onCopied={vi.fn()} />)
    expect(screen.getByText('Copy from another day')).toBeInTheDocument()
  })

  it('shows date picker on click', async () => {
    const user = userEvent.setup()
    render(<CopyDayButton targetDate="2024-06-15" onCopied={vi.fn()} />)
    await user.click(screen.getByText('Copy from another day'))
    expect(screen.getByText('Copy entries from:')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('hides picker on cancel', async () => {
    const user = userEvent.setup()
    render(<CopyDayButton targetDate="2024-06-15" onCopied={vi.fn()} />)
    await user.click(screen.getByText('Copy from another day'))
    await user.click(screen.getByText('Cancel'))
    expect(screen.getByText('Copy from another day')).toBeInTheDocument()
  })

  it('calls API on copy and invokes callback', async () => {
    const mockLog = { date: '2024-06-15', caffeine_entries: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockLog)),
    )
    const onCopied = vi.fn()
    const user = userEvent.setup()
    render(<CopyDayButton targetDate="2024-06-15" onCopied={onCopied} />)
    await user.click(screen.getByText('Copy from another day'))
    await user.click(screen.getByText('Copy'))
    await waitFor(() => {
      expect(onCopied).toHaveBeenCalledWith(mockLog)
    })
  })

  it('shows error on copy failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Source daily log not found' }), { status: 404 }),
    )
    const user = userEvent.setup()
    render(<CopyDayButton targetDate="2024-06-15" onCopied={vi.fn()} />)
    await user.click(screen.getByText('Copy from another day'))
    await user.click(screen.getByText('Copy'))
    await waitFor(() => {
      expect(screen.getByText('Source daily log not found')).toBeInTheDocument()
    })
  })
})
