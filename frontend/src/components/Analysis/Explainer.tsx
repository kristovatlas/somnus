/** "How to read these results" collapsible section. */

import { useState } from "react";

export function Explainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="analysis-explainer" data-testid="analysis-explainer">
      <button
        type="button"
        className="analysis-explainer-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Hide" : "How to read these results"}
      </button>

      {open && (
        <div className="analysis-explainer-content">
          <p>
            <strong>Correlation</strong> measures how two variables move
            together. A value near +1 means they tend to increase together; near
            -1 means one increases as the other decreases. A value near 0 means
            no clear pattern.
          </p>
          <p>
            <strong>p-value</strong> measures how surprising your data would be
            if there were no real association — the lower, the harder the
            pattern is to explain away as luck. Typically p &lt; 0.05 is
            considered &quot;statistically significant.&quot;
          </p>
          <p>
            <strong>R²</strong> is the share of night-to-night variation in an
            outcome that the model&apos;s factors can account for: 0.0 means
            they explain nothing, 1.0 means they explain everything. Sleep is
            noisy — even a genuinely useful model usually lands around 0.3–0.5,
            so don&apos;t expect values near 1.
          </p>
          <p>
            <strong>Bedtime (hour)</strong> uses a continuous evening clock so
            that after-midnight bedtimes count as <em>later</em>, not earlier:
            11:30 PM is 23.5 and 12:30 AM is 24.5. Other late-evening times
            (last caffeine, last meal, and last stimulating activity after
            midnight) now count as 24+ too, so their correlations may shift
            slightly if you have after-midnight entries. Windows labeled
            &quot;7d&quot; are approximately the last week of recorded data
            (calendar days on the Dashboard; the last 7 recorded nights here).
          </p>
          <p>
            <strong>Important:</strong> These results show <em>associations</em>
            , not causes. Your data suggests patterns that may be worth
            exploring, but many factors influence sleep. Sample size matters —
            results with more days are more reliable.
          </p>
        </div>
      )}
    </div>
  );
}
