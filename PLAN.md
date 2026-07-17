# Somnus — Sleep Optimization App

## Overview

Somnus is a locally-run app that helps users improve their sleep by combining wearable data (Oura Ring) with manual tracking of sleep-affecting habits. It uses statistical analysis (dynamic regression) to identify which behaviors most impact each user's sleep, and provides personalized, science-backed recommendations.

**Stack**: Python (FastAPI) backend + React (Vite + TypeScript) frontend
**Database**: SQLite (local, portable, zero-config)
**Stats**: scipy, statsmodels, numpy, pandas

---

## Architecture

```
somnus/
├── backend/                  # Python FastAPI server
│   ├── main.py               # App entry, CORS, startup
│   ├── database.py           # SQLAlchemy + SQLite setup (configurable DB path)
│   ├── models.py             # DB models (ORM)
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── routers/
│   │   ├── daily_log.py      # CRUD for daily habit entries
│   │   ├── oura.py           # Oura Ring API integration
│   │   ├── analysis.py       # Statistical analysis endpoints
│   │   └── recommendations.py # Recommendation engine
│   ├── services/
│   │   ├── oura_client.py    # Oura API v2 client
│   │   ├── caffeine.py       # Caffeine decay model
│   │   ├── sleep_timing.py   # Chronotype inference, optimal bedtime, social jet lag
│   │   ├── sleep_stages.py   # REM/deep/light targets, deficiency detection
│   │   ├── sunlight.py       # Morning light tracking, solar intensity estimation
│   │   ├── red_light.py      # Red light therapy dose calculation
│   │   ├── nap_analysis.py   # Nap impact on subsequent night's sleep
│   │   ├── seasonal.py       # Daylight hours, season, DST from zip+date
│   │   ├── validation.py     # Input range validation (outlier UI: post-0.1, #53)
│   │   ├── stats_engine.py   # Dynamic regression & correlation
│   │   └── recommender.py    # Recommendation logic
│   ├── science/
│   │   └── reference_data.py # Evidence-based thresholds & guidance
│   └── tests/                # pytest test suite
│       ├── conftest.py       # Fixtures (in-memory DB, mock Oura responses)
│       ├── test_caffeine.py
│       ├── test_sleep_timing.py
│       ├── test_stats_engine.py
│       ├── test_daily_log.py
│       └── ...               # Mirrors backend module structure
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── DailyLog/     # Main data entry form
│   │   │   ├── Dashboard/    # Overview charts & scores
│   │   │   ├── Analysis/     # Stats results & insights
│   │   │   ├── Timeline/     # Historical view with copy-day
│   │   │   ├── Onboarding/   # First-run setup wizard
│   │   │   ├── Reports/      # Weekly/monthly summaries
│   │   │   └── Settings/     # Oura token, preferences, DB path, panels (export UI: post-0.1, #52)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── api/              # API client functions
│   │   └── types/            # TypeScript interfaces
│   ├── __tests__/            # Vitest + React Testing Library
│   └── index.html
├── docs/
│   └── adr/                  # Architecture Decision Records
│       ├── 001-use-sqlite.md
│       ├── 002-fastapi-backend.md
│       ├── 003-missing-data-semantics.md
│       ├── 004-circadian-display-mode.md
│       ├── 005-correlation-not-causation.md
│       ├── 006-git-workflow.md
│       └── ...
├── ARCHITECTURE.md           # C4 diagrams in Mermaid, always current
├── pyproject.toml            # Python dependencies & config
├── README.md
├── Makefile                  # dev, build, run, test, lint, migrate commands
└── alembic/                  # Database migration files
    ├── alembic.ini
    └── versions/
```

---

## Data Model

### SleepRecord (from Oura)
- `date` (PK, date)
- `total_sleep_minutes`, `rem_minutes`, `deep_minutes`, `light_minutes`
- `rem_pct`, `deep_pct`, `light_pct` (computed: stage_min / total_sleep_min × 100)
- `sleep_efficiency` (%)
- `onset_latency_minutes`
- `avg_hrv`, `lowest_hr`, `avg_hr`
- `avg_breath_rate`
- `readiness_score`, `sleep_score`
- `bedtime`, `wake_time`

### DailyLog (user-entered)
- `date` (PK, date)
- `copied_from_date` (nullable — tracks which day was copied)
- `is_sick` (bool, default NULL — flags day for exclusion/covariate in analysis)

### CaffeineEntry (many per day)
- `id`, `date` (FK), `time`, `amount_mg`, `source` (coffee/tea/etc.)

### MealEntry (many per day)
- `id`, `date` (FK), `time`, `is_last_meal` (bool), `notes`

### SupplementEntry (many per day)
- `id`, `date` (FK), `time`, `name`, `dose_mg`
- Predefined supplement catalog: magnesium (threonate/glycinate/etc.), glycine, L-theanine, melatonin, apigenin, zinc, vitamin D, omega-3, tart cherry

### HabitEntry (many per day)
- `id`, `date` (FK), `habit_type` (enum), `time`, `value`, `notes`
- Types: `blue_blockers_on`, `screens_off`, `exercise` (+ intensity/duration), `alcohol` (+ units), `room_temp_f`, `stress_level` (1-5), `sauna` (+ duration), `warm_shower` (+ time)

### StimulatingActivityEntry (many per day)
- `id`, `date` (FK), `end_time` (when they stopped — this is what matters for sleep), `activity_type` (enum), `duration_minutes`
- Types: `tv_movies`, `video_games`, `gripping_audiobook`, `other`
- Key metric for analysis: hours between last stimulating activity and bedtime

### SexualActivityEntry (zero or one per day)
- `id`, `date` (FK), `time`, `type` (enum: `partnered`, `solo_with_content`, `solo_without_content`)
- Tracked because partnered sexual activity and adult content usage may have different (even opposite) effects on sleep quality

### PreBedRitualEntry (many per day)
- `id`, `date` (FK), `time`, `ritual_type` (enum), `duration_minutes`
- Types: `deep_breathing`, `legs_up_wall`, `stretching`, `journaling`, `reading_fiction`, `other`
- These are positive wind-down signals — analysis looks for correlation with faster sleep onset and better efficiency

### NapEntry (many per day)
- `id`, `date` (FK), `start_time`, `end_time`, `duration_minutes`
- Analyzed separately: does this nap correlate with worse/better sleep tonight?

### SunlightEntry (many per day)
- `id`, `date` (FK), `start_time`, `duration_minutes`, `notes`
- `estimated_lux` (auto-populated from weather API if zip code set, user can override)
- First entry of the day is flagged as "first light" for circadian analysis

### RedLightEntry (many per day)
- `id`, `date` (FK), `panel_id` (FK to RedLightPanel), `start_time`, `duration_minutes`
- Dose auto-calculated: `irradiance_mw_cm2 × duration_seconds × 0.001 = joules_cm2`

### RedLightPanel (user-configured presets)
- `id`, `name` (e.g., "Panel #1 - Joovv Go"), `wavelength_nm` (630-850)
- `irradiance_mw_cm2` (power density at rated distance)
- `default_distance_inches`, `notes`
- Users define panels once in settings, then just pick panel + time + duration in daily log

### NSDREntry (many per day)
- `id`, `date` (FK), `time`, `duration_minutes`, `type` (yoga_nidra/body_scan/sleep_hypnosis/other)

### UserSettings
- `oura_token`, `typical_bedtime`, `target_wake_time`, `caffeine_sensitivity` (fast/normal/slow), `timezone`
- `chronotype` (auto-inferred after 30+ days, or user-set: early/intermediate/late)
- `zip_code` (for solar intensity estimation)
- `age` (for age-adjusted sleep stage targets)
- `db_file_path` (user-configurable path for the SQLite database file — allows storing in a VeraCrypt container or encrypted volume for sensitive health data)
- `display_mode` (enum: `circadian` / `light` / `auto`) — auto switches by time of day
- `circadian_mode_start` (time, default 20:00 — when circadian display activates in auto mode)

---

## MVP Features (Phase 1)

### 1. Daily Log — Fast Data Entry UI
The core screen. Optimized for speed.

- **Date selector** at top with left/right arrows, "today" button
- **"Copy previous day"** button — pre-fills from yesterday (or any selected day). User just tweaks what changed. This is critical for reducing friction
- **Caffeine tracker**: Tap to add entries. Quick-add buttons for common amounts (espresso 63mg, drip coffee 95mg, tea 47mg, etc.). Shows running total and estimated blood caffeine at bedtime (using exponential decay model with user's sensitivity setting)
- **Meal timing**: Just need to log last meal time (tap clock or "just now")
- **Supplements**: Toggle switches for user's usual stack. Tap to add, remembers your regulars
- **Habits section**: Blue blockers on-time, screens off time, exercise (quick: light/moderate/intense + time), alcohol units, room temp, stress level (1-5 slider)
- **Naps**: Start time + duration. Quick-add "power nap" (20 min) / "full cycle" (90 min). Warns if after 3 PM
- **Morning sunlight**: Time + duration of first outdoor light exposure. If zip code set, auto-estimates lux from weather data. "Just now" quick button for morning routine
- **Red light therapy**: Pick from user's configured panels, enter time + duration. Dose (J/cm²) auto-calculated and displayed. Can log multiple sessions with different panels
- **NSDR**: Time + duration + type (yoga nidra / body scan / other). Quick-add for common durations (10/20/30 min)
- **Stimulating activities**: Log last TV/movie, video game, gripping audiobook end-time. "Just finished" quick button. Key metric is gap between last stimulation and bedtime
- **Sexual activity**: Discreet toggle. Partnered vs solo, with/without adult content tracked separately (research suggests different sleep effects)
- **Pre-bed rituals**: Toggle/time for deep breathing, legs up the wall, stretching, journaling, reading fiction. Quick-add from user's usual routine
- **Sauna / warm shower**: Time + duration. Sauna and warm showers tracked separately (both promote sleep via thermoregulation but at different intensities)
- **Notes**: Free text field for anything unusual

**Critical UX principle — sparse entry is OK:**
- Every field is optional. An empty field means "not recorded," NOT "didn't happen"
- This is essential for importing historical Oura data without making users backfill weeks of habit data
- The analysis engine treats missing data as NULL, never as zero or false
- Days with only Oura data and no manual entries are valid and expected
- UI never guilt-trips about incomplete days — just shows what's there

### 2. Oura Ring Integration
- Settings page: paste Personal Access Token
- One-click sync: pulls sleep data for date range
- Auto-sync on app launch (last 7 days)
- Shows sync status and last sync time

### 3. Dashboard
- **Today's snapshot**: Last night's sleep score + key metrics (HRV, deep sleep, efficiency)
- **Sleep stage breakdown**: REM / deep / light bar with target zones marked, color-coded (green/yellow/red vs targets)
- **Stage deficiency alerts**: "Deep sleep deficit: 7-day avg 42 min vs 75 min target" with trend arrow
- **Blood caffeine estimator**: Real-time chart showing estimated caffeine level, with a line at bedtime
- **7-day trend**: Sparklines for sleep score, HRV, deep sleep min, REM min
- **Consistency meter**: Rolling 7-day bedtime dots, optimal window band, variance/offset/drift summary
- **Streak tracker**: Consecutive days logged
- **Red light therapy log**: Total weekly dose, session count, streak

### 4. Analysis Engine
After 14+ days of data, progressively unlock insights:

**Missing data semantics (critical):**
- All analysis uses only days where the relevant variable was explicitly recorded
- No entry ≠ zero. No entry = excluded from that variable's analysis
- Correlation/regression for variable X uses only the subset of days where X has a value
- This means different variables may have different effective sample sizes
- UI shows "based on N days of data" for each insight to set expectations
- Minimum threshold per variable: need ≥14 recorded days for correlations, ≥30 for regression

**Phase A — Correlations (14+ days)**:
- Pearson/Spearman correlations between each tracked variable and sleep metrics
- Displayed as a simple ranked list: "Caffeine after 2 PM: moderately negative correlation with sleep score (r = -0.42)"
- Visual correlation matrix heatmap

**Phase B — Dynamic Regression (50+ days)**:
- Full dynamic regression model with lagged variables
- Handles autocorrelation (yesterday's sleep affects today's)
- Coefficient estimates with confidence intervals
- "Your top 3 sleep factors" summary
- Predictions: "If you cut caffeine by noon, model predicts +8% sleep efficiency"

**Phase C — Recommendations (50+ days)**:
- Based on regression results + scientific reference data
- Personalized: "Your data suggests you're caffeine-sensitive. Try stopping by noon for 2 weeks."
- Experiment prompts: "You haven't tried blue-blocking glasses. Research shows they increase melatonin by X%. Want to try for 2 weeks?"
- Track experiment outcomes

### 5. Science-Backed Reference Data

*Contextual tips across the UI descoped from v0.1.0 (#63, 2026-07-16; revisit post-dogfood). The Analysis explainer + evidence pills are built.*

Built into the UI as contextual tips and info icons:

| Factor | Key Threshold | Evidence Level |
|--------|--------------|----------------|
| Caffeine | Stop 8-10h before bed; 400mg+ disrupts sleep even 6h out | Very High |
| Blue light | Block 2-3h before bed; morning blue light beneficial | Very High |
| Last meal | 2-3h before bed minimum | Moderate-High |
| Room temp | 65-68°F (18-20°C) optimal | Very High |
| Alcohol | Any amount disrupts REM in 2nd half of night | Very High |
| Sleep consistency | Regular bed/wake times as important as duration | Very High |
| Sleep timing | Optimal bedtime varies by chronotype; sleep midpoint is key indicator | Very High |
| Social jet lag | >1h weekend drift linked to worse metabolic/cognitive outcomes | High |
| Magnesium | Moderate-high evidence for sleep quality | Moderate-High |
| L-theanine | Improved quality, especially with magnesium | Moderate |
| Glycine | Promising but limited trials | Moderate |
| Melatonin | Best for circadian misalignment, not general insomnia | High (mixed) |
| Apigenin | Limited but promising | Low-Moderate |
| Exercise | Any time beneficial; avoid intense <1h before bed | High |
| Red light therapy | +45 min sleep, +12% efficiency; 5-10 J/cm², evening timing | Moderate-High |
| Morning sunlight | 15-30 min within 30 min of waking; >10,000 lux needed | Very High |
| NSDR | 10-30 min; restores dopamine, reduces cortisol; compensates for lost sleep | Moderate |
| Naps | ≤30 min before 3 PM generally safe; longer/later may hurt nighttime sleep | High |
| Deep sleep targets | 60-100 min (age-adjusted); critical for memory, immune, recovery | Very High |
| REM targets | 90-120 min; critical for emotional regulation, learning | Very High |
| Stimulating activities | Screen-based stimulation close to bed increases arousal, delays onset | Moderate-High |
| Partnered sexual activity | Associated with faster sleep onset and improved quality (oxytocin release) | Moderate |
| Adult content | May increase arousal/stimulation; distinct from partnered activity | Low (understudied) |
| Pre-bed rituals | Deep breathing, legs up wall reduce sympathetic activation | Moderate |
| Sauna | Evening sauna promotes sleep via core temp drop rebound; 80-100°C for 15-20 min | Moderate-High |
| Warm shower/bath | 40-42°C, 10 min, 1-2h before bed; meta-analysis: faster onset | High |

### 6. Sleep Timing Analysis & Chronotype Engine

Sleep timing is tracked automatically via Oura (bedtime/wake time on every SleepRecord), making this a rich, zero-effort data source from day one.

**Metrics computed from Oura data:**
- **Bedtime consistency**: Std deviation of bedtime over rolling 14-day window. Target: <30 min
- **Wake time consistency**: Same for wake time
- **Sleep midpoint**: (bedtime + wake time) / 2 — key chronotype indicator
- **Social jet lag**: Difference in sleep midpoint between weekdays vs weekends (>1h = significant)
- **Time in bed vs total sleep**: Flags if user is spending too long in bed relative to sleep (poor efficiency suggests misaligned timing)

**Chronotype inference (after 30+ days):**
- Cluster analysis on sleep midpoint distribution to estimate natural chronotype
- Compare weekday vs free-day (weekend/vacation) sleep midpoints — free-day midpoint reflects biological preference
- Classify as early (midpoint <2:30 AM), intermediate (2:30-3:30 AM), or late (>3:30 AM) chronotype
- Cross-reference with sleep quality metrics: identify which bedtimes produce the user's best deep sleep %, HRV, and sleep efficiency

**Optimal bedtime window:**
- Regression analysis: bedtime → sleep quality metrics (deep sleep, HRV, efficiency, score)
- Find the bedtime range where sleep quality peaks for this individual
- Display as a "your optimal bedtime window" (e.g., "10:15 PM – 10:45 PM")
- Factor in sleep onset latency: recommend getting into bed [onset_latency] minutes before optimal sleep onset

**Dashboard integration:**
- "Bedtime target" countdown on dashboard ("optimal bedtime in 1h 23m")
- Weekly consistency chart: horizontal bars showing bedtime/wake time spread
- Alert when current streak of consistent timing is broken
- Weekend drift warning when social jet lag exceeds threshold

**Recommendations:**
- "Your best sleep scores occur when you're in bed by 10:30 PM. This week you averaged 11:15 PM."
- "Your weekend sleep is 1.5h later than weekdays — this 'social jet lag' is associated with worse Monday sleep quality."
- "Try keeping your wake time within 30 minutes of your weekday average on weekends."
- If user's actual bedtime consistently differs from their optimal: "Your data suggests your natural chronotype is [X]. Consider shifting your schedule to align."

### 7. Sleep Stage Targets & Deficiency Detection

Track not just total sleep, but whether the user is getting enough of the *right kinds* of sleep.

**Age-adjusted targets (from research):**

| Age Group | Deep Sleep Target | REM Target | Notes |
|-----------|------------------|------------|-------|
| 18-30 | 75-100 min (20%) | 90-120 min (25%) | Peak deep sleep capacity |
| 31-50 | 60-90 min (15-20%) | 90-120 min (22-25%) | Gradual deep sleep decline |
| 51-65 | 45-75 min (12-17%) | 80-110 min (20-22%) | Significant deep sleep reduction |
| 65+ | 30-60 min (10-15%) | 70-100 min (18-20%) | Deep sleep markedly reduced |

**Dashboard integration:**
- Sleep stage breakdown bar (REM / deep / light) with target zones marked
- Color coding: green (in range), yellow (borderline), red (deficient)
- 7-day rolling average for each stage to smooth night-to-night variation
- "Deep sleep deficit" and "REM deficit" alerts when 7-day average falls below target

**Analysis integration:**
- Which tracked variables correlate most with deep sleep specifically? (Often different from overall sleep score factors)
- Which variables correlate most with REM? (Alcohol is a known REM killer — the data should confirm this)
- Separate regression models for: sleep score, deep sleep minutes, REM minutes, HRV
- "Your deep sleep is 40% below target. Your data shows the strongest correlation with [alcohol consumption / late bedtime / etc.]"

### 8. Red Light Therapy Tracking

**Panel configuration (Settings page):**
- User defines their panel(s) once: name, wavelength, irradiance (mW/cm²), default distance
- Example: "Joovv Go — 660nm, 86 mW/cm² at 6 inches"
- Example: "MitoRed MTS — 850nm, 120 mW/cm² at 12 inches"
- Inverse square law adjustment if user changes distance: `adjusted_irradiance = rated_irradiance × (rated_distance / actual_distance)²`

**Daily log entry:**
- Pick panel from dropdown → enter time + duration → dose auto-calculated
- Dose formula: `J/cm² = irradiance_mW_cm² × duration_seconds / 1000`
- Multiple sessions per day supported (different panels, different body areas)
- Display total daily dose

**Science-backed targets:**
- Therapeutic range: 5-50 mW/cm² irradiance
- Optimal dose for sleep: 5-10 J/cm² per session
- Evening timing preferred (2-3h before bed)
- Minimum 3x/week for measurable sleep effects
- Meta-analysis: +45 min total sleep, +12% efficiency with regular use

### 9. Morning Sunlight & Solar Intensity Estimation

*Descoped from v0.1.0 (#54, 2026-07-16) — **high-priority post-0.1**. Nothing is lost permanently: entries are date-stamped, so solar/seasonal covariates are retroactively derivable once built. Manual sunlight logging (below) is built; the estimation pipeline is not. Landing this must pair with analysis-change communication (#92).*

**Tracking:**
- Log first outdoor light exposure: time + duration
- First entry each day auto-tagged as "first light" for circadian analysis
- Target: within 30 min of waking, 15-30 min duration

**Solar intensity estimation (if zip code set):**
- Use Open-Meteo API (free, no key required) for historical weather data by location
- Pull: cloud cover %, solar radiation (GHI in W/m²), sunrise/sunset times
- Estimate effective lux: `base_lux × (1 - cloud_cover_pct × 0.7)` where base_lux varies by solar elevation angle
- Rough lux tiers displayed to user:
  - Clear sky, high sun: 80,000-120,000 lux
  - Clear sky, low sun (early AM): 10,000-40,000 lux
  - Overcast: 5,000-20,000 lux
  - Heavy overcast: 1,000-5,000 lux
- User can override if they know actual conditions differed
- Cache weather data locally to minimize API calls

**For US users:** Can also pull NREL NSRDB data (free) for higher-quality solar irradiance data

**Analysis targets:**
- Correlate morning light timing + estimated intensity with sleep onset latency, sleep score, and bedtime consistency
- "On days you got 20+ min of morning sun within 30 min of waking, your sleep score averaged X% higher"

### 10. NSDR (Non-Sleep Deep Rest) Tracking

**Entry types:** Yoga Nidra, body scan meditation, sleep hypnosis, guided relaxation, other
**Log:** time, duration, type

**Analysis:**
- Correlate NSDR usage with same-night sleep quality
- Correlate with next-day Oura readiness score
- Especially useful on sleep-deprived days: "On days following <6h sleep, NSDR sessions correlated with +X readiness points"
- Track frequency: suggest NSDR on days where prior night sleep was poor

### 11. Nap Impact Analysis

Naps are tracked separately because they have a complex, bidirectional relationship with nighttime sleep.

**Tracking:** start time, duration (or end time)

**Analysis (after 30+ nap data points):**
- Correlate nap occurrence → same-night sleep quality (onset latency, efficiency, total sleep)
- Segment by nap timing: before 1 PM / 1-3 PM / after 3 PM
- Segment by nap duration: <20 min / 20-30 min / 30-60 min / >60 min
- Key question the app answers: "Do YOUR naps help or hurt your sleep?"

**Science-backed defaults (shown before enough personal data):**
- Naps ≤30 min before 3 PM: generally safe, often beneficial for alertness
- Naps >30 min or after 3 PM: may increase sleep onset latency and reduce efficiency
- Late/long naps associated with higher WASO (wake after sleep onset)

**Recommendations:**
- If data shows naps hurting sleep: "Your naps after 2 PM correlate with 15 min longer sleep onset. Consider keeping naps before 1 PM."
- If data shows naps helping: "Your 20-min naps don't appear to affect nighttime sleep. Keep it up."
- If insufficient data: show science-based guidelines with note that personal analysis is building

### 12. Sleep Consistency — Rolling Variance Model

Simple standard deviation isn't enough. We decompose sleep timing consistency into components that have different effects.

**Three-component consistency model:**

1. **Rolling variance (σ)** — 7-day rolling standard deviation of bedtime
   - Low variance (<30 min): Consistent — good
   - Medium variance (30-60 min): Somewhat inconsistent — moderate concern
   - High variance (>60 min): Erratic — strong negative signal
   - This captures: "Am I going to bed at roughly the same time each night?"

2. **Mean offset (δ)** — How far the 7-day rolling mean bedtime is from the user's optimal window
   - On target (within 30 min of optimal): Good
   - Drifting (30-60 min off): Warning
   - Misaligned (>60 min off): Strong negative signal
   - This captures: "I'm consistent, but consistently too late/early"

3. **Weekend drift (Δ)** — Social jet lag metric: weekend mean bedtime minus weekday mean bedtime
   - <30 min: Minimal drift
   - 30-60 min: Moderate (common)
   - >60 min: Significant social jet lag

**Why this matters for analysis:**
- Low variance + on target = best sleep (the goal)
- Low variance + off target = consistent but misaligned (fix timing, not consistency)
- High variance + on target some nights = chaotic; single good nights don't compensate
- The regression model includes ALL THREE as separate predictors to determine:
  - Does consistency matter more than hitting the right time?
  - How much does weekend drift specifically hurt Monday/Tuesday sleep?
  - Is there an interaction effect? (e.g., high variance hurts more when mean is also off target)

**Dashboard visualization:**
- "Consistency meter": rolling 7-day view showing nightly bedtime as dots, optimal window as a band, rolling mean as a line
- Color-coded: green when variance is low AND mean is on target
- Weekly summary: "This week: σ=22 min (consistent), δ=+35 min (slightly late), Δ=45 min (moderate weekend drift)"

### 13. Caffeine Pharmacokinetics Model
Core feature — real-time blood caffeine estimation:

```
remaining_mg = dose_mg × (0.5) ^ (elapsed_hours / half_life)
```

Half-life by user setting:
- Fast metabolizer: 2.5h
- Normal: 4.0h
- Slow metabolizer: 6.0h

Sum all caffeine entries for the day, project to bedtime. Show as a chart.

### 14. Circadian Display Mode

The default display mode. A sleep app should not blast blue/white light at a user logging their bedtime routine at 10 PM.

**Color system — designed to avoid melanopsin-triggering wavelengths:**

| Element | Color | Hex | Rationale |
|---------|-------|-----|-----------|
| Background | Deep dark red/amber | `#1A0500` | Near-black warm base, zero blue emission |
| Primary text | Amber/orange | `#FF8C00` to `#FFB347` | ~590-620nm only, outside melanopsin sensitivity, high contrast |
| Secondary text | Pale warm amber | `#FFD580` | Readable, warm, safe wavelength |
| Accent / links | Light warm red | `#FF6B6B` | Entirely in safe wavelength range |
| Muted text | Soft rose | `#E8A0A0` | Low-key, still readable |
| Borders / dividers | Dark amber | `#3D1A00` | Subtle separation |
| Success indicators | Warm orange | `#FF9933` | Replaces green (green peaks ~520-560nm, partially melanopsin-sensitive) |
| Warning indicators | Deep amber | `#FF6600` | |
| Error indicators | Warm red | `#CC3333` | |
| Charts / data viz | Amber/red palette only | `#FF8C00`, `#CC5500`, `#FF6B6B`, `#FFD580` | No blues, greens, or whites in any chart |

**What is explicitly avoided:**
- White text/backgrounds — full spectrum including blue
- Green — peaks ~520-560nm, partially in melanopsin-sensitive range
- Pure yellow (`#FFFF00`) — on screens this is green + red subpixels, slightly worse than amber
- Any blue or cyan — directly triggers melanopsin

**Display modes:**
- `circadian` (default): Always uses the amber/red palette above
- `light`: Standard light theme for daytime use
- `auto`: Switches to circadian mode based on user-configured time (default 8 PM) or sunset time if zip code is set

**Implementation:**
- CSS custom properties (variables) for all colors, swapped by a single class on `<body>`
- All component styles reference variables, never hardcoded colors
- Chart library configured with circadian-safe color palette
- Smooth transition between modes (0.5s fade)

### 15. Onboarding Flow

First-run experience that sets up the app without overwhelming the user.

**Step 1 — Welcome + basics:**
- Name (optional), age, timezone
- Brief explanation: "Somnus tracks your habits and sleep data to find what works for YOUR sleep"

**Step 2 — Oura connection (optional, skippable):**
- Paste Personal Access Token
- If connected: immediate sync of last 30 days of sleep data
- If skipped: app works fine, user can connect later

**Step 3 — Your sleep profile:**
- Typical bedtime, target wake time
- Caffeine sensitivity: self-assessment with descriptions ("I can drink coffee at 5 PM and sleep fine" → fast / "Coffee after noon keeps me up" → slow)
- Known chronotype (or "not sure — we'll figure it out")

**Step 4 — Your tracking setup (optional, skippable):**
- "What do you currently do?" Checklist: supplements, red light therapy, blue blockers, morning sunlight routine, sauna, NSDR
- For each selected: set up defaults (supplement stack, red light panels, etc.)
- Not selected items still appear in daily log but collapsed

**Step 5 — Data storage:**
- "Where should we store your data?" Default path shown, option to change
- Brief note: "Your data stays 100% local. You can store it in an encrypted container."

**Step 6 — You're set:**
- Show today's daily log, pre-populated with any Oura data
- Quick pointer to the "copy day" feature
- "Log at least 14 days to start seeing correlations. 50 days for full analysis."

### 16. Data Validation & Outlier Handling

*Outlier review UI descoped from v0.1.0 (#53, 2026-07-16) — to be designed together with #20's exclusion generalization post-0.1. Validation/soft-warnings below are built.*

**Input validation — sensible range checks:**

| Field | Valid Range | Soft Warning | Hard Reject |
|-------|------------|--------------|-------------|
| Caffeine per entry | 1-600 mg | >400 mg ("That's a lot — double check?") | >600 mg |
| Caffeine daily total | 0-1200 mg | >600 mg | >1200 mg |
| Nap duration | 1-240 min | >120 min ("Are you sure? This is 2+ hours") | >240 min |
| Room temp | 50-90°F | <60°F or >75°F ("Outside recommended range") | <50°F or >90°F |
| Alcohol units | 0-20 | >6 ("Heavy consumption — impacts REM significantly") | >20 |
| Supplement dose | Varies by supplement | >2x standard dose | >5x standard dose |
| Red light duration | 1-60 min | >30 min | >60 min |
| Exercise duration | 1-300 min | >180 min | >300 min |

Soft warnings show a confirmation but allow entry. Hard rejects prevent saving (likely a typo).

**Outlier detection in analysis:**
- Z-score outlier flagging: data points >3σ from the mean get flagged
- Flagged outliers are shown in the UI with an icon — user decides whether to include/exclude
- Sick days automatically excluded from regression (or included as covariate)
- Analysis results shown both with and without outliers when they meaningfully change conclusions

### 17. Illness Tracking

*Built for v0.1.0: sick-day flag + analysis exclusion. Everything beyond exclusion descoped (#62, 2026-07-16) into the post-0.1 analysis-quality cluster.*

Simple toggle on the daily log: "I was sick today"

**Impact on analysis:**
- Sick days excluded from primary regression models by default
- Alternatively included as a binary covariate (user can toggle in analysis settings)
- Sick day streaks (3+ consecutive) flagged as "illness period" — entire period excluded
- Recovery period (2 days after last sick day) optionally excluded too, since sleep often remains disrupted
- Dashboard shows illness periods as shaded regions on trend charts

### 18. Seasonal & Environmental Confounders

*Descoped from v0.1.0 with #54 (2026-07-16; high-priority post-0.1, retroactively computable). Sick-day exclusion (§17) is the built confounder control in v0.1.*

Derived automatically from zip code + date — zero user effort.

**Variables computed:**
- `daylight_hours`: Photoperiod for the user's latitude on each date
- `season`: Spring/Summer/Fall/Winter (by hemisphere)
- `days_since_dst_change`: Daylight saving transitions disrupt sleep for ~1 week
- `sunrise_time`, `sunset_time`: From Open-Meteo (already fetched for sunlight feature)

**Analysis integration:**
- Season and daylight hours included as covariates in regression models
- Controls for the fact that winter sleep may differ from summer sleep regardless of behavior
- DST transitions flagged — sleep disruption in the week after clock change is expected, not behavioral
- "Your sleep quality drops ~8% in winter months. This is common due to reduced daylight. Morning light exposure appears to partially offset this for you."

### 19. Correlation ≠ Causation Guardrails

Ethical responsibility: users will read statistical associations as causal. We must manage this.

**Language standards:**
- Never use "causes," "makes," "leads to" in analysis results
- Always use: "associated with," "correlated with," "your data suggests," "on days when X, Y tends to be..."
- Every insight includes sample size: "based on 47 days of data"
- Confidence intervals shown visually (not just p-values)

**Persistent explainer:**
- Info icon on every analysis page linking to a brief explainer: "How to read these results"
- Key points: "These are patterns in YOUR data, not proof of cause and effect. Many factors change together. The best way to test a finding is to deliberately change one thing for 2+ weeks and observe the result."
- Experiment feature directly supports this: "Want to test this? Start a 2-week experiment."

**Statistical caveats shown automatically:**
- When sample size is small (<30 days): "Low confidence — collect more data for reliable results"
- When two variables are highly correlated with each other (multicollinearity): "These factors tend to change together in your data, making it hard to isolate which one matters"
- When R² is low: "These factors explain only X% of your sleep variation — other unmeasured factors may matter more"

### 20. Data Export

*Backend endpoints built (JSON / CSV-zip / SQLite). The frontend export UI is descoped from v0.1.0 (#52, 2026-07-16).*

Users own their data. Full portability.

**Export formats:**
- **CSV**: One file per table (sleep_records.csv, caffeine_entries.csv, etc.) in a zip. Standard, works in Excel/Sheets/R/Python
- **JSON**: Full database dump as structured JSON. Machine-readable, preserves relationships
- **SQLite file**: Direct copy of the database file. Complete and lossless

**Export UI:**
- Settings → Export Data → choose format → choose date range (or "all") → download
- API endpoint: `GET /api/export?format=csv&start_date=&end_date=`

### 21. Weekly & Monthly Summary Reports

**Weekly summary (computed on view, always current — defaults to the current ISO week, with ◀ ▶ navigation to prior weeks; accepted for v0.1 in #55, 2026-07-16):**
- Average sleep score, HRV, deep/REM minutes vs prior week
- Trend arrows (up/down/flat) for each metric
- Consistency score for the week (σ, δ, Δ)
- Top positive factor and top negative factor (from correlation data)
- Logging completeness: "You logged 5/7 days this week"

**Monthly report:**
- All weekly metrics averaged
- Month-over-month trends
- Progress toward any active experiments
- "Best night" and "worst night" with contributing factors highlighted
- Sleep stage target compliance: "You hit your deep sleep target on 18/30 nights"

**Delivery:**
- Shown in-app on a Reports tab
- Optionally exportable as a clean HTML/PDF one-pager

### 22. Deployment & Installation

How users actually run this.

**Primary method: pip + make:**
```bash
git clone <repo>
cd somnus
make setup    # Creates venv, installs Python + Node deps
make dev      # Starts backend (port 8000) + frontend (port 5173)
```

**Alternative: Docker Compose** — *descoped from v0.1.0 (#56, 2026-07-16): post-0.1 work, gated on the packaged-build residuals in THREAT_MODEL §7 (same-origin SPA serving, anti-framing header, shipping the alembic scripts).*

**`make` targets:**
- `make setup` — Install all dependencies (Python venv + npm install)
- `make dev` — Run backend + frontend in development mode
- `make test` — Run all tests (backend + frontend)
- `make lint` — Run all linters (ruff, mypy, eslint, prettier)
- `make export-db` — Copy current DB to a specified path
- `make reset-db` — Reset database (with confirmation prompt)

**Database migrations (Alembic):**
- All schema changes managed through Alembic migration files
- `make migrate` — Apply pending migrations
- `make migration MSG="add foo table"` — Auto-generate migration from model changes
- Startup stamps/adopts the DB's alembic revision and warns if migrations are pending; apply them with `make migrate` — which `make dev` runs first (#78), so the dev flow self-heals while startup stays passive (releases still verify migrations against a copy of the real DB first, per 10.5)
- Backward-compatible migrations only — no data loss on upgrade

---

## Future Features (Post-MVP)

### Menstrual Cycle Tracking
Hormonal fluctuations are one of the largest sleep variables for roughly half the population. Progesterone in the luteal phase raises core body temperature and can reduce deep sleep.
- Track cycle phase (follicular, ovulatory, luteal, menstrual) or integrate with period tracking apps
- Include cycle phase as a covariate in regression models
- Surface insights: "Your deep sleep drops ~15% during your luteal phase. This is common and hormonally driven."

### Travel & Timezone Handling
Jet lag is a massive sleep disruptor. When a user travels, Oura data shifts but habits may not.
- Timezone-aware timestamps on all entries
- Jet lag detection: sudden bedtime shift + timezone change
- Recovery tracking: how many days until sleep metrics normalize after travel
- Automatic timezone inference from Oura data (if available) or manual entry
- Analysis excludes or separately models travel adjustment periods

---

## Implementation Plan — Build Order

### Step 0: Architecture & Foundation Docs
- Create ARCHITECTURE.md with C4 diagrams (Mermaid): system context, container, component
- Create initial ADRs: `001-use-sqlite.md`, `002-fastapi-backend.md`, `003-missing-data-semantics.md`, `004-circadian-display-mode.md`
- These are living documents — every subsequent step updates them if architecture changes

### Step 1: Project Scaffolding
- Initialize Python backend with FastAPI, SQLAlchemy, SQLite
- Initialize React frontend with Vite + TypeScript
- Makefile with `make dev`, `make setup`, `make test`, `make lint`, `make migrate`
- Basic CORS config, health check endpoint
- Configure pytest (backend), Vitest + RTL (frontend), Playwright (e2e)
- Pre-commit hooks: ruff, mypy, eslint, prettier
- Configurable DB path: `SOMNUS_DB_PATH` env var or settings, default `~/.somnus/somnus.db`
- Alembic setup for database migrations
- ~~Docker Compose file for alternative deployment~~ (descoped from v0.1.0 → post-0.1, #56)
- **Git setup**: Create `dev` branch from `main`, configure branch protection rules, set up PR template with security checklist
- **CI pipeline**: GitHub Actions running tests, lint, type checks, coverage, pip-audit, bandit, secret scanning on every PR
- **Circadian display mode**: CSS custom property system, three themes (circadian/light/auto), auto-switch by time of day
- **Tests**: health check endpoint test, DB initialization test, migration test

### Step 2: Data Model & API
- Define all SQLAlchemy models (all entry types including: stimulating activities, sexual activity, pre-bed rituals, sauna, warm shower, illness flag)
- Pydantic schemas for request/response — all fields optional (missing ≠ negative)
- Input validation with sensible ranges (soft warnings + hard rejects)
- CRUD endpoints for DailyLog and all sub-entries
- "Copy day" endpoint: POST /api/daily-log/{date}/copy-from/{source_date}
- Date-range query support
- Data export endpoint: `GET /api/export?format=csv|json&start_date=&end_date=`
- **Tests**: model creation, CRUD operations, copy-day logic, nullable field handling, schema validation, range validation, export formats

### Step 3: Onboarding + Daily Log UI
- **Onboarding flow**: Welcome → Oura connection → sleep profile → tracking setup → data storage → done
- Date picker with navigation
- All entry type forms: caffeine, meals, supplements, habits, naps, sunlight, red light, NSDR, stimulating activities, sexual activity, pre-bed rituals, sauna, warm shower, illness toggle
- Copy-day button
- Real-time caffeine decay chart (client-side calculation)
- Input validation with soft warnings (confirmation dialogs) and hard rejects
- All fields skippable — no required fields except date
- Circadian display mode active by default for evening use
- **Tests**: component render tests, form submission, copy-day flow, validation behavior, onboarding completion

### Step 4: Oura Integration
- Oura API v2 client (Personal Access Token auth)
- Sync endpoint: GET /api/oura/sync?start_date=&end_date=
- Settings page for token management + DB path configuration + red light panel setup
- Map Oura response to SleepRecord model
- Bulk historical import (months of data in one sync)
- **Tests**: mock Oura API responses, sync logic, error handling (expired token, rate limits)

### Step 5: Dashboard
- Sleep score + metrics display
- Sleep stage breakdown with age-adjusted targets (green/yellow/red)
- 7-day trend sparklines (use recharts or similar)
- Caffeine projection chart
- Consistency meter (3-component: σ, δ, Δ)
- Logging streak
- Red light therapy weekly summary
- **Tests**: dashboard renders with partial data, handles missing Oura data gracefully

### Step 6: Analysis Engine
- Correlation analysis (scipy.stats)
- Time series stationarity check (ADF test)
- Autocorrelation detection (ACF/PACF)
- Dynamic regression with lagged variables (statsmodels OLS)
- **Multiple regression targets**: separate models for sleep score, deep sleep, REM, HRV
- **Sleep timing analysis**: 3-component consistency model (variance σ, mean offset δ, weekend drift Δ)
- **Chronotype inference** and optimal bedtime window regression
- **Nap impact analysis**: nap timing/duration → same-night sleep quality segmented analysis
- **Stage deficiency detection**: 7-day rolling averages vs age-adjusted targets
- **Seasonal covariates** *(§9/§18, descoped from v0.1.0 → high-priority post-0.1, #54)*: daylight hours, season, DST transitions (auto-derived from zip code + date)
- **Outlier detection**: z-score flagging, sick day exclusion, user-reviewable outlier list
- **Correlation ≠ causation guardrails**: careful language, sample sizes on every insight, multicollinearity warnings, R² context
- Results API endpoint with confidence intervals
- Frontend: ranked factor list, correlation heatmap, coefficient chart, bedtime optimization view, stage target gauges
- **Tests**: statistical correctness (known datasets with expected outputs), outlier detection, missing data handling, seasonal covariate computation

### Step 7: Recommendations
- Rule engine combining regression results + science thresholds
- Experiment suggestion system
- Notification/prompt on dashboard
- **Tests**: recommendation generation with mock analysis results, edge cases (insufficient data, conflicting signals)

### Step 8: Reports & Export
- Weekly summary (computed on view; #55 accepted on-view over a Monday scheduler)
- Monthly report with trends, best/worst nights, target compliance
- Data export: CSV, JSON, raw SQLite — full date range or filtered
- Reports tab in frontend
- **Tests**: report generation with various data completeness levels, export format correctness

### Step 9: Threat Model — Gate Before Any New PRs

**Status: agreed 2026-07-04. Activates once the PRs open on that date (#32, #33, #34, plus the PR introducing this step) are merged. From that point, no new PRs may be opened until this step is complete.** Two exceptions only: PRs that implement this step itself, and fixes for a red `dev` CI run (which preempt everything, per CLAUDE.md).

**COMPLETE 2026-07-09 — the gate is lifted.** 9.1+9.2: `docs/THREAT_MODEL.md` authored and human-approved (PR #42). 9.3: audit finished across PRs #43, #44, #45, #64, #65 — every entry in the 17-threat register carries an implemented mitigation or an explicit acceptance/documented residual; the final sub-item — the T-13 backend lockfile (`uv.lock`) — landed 2026-07-15, closing the register. Review records live under `docs/reviews/` (resolved findings archived in `resolved/`). 9.4: the standing per-PR rule below is wired into CLAUDE.md and the Security Review Process checklist. Normal work resumes.

Somnus holds some of the most sensitive personal data an app can: sexual activity (including adult-content usage), illness, alcohol consumption, the user's nightly sleep schedule, and an Oura token granting access to cloud-stored health data. Security so far has been checklist-driven; this step adds an explicit, human-approved threat model that all future code is written against, to reduce the chance of introducing vulnerabilities.

**9.1 — Author `docs/THREAT_MODEL.md`** (world-class, not boilerplate):
- **Assets**: the SQLite DB (all health/behavioral data + Oura token) at a user-configurable path, data exports, logs, coarse location (zip code), and the analysis outputs themselves
- **Trust boundaries & data flows**: browser ↔ backend (unauthenticated localhost API), backend ↔ Oura / Open-Meteo / NREL, backend ↔ filesystem (configurable DB path, export paths), dev/build/CI supply chain — drawn as Mermaid overlays on the existing ARCHITECTURE.md C4 diagrams
- **Adversary model for a local-first app**: malicious website in the user's browser (CSRF / DNS rebinding against the localhost API), other processes or users on the same machine, compromised dependency or CI action, malicious/compromised external API responses, device theft or loss — with explicit out-of-scope declarations and rationale (e.g., compromise of Oura's cloud itself)
- **Systematic enumeration**: STRIDE-per-element (or an equivalent systematic method) across every component and data flow — the method must make omissions visible, not just catalog known worries
- **Mitigations & residual risks**: every identified threat maps to a concrete mitigation in code/config, a tracked issue, or an explicitly accepted residual risk — nothing silently dropped
- **ADR** documenting the methodology and scope choices
- Canonical living document: the single source of truth for what we defend against, and it must never lag the code — same currency rule as ARCHITECTURE.md, enforced per-PR via the impact statement in 9.4

**9.2 — Human review**: Kristov reviews and approves the threat model. It is not authoritative until human-approved; revise until it is.

**9.3 — Audit existing code against the approved model**: full pass over backend, frontend, CI workflows, and Makefile. *(Historical note: this step's original text also named docker-compose, which never existed — see #56, descoped 2026-07-16.)* Every finding becomes either a fix PR referencing the threat-model section it enforces, or an explicitly documented accepted risk in the doc. Audit report committed under `docs/reviews/`.

- **Done — dependency-install cooldown (T-13, ADR 014):** a ~7-day minimum release age now gates installs in both ecosystems — `min-release-age=7` (days) in `frontend/.npmrc`, with the npm ≥ 11.10 floor enforced via `engines` + `engine-strict`, and top-level `[tool.uv] exclude-newer = "7 days"` committed in `pyproject.toml` — the single cooldown key, gating `uv lock` regeneration and the whole `uv pip` interface (install recipe lives once in `make setup-backend`, which CI runs; `uv`/`npm` pinned so the gating tools don't float). Override for urgent fixes: commit `exclude-newer-package = { <pkg> = "0 days" }` and `uv lock` (see ADR 014 §4 — the `UV_EXCLUDE_NEWER` env var no longer works for the locked backend flow). Done 2026-07-15: backend lockfile `uv.lock` committed and enforced (`uv export --locked` install + CI `uv lock --check`). The other two sub-items landed in PR #65: `npm audit` runs in CI *before* `npm ci` (lockfile-only, audit-before-install), and all Actions are SHA-pinned.

**9.4 — Bake into the workflow**: update CLAUDE.md and the security review checklist (below) so every future PR is written and reviewed with the threat model in consideration — which trust boundaries does this change touch, what new attack surface does it add? From this point on, **every PR description must include a "Threat model impact" section**: either "None" with a one-line justification, or a summary of what changed in the threat picture with `docs/THREAT_MODEL.md` updated in the same PR. The threat model is canonical and must never lag the code — review verifies the stated impact against the actual diff, and a missing or wrong impact statement blocks merge like any failing check. *Done 2026-07-09: CLAUDE.md's temporary gate section replaced with the standing rule; the Security Review Process checklist below carries the threat-model items.*

**Done when**: doc merged and human-approved, all audit findings fixed or explicitly accepted, CLAUDE.md and the PR checklist updated. Then normal work resumes (dogfooding bugs, analysis cluster). *All conditions met 2026-07-09.*

### Step 10: Dogfood & Release v0.1.0

**Purpose**: define what "done" means for the first dev → main release. Per the release-gating agreement (2026-07-03), there is no release until Kristov is happy dogfooding an initial version — this step turns "happy dogfooding" into checkable criteria so the tag actually happens instead of drifting into perfectionism. **Prerequisite: Step 9 fully complete** (the PR gate must be lifted before dogfood bug fixes can flow through normal PRs).

**10.1 — Scope reconciliation**: every PLAN-vs-code gap found while authoring the acceptance checklist is filed on the **v0.1.0 milestone** (filed 2026-07-06: issues #46–#63, plus pre-existing #35 and #41; the annotated list is Part 0 of `docs/releases/v0.1.0-acceptance.md`). The rule: **the milestone must be empty before the dev → main release PR opens** — each issue either closed by a fix, or explicitly descoped by Kristov (moved off the milestone with the rationale recorded on the issue and named in the release notes). 10.1 also includes triaging the pre-existing backlog against the milestone (Part 0.C) — the archetype being the since-closed #16 (wrong avg sleep midpoint: a silently-wrong analysis number, blocker-class under 10.4, fixed by PR #21 yet left open until hand-closed 2026-07-06 — exactly the stale-open pattern 0.C screens for). Headline findings: display-mode setting stored but never applied (#46); silent Daily Log save failures (#35 — likely a blocker); the alembic upgrade path broken three ways — never-stamped fresh installs (#49) plus the `alembic.ini` interpolation crash and missing baseline migration (#68); no data-export UI despite working backend endpoints (#52); seasonal/solar covariates entirely unbuilt (#54). Nothing ships silently half-implemented: it's either in, or it's a named descope.

**10.2 — Fresh-install acceptance pass**: on a clean environment (fresh clone, no `~/.somnus`, stock toolchain), follow README.md literally and note every place it breaks or misleads — known suspects: README says Node 18+ but `engine-strict` requires npm ≥ 11.10; the 7-day dependency cooldown can affect `make setup`. (An earlier draft also suspected `cd somnus` — wrongly: the canonical repo is `kristovatlas/somnus`, so a README-literal clone yields `somnus/`.) Then execute the screen-by-screen walkthrough in `docs/releases/v0.1.0-acceptance.md`, checking off each item as tested. The completed checklist is committed under `docs/releases/` as the acceptance record. Findings are triaged per 10.4.

**10.3 — Dogfood window**: at least **14 consecutive days** of real daily use (guarantees crossing two Mondays). Day 1: bulk Oura historical import (~1 year) so the dashboard, analysis, and monthly report have longitudinal data immediately — only manually-logged variables accumulate slowly. Every day: log the day and sync Oura with no manual step beyond a single "Sync Now" (launch auto-sync is #57 — if it lands during the window, drop even that). The logging UI being fast enough that daily entry doesn't feel like a chore **is a release criterion**, not a nice-to-have — it's the core promise of MVP Feature 1. After each Monday: open the weekly report and verify it correctly summarizes the completed week.

**10.4 — Triage rule**: a finding **blocks the tag** only if it is: data loss/corruption, silently wrong analysis or report numbers, a security regression against `docs/THREAT_MODEL.md`, or a broken core flow (can't complete onboarding, log a day, sync, or view the dashboard). Everything else — polish, awkward UX, wishlist — becomes a post-0.1 backlog issue. Blockers are fixed during the window; the window ends only after **5 consecutive days with no new blockers found**.

**10.5 — Release mechanics**: `dev` CI green; coverage floors met (75% project-wide, 95% critical paths); full suite green including Playwright E2E; ARCHITECTURE.md and README current (README fixes from 10.2 folded in); export artifacts verified by actually opening them; `alembic upgrade head` verified against both an empty DB and a copy of the real dogfood DB (requires closing #49 **and** #68 — stamping, the `alembic.ini` interpolation crash, and a baseline migration) — from v0.1.0 onward, real health data lives in that file and every future release must migrate it. Then: PR `dev` → `main`, merge, tag `v0.1.0`, GitHub release notes summarizing what's in and the named descopes from 10.1.

**Done when**: acceptance checklist fully checked off and committed, the v0.1.0 milestone is empty (every issue fixed or explicitly descoped), dogfood exit criteria met (14+ days, 5 clean final days), no open blockers, Kristov signs off, `v0.1.0` tagged on `main`. From then on, normal iteration on the post-0.1 backlog.

---

## Software Engineering Standards

### Testing Strategy

Inspired by [Google's code coverage best practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html): coverage is a risk-assessment tool, not a checkbox. Low coverage tells you something is untested; high coverage doesn't guarantee quality.

**Targets:**
- **New code per commit**: 90%+ line coverage required
- **Project-wide floor**: 75%+ maintained at all times
- **Critical paths (stats engine, caffeine model, data import)**: 95%+ with edge cases

**Backend (Python — pytest):**
- Unit tests for every service module (caffeine decay, sleep timing, stats engine, etc.)
- Integration tests for API endpoints (FastAPI TestClient)
- Property-based tests for statistical functions (hypothesis library) — verify mathematical invariants
- Fixtures for realistic Oura API responses
- Test database uses in-memory SQLite — fast, isolated, no cleanup

**Frontend (TypeScript — Vitest + React Testing Library):**
- Component tests for all form inputs (daily log entry types)
- Hook tests for data fetching and state management
- Snapshot tests only where layout stability matters (dashboard)
- E2E tests (Playwright) for critical flows: create daily log, copy day, sync Oura

**CI integration:**
- Coverage report generated on every commit
- Coverage diff shown in PR reviews — flag new code below 90%
- Tests must pass before merge (no skipping, no `--no-verify`)

**Test file convention:**
- Backend: `backend/tests/test_<module>.py` mirroring `backend/<module>.py`
- Frontend: `*.test.tsx` co-located with components

### Architecture Documentation

**ARCHITECTURE.md** — maintained at the root of the repo. Contains:
- System context (C4 Level 1): Somnus, user, Oura API, weather APIs
- Container diagram (C4 Level 2): Frontend, Backend, SQLite DB, external APIs
- Component diagram (C4 Level 3): Backend services, routers, data flow
- All diagrams written as Mermaid (`.mmd`) embedded in the markdown
- **Updated with every commit that changes architecture** — if a PR adds a new service, router, or external integration, the architecture diagrams must be updated in the same PR

**ADR (Architecture Decision Records):**
- Stored in `docs/adr/` as numbered markdown files: `001-use-sqlite.md`, `002-fastapi-over-django.md`, etc.
- Format: Title, Status (proposed/accepted/deprecated/superseded), Context, Decision, Consequences
- Created for every significant architectural choice: framework selection, data model design, API patterns, statistical methodology, etc.
- Lightweight — a good ADR is 1 page, not 10

### Code Quality Standards

All code written to senior engineer standards:
- Type hints throughout Python (enforced by mypy in strict mode)
- Strict TypeScript (`strict: true` in tsconfig)
- Pydantic for all API boundaries — no unvalidated dicts
- SQLAlchemy models with proper constraints, indexes, and relationships
- No `# type: ignore` without a comment explaining why
- Linting: ruff (Python), eslint + prettier (TypeScript)
- Pre-commit hooks for formatting and lint checks

### Git Workflow — Relaxed Git Flow

**Branch structure:**
```
main          ← Always reflects a complete, user-ready version (tagged releases)
  └── dev     ← Integration branch; accumulates completed features
       ├── feature/caffeine-model
       ├── feature/oura-sync
       ├── feature/daily-log-ui
       └── fix/outlier-detection
```

**Branch rules:**
- `main` — Protected. Only receives merges from `dev` when a version is fully user-ready. Every merge to `main` is a release (tagged `vX.Y.Z`). Must always build, pass all tests, and represent a coherent, complete state.
- `dev` — Integration branch. Receives merges from feature branches via PR. Should be kept in a working state (tests pass), but may contain in-progress features that aren't yet polished enough for a release.
- `feature/*` — One branch per feature or build step (e.g., `feature/step-1-scaffolding`, `feature/oura-integration`). Branch from `dev`, merge back to `dev` via PR.
- `fix/*` — Bug fix branches. Same flow as feature branches.

**Workflow for a feature:**
1. Branch from `dev`: `git checkout -b feature/caffeine-model dev`
2. Develop, commit often, push to remote
3. Open PR targeting `dev`
4. PR must pass: all tests, lint, type checks, coverage thresholds
5. PR must pass: security review (see below)
6. PR must pass: architecture docs updated if structure changed
7. Merge to `dev` (squash merge preferred for clean history)

**Releasing a version:**
1. Ensure `dev` is stable: all tests pass, all planned features for this version are merged
2. Open PR from `dev` → `main`
3. Final review: full test suite, security scan, manual smoke test
4. Merge to `main`, tag as `vX.Y.Z`
5. Update CHANGELOG.md

**Versioning:** Semantic versioning (`MAJOR.MINOR.PATCH`)
- `0.x.y` during initial development (pre-1.0)
- MAJOR: Breaking changes to data model or API
- MINOR: New features
- PATCH: Bug fixes

### Security Review Process

Every PR must pass a security review before merge. This is a health data application — security is non-negotiable.

**Threat model**: `docs/THREAT_MODEL.md` (authored and human-approved in build-order Step 9; standing rule in force since 2026-07-09) is the canonical statement of what we defend against, and it must never lag the code. Every PR description must include a **"Threat model impact"** section — either "None" with a one-line justification, or a summary of what changed with the threat model updated in the same PR. Every review below additionally verifies the stated impact against the actual diff; a missing or incorrect impact statement blocks merge.

**Automated checks (CI, run on every PR):**
- **Dependency audit**: `pip-audit` (Python) + `npm audit` (Node) — flag known vulnerabilities in dependencies
- **Static analysis**: `bandit` (Python) for common security issues (hardcoded secrets, SQL injection patterns, unsafe deserialization)
- **Secret scanning**: `gitleaks` — prevent accidental commit of API tokens, credentials, or keys
- **SAST**: Python is covered by `bandit` + ruff's `S` (flake8-bandit) and `T20` rule sets. *Frontend SAST (e.g. eslint-plugin-security) is planned, not wired* — today the frontend relies on TS strict + eslint core, output escaping (T-04), and the SPA CSP (T-14).

**Manual review checklist (reviewer verifies on every PR):**

*Threat model (`docs/THREAT_MODEL.md`, per its §8):*
- [ ] "Threat model impact" section present in the PR description and consistent with the actual diff; `THREAT_MODEL.md` updated in the same PR if the threat picture changed
- [ ] Trust boundaries the change touches are identified (B1–B5) with the affected threats (T-nn)
- [ ] No new unauthenticated network reachability without Host validation (T-01)
- [ ] State-changing endpoints keep a CORS-non-simple trait (JSON body or `require_json_content_type`); GETs never commit (T-02)
- [ ] No user or external text reaches an HTML or CSV sink without escaping/neutralization (T-04, T-12)
- [ ] No secrets or health data in logs (T-16)

*Data handling:*
- [ ] No sensitive data (Oura tokens, health data) logged to console or files
- [ ] Oura token stored only in SQLite DB at user-configured path, never in config files, env vars on disk, or browser storage
- [ ] All user input validated and sanitized before DB insertion (Pydantic + SQLAlchemy parameterized queries)
- [ ] No raw SQL — all queries through SQLAlchemy ORM (prevents SQL injection)
- [ ] Export endpoints validate date ranges and don't expose filesystem paths

*API security:*
- [ ] No endpoints expose data without appropriate access (local-only app, but defense in depth)
- [ ] CORS restricted to localhost origins only
- [ ] No external network calls except explicitly whitelisted APIs (Oura, Open-Meteo, NREL)
- [ ] External API responses validated before processing (no blind trust of JSON shape)

*Frontend:*
- [ ] No `dangerouslySetInnerHTML` or equivalent unless absolutely necessary and sanitized
- [ ] No user-supplied data rendered as HTML without escaping
- [ ] No secrets or tokens in frontend code or local storage

*Dependencies:*
- [ ] New dependencies justified — prefer stdlib/existing deps over adding new ones
- [ ] No dependencies with known critical vulnerabilities
- [ ] Pinned versions in lock files (no floating ranges for security-sensitive packages)

**Security-sensitive areas (require extra scrutiny):**
- Any change to `database.py`, migration files, or the DB path configuration
- Any change to `oura_client.py` or external API integrations
- Any change to the export endpoint
- Any change to `backend/security.py`, CORS/Host validation, or a CSP
- Any new dependency addition

---

## Key Design Decisions

1. **SQLite** — Zero config, portable, single file. Users can back up by copying one file. Sufficient for single-user time series data.

2. **Caffeine model on both client and server** — Client-side for real-time chart updates as user adds entries; server-side for analysis.

3. **Progressive analysis unlock** — Don't show empty/unreliable stats. 14 days → correlations, 50 days → regression. Clear messaging about confidence levels.

4. **Copy-day as first-class feature** — Most people's habits are similar day to day. Copying yesterday and tweaking 1-2 things should be the primary workflow.

5. **Personal Access Token for Oura** — Simpler than OAuth for a local single-user app. User generates token at cloud.ouraring.com.

6. **Supplement catalog** — Predefined list of evidence-backed supplements with dosage units. Users pick from list rather than free-typing, which enables analysis.

7. **Configurable database path** — User can set a custom file path for the SQLite database (e.g., inside a VeraCrypt container). Default: `~/.somnus/somnus.db`. Sensitive health data stays where the user wants it.

8. **Missing data ≠ negative data** — The most important data modeling decision. An empty field means "not recorded," never "didn't happen." Analysis only uses days with explicit values for each variable. This makes historical Oura import painless and prevents the app from feeling like a chore.

9. **Architecture docs as code** — ARCHITECTURE.md with Mermaid C4 diagrams and ADRs in `docs/adr/` are updated with every commit that changes structure. These aren't afterthoughts — they're part of the definition of done.

10. **Circadian display mode as default** — Deep amber/red color palette (#1A0500 background, #FF8C00 text) that avoids melanopsin-triggering wavelengths. No white, no green, no pure yellow. A sleep app should practice what it preaches.

11. **Alembic for all schema changes** — Every data model change goes through a migration, applied explicitly with `make migrate` (startup stamps fresh/legacy DBs and warns when behind — it never runs migration DDL itself). No manual SQL, no "just delete the DB." Users' data survives every upgrade.

12. **Correlation ≠ causation, always** — Analysis language never says "causes." Every insight shows sample size and confidence. Persistent explainer accessible from every analysis view. The experiment feature is the path from correlation to confidence.

13. **Sick days as first-class concept** — Illness demolishes sleep metrics. One toggle excludes the day from regression so a bout of flu doesn't corrupt months of analysis.

14. **Seasonal covariates for free** *(descoped from v0.1.0 → high-priority post-0.1, #54)* — Daylight hours, season, and DST transitions auto-derived from zip code + date. Zero user effort, removes a major confounder from the analysis.

15. **Relaxed git flow** — Feature branches → `dev` → `main`. `main` always reflects a complete, user-ready release. No half-baked features on main, ever.

16. **Security review on every PR** — Automated (pip-audit, bandit, secret scanning) + manual checklist. This is a health data app handling sensitive personal information. No exceptions.