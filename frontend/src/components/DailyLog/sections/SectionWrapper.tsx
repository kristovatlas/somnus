import { useState } from 'react'
import './SectionWrapper.css'

interface SectionWrapperProps {
  title: string
  count?: number
  storageKey: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function SectionWrapper({
  title,
  count,
  storageKey,
  defaultOpen = false,
  children,
}: SectionWrapperProps) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(`somnus-section-${storageKey}`)
    if (stored !== null) return stored === 'true'
    return defaultOpen
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem(`somnus-section-${storageKey}`, String(next))
  }

  return (
    <section className="section-wrapper">
      <button type="button" className="section-header" onClick={toggle} aria-expanded={open}>
        <span className="section-arrow">{open ? '\u25BE' : '\u25B8'}</span>
        <span className="section-title">{title}</span>
        {count != null && count > 0 && <span className="section-count">{count}</span>}
      </button>
      {open && <div className="section-content">{children}</div>}
    </section>
  )
}
