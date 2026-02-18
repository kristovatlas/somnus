# ADR 005: Correlation ≠ Causation Guardrails in All Analysis Output

## Status
Accepted

## Context
Somnus uses statistical analysis (correlations, dynamic regression) to identify patterns between user behavior and sleep quality. Users will naturally interpret these findings causally: "caffeine hurts my sleep" rather than "caffeine intake is associated with lower sleep scores in my data."

This is an n-of-1 observational study with no randomization, no blinding, and many confounders. Even with regression controls, we cannot establish causation from this data alone. Overstating findings could lead users to make misguided changes or develop false confidence.

## Decision
All analysis output in Somnus uses carefully chosen language and includes contextual caveats.

**Language rules:**
- Never use: "causes," "makes," "leads to," "results in," "improves," "worsens"
- Always use: "associated with," "correlated with," "your data suggests," "on days when X, Y tends to be..."
- Every insight includes its sample size: "based on 47 days of data"

**Contextual caveats (shown automatically):**
- Small sample (<30 days): "Low confidence — collect more data for reliable results"
- Multicollinearity detected: "These factors tend to change together, making it hard to isolate effects"
- Low R²: "These factors explain only X% of variation — unmeasured factors may matter more"

**Persistent explainer:**
- Accessible via info icon on every analysis page
- Explains what correlations mean, what they don't mean, and how to test findings
- Directs users to the experiment feature for deliberate A/B testing

## Consequences
**Positive:**
- Users develop accurate mental models of what the data shows
- Reduces risk of harmful behavior changes based on statistical artifacts
- The experiment feature provides a principled path from correlation to confidence
- Builds trust — users appreciate honesty over hype

**Negative:**
- Hedging language is less exciting than "X causes Y" — may feel less actionable to some users
- Sample size warnings may frustrate early users who want immediate insights
- Some statistical caveats (multicollinearity, R²) may confuse non-technical users — mitigated by plain-language explanations
