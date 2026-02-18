/** "How to read these results" collapsible section. */

import { useState } from 'react'

export function Explainer() {
  const [open, setOpen] = useState(false)

  return (
    <div className="analysis-explainer" data-testid="analysis-explainer">
      <button
        type="button"
        className="analysis-explainer-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? 'Hide' : 'How to read these results'}
      </button>

      {open && (
        <div className="analysis-explainer-content">
          <p>
            <strong>Correlation</strong> measures how two variables move together.
            A value near +1 means they tend to increase together; near -1 means one
            increases as the other decreases. A value near 0 means no clear pattern.
          </p>
          <p>
            <strong>p-value</strong> indicates how likely it is that the observed
            pattern occurred by chance. Lower values suggest a more reliable
            association (typically p &lt; 0.05).
          </p>
          <p>
            <strong>R²</strong> indicates how much of the variation in an outcome
            is associated with the predictors in the model. Higher is better, but
            real-world sleep data rarely exceeds 0.3-0.5.
          </p>
          <p>
            <strong>Important:</strong> These results show <em>associations</em>,
            not causes. Your data suggests patterns that may be worth exploring, but
            many factors influence sleep. Sample size matters — results with more
            days are more reliable.
          </p>
        </div>
      )}
    </div>
  )
}
