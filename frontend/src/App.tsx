import { useEffect, useState } from 'react'

interface HealthStatus {
  status: string
  version: string
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch(() => setError('Backend not reachable'))
  }, [])

  return (
    <div>
      <h1>Somnus</h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>Sleep optimization, powered by your data</p>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
        }}
      >
        {error && <p style={{ color: 'var(--color-error)' }}>{error}</p>}
        {health && (
          <p>
            Backend: <span style={{ color: 'var(--color-success)' }}>{health.status}</span> (v
            {health.version})
          </p>
        )}
        {!health && !error && (
          <p style={{ color: 'var(--color-text-muted)' }}>Connecting to backend...</p>
        )}
      </div>
    </div>
  )
}

export default App
