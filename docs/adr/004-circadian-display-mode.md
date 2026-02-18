# ADR 004: Circadian-Safe Display Mode as Default

## Status
Accepted

## Context
Somnus is a sleep optimization app that users interact with in the evening — logging bedtime habits, reviewing tomorrow's plan, checking their caffeine projection. Standard UI color schemes (white backgrounds, blue links, green indicators) emit wavelengths in the 446–520nm range that trigger melanopsin receptors in the eye and suppress melatonin production.

A sleep app that disrupts sleep through its own UI is self-defeating.

## Decision
The default display mode is "circadian" — a carefully chosen palette of deep amber, red, and orange colors that emit only wavelengths above 590nm, outside the melanopsin-sensitive range.

**Color palette:**
- Background: `#1A0500` (near-black warm base)
- Primary text: `#FF8C00` to `#FFB347` (amber, ~590–620nm)
- Secondary text: `#FFD580` (pale warm amber)
- Accents: `#FF6B6B` (warm red)
- Muted text: `#E8A0A0` (soft rose)
- Borders: `#3D1A00` (dark amber)
- Success: `#FF9933` (warm orange, replaces green)
- Warning: `#FF6600`, Error: `#CC3333`

**Explicitly avoided:**
- White (full spectrum including blue)
- Green (peaks ~520–560nm, partially melanopsin-sensitive)
- Pure yellow `#FFFF00` (green + red subpixels on screens)
- Any blue or cyan

**Three modes available:**
- `circadian` (default): Always uses the safe palette
- `light`: Standard light theme for daytime
- `auto`: Switches based on user-configured time (default 8 PM) or sunset

**Implementation:** CSS custom properties on `<body>`, swapped by a single class. All components reference variables, never hardcoded colors.

## Consequences
**Positive:**
- The app practices what it preaches — no circadian disruption from evening use
- Distinctive visual identity — immediately recognizable, memorable
- Auto mode makes it seamless for users who access the app at different times

**Negative:**
- Reduced color palette limits data visualization options (no blue/green in charts)
- Amber-on-dark-red has lower contrast than black-on-white — must test for accessibility (WCAG)
- Some users may find the dark red aesthetic unusual at first
- Chart libraries need custom color configuration to avoid default blue/green palettes
