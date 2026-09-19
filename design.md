# Design System — Clean iOS-Inspired Product UI

## 1. Purpose

This document defines the visual and interaction system for the product.

The goal is to make the application feel like a **real, mature, production-ready digital product** rather than a generic AI-generated SaaS interface.

The visual language is inspired by modern iOS financial and social products: clean surfaces, strong typography, disciplined spacing, compact native-like controls, restrained color, and data-first composition.

The intended feeling is:

- clean
- quiet
- precise
- premium
- native-like
- fast
- intentional
- friendly
- production-ready

Avoid anything that feels:

- futuristic for the sake of it
- cyberpunk
- overly “AI-designed”
- glassmorphic
- like a SaaS template
- like a Dribbble concept
- like a fake mobile mockup

This is a **real responsive web application**, not a visual concept.

---

## 2. Core Design Principle

> **The information is the design.**

Do not rely on decorative containers, large gradients, glow, or excessive cards to create hierarchy.

Hierarchy should primarily come from:

1. layout
2. spacing
3. typography
4. alignment
5. color
6. grouping
7. interaction states
8. decoration, only when necessary

If something looks empty, improve the composition before adding visual noise.

---

## 3. Visual Reference Language

The visual direction combines three recurring interface patterns.

### 3.1 Leaderboard / ranking pattern

The ranking interface uses:

- very light gray page background
- minimal top navigation
- text tabs with a thin underline for the active state
- one prominent white summary card
- compact pill filters for categories
- compact time-range segmented controls
- list rows without individual cards
- square avatars with slightly rounded corners
- bold names and muted secondary labels
- green financial values aligned to the right
- small verification/status badges

A typical row should visually read as:

```text
[#] [avatar]  Primary name                +$120,000.84
              Secondary handle            secondary metadata
```

The key rule is that **rows live directly on the page surface**. They are not each wrapped in a card.

---

### 3.2 Profile / portfolio pattern

The profile view combines identity and financial information.

Typical structure:

```text
cover / visual header
profile identity
social metadata
financial metric
chart
cash balance
open positions
```

Visual traits:

- optional cover area at the top
- large user name
- verified badge placed close to identity
- accent-colored username or handle
- muted biography text
- inline metadata with small icons
- thin divider between identity and finance
- large primary balance value
- compact time range selector
- one simple smooth line chart
- balance rows and positions directly on the page
- financial changes in green or red
- simple text link such as “Show all” instead of another card/button

The chart should feel embedded into the page rather than placed inside a dashboard widget.

---

### 3.3 Home / balance pattern

The home view emphasizes a main balance or account object.

Typical structure:

```text
main navigation
primary account / balance surface
primary actions
secondary portfolio surface
secondary content
```

Visual traits:

- clean top tab navigation
- white and off-white surfaces
- one large primary balance card
- large financial number
- two clear secondary action buttons
- one visually emphasized primary action
- optional product imagery only when it serves real content
- very soft shadows
- restrained use of the accent color

A single component may have more visual personality, but the rest of the interface should remain quiet.

---

## 4. Anti-“AI Slop” Rules

Actively remove the following patterns unless there is a clear product reason for them:

- generic purple/blue gradients
- gradient text
- glassmorphism everywhere
- backdrop blur without purpose
- giant radial blobs
- oversized glow effects
- neon borders
- bento grids used by default
- feature cards for every piece of content
- cards nested inside cards
- excessive pills
- rounded-full everywhere
- icons always placed inside circles
- large decorative hero sections
- generic marketing copy blocks
- huge unused vertical gaps
- background grids
- dot patterns
- animated particles
- custom cursor effects
- mouse-follow glows
- floating cards
- constant parallax
- 3D icons
- excessive badges
- unnecessarily dramatic shadows
- over-designed empty states

When in doubt, **remove before adding**.

---

## 5. Color System

Use a restrained light-mode palette.

```css
:root {
  --background: #f6f6f5;
  --surface: #ffffff;
  --surface-secondary: #f1f1f1;
  --surface-tertiary: #ebebeb;

  --text-primary: #0b0b0b;
  --text-secondary: #858585;
  --text-tertiary: #adadad;

  --border: rgba(0, 0, 0, 0.06);

  --accent: #836EF9; /* Monad Brand Purple */
  --accent-primary: #6e4ef4; /* Deep Purple for Connect & Actions */
  --positive: #14cf1c;
  --negative: #ff3b30;

  --shadow-soft: 0 2px 10px rgba(0, 0, 0, 0.035);
}
```

### Accent usage

The Monad purple accent color (`--accent: #836EF9` / `--accent-primary: #6e4ef4`) is reserved for high-signal brand identity elements:

- brand logo mark background
- primary wallet Connect button
- active navigation tab indicators
- verified status markers and high-priority action triggers

Do not use the accent as a background color for entire sections unless the product truly requires it.

### Financial state colors

Use:

- `--positive` for gains
- `--negative` for losses or destructive/error states

Do not use green decoratively.

---

## 6. Typography

Use a system font stack that approximates SF Pro behavior on Apple platforms while remaining consistent elsewhere.

```css
font-family:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Display",
  "SF Pro Text",
  "Helvetica Neue",
  Arial,
  sans-serif;
```

### Preferred weights

Use primarily:

- 400 — regular
- 500 — medium
- 600 — semibold
- 700 — bold

Avoid excessive use of 800 or 900.

### Type scale

| Role | Size | Weight |
|---|---:|---:|
| Page title | 28–36px | 600 |
| Major financial metric | 40–64px | 600 |
| Section title | 18–22px | 600 |
| Card title | 15–18px | 600 |
| Body | 15–17px | 400 |
| Metadata | 13–15px | 400–500 |
| Micro label | 12–13px | 500 |

### Rules

- avoid tracking-heavy text
- avoid uppercase except for small labels when justified
- avoid oversized hero typography
- keep line-height comfortable
- use `font-variant-numeric: tabular-nums` for changing financial values

---

## 7. Spacing

Use a consistent spacing scale.

```text
4
8
12
16
20
24
32
40
48
64
```

### Mobile

Main horizontal page padding:

```text
16–20px
```

### Desktop

Typical content padding:

```text
24–40px
```

### Grouping rule

Related items should be close together.

Sections should breathe, but avoid defaulting to massive gaps such as 80–120px between every block.

---

## 8. Radius System

Use radius intentionally.

| Use | Radius |
|---|---:|
| tiny controls | 8px |
| square avatars | 10–12px |
| inputs | 12–14px |
| buttons | 14–16px |
| compact cards | 18–20px |
| major cards | 24–30px |
| true pills only | 999px |

Do not use `rounded-full` indiscriminately.

---

## 9. Shadows and Borders

### Standard border

```css
border: 1px solid rgba(0, 0, 0, 0.055);
```

Use borders only when they improve separation.

Prefer differences in surface color whenever possible.

### Standard soft shadow

```css
box-shadow:
  0 1px 2px rgba(0, 0, 0, 0.02),
  0 4px 12px rgba(0, 0, 0, 0.025);
```

The interface should still look correct if most shadows are removed.

Avoid:

- `shadow-xl`
- `shadow-2xl`
- heavy black shadows
- permanent glow around every card

---

## 10. Surfaces and Cards

Use cards only for meaningful groups.

A normal surface can be:

```css
.surface {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow-soft);
}
```

### Good use of cards

- account balance
- payment method
- important summary
- promotional content
- settings group

### Avoid cards for

- every list row
- every metric
- every icon
- every label/value pair
- every navigation section

The design should not become:

```text
card
  card
    card
      chip
      chip
      button
```

---

## 11. Buttons

### Primary

```text
height: 44–50px
background: #6e4ef4 (Monad purple) or #0a0a0a
text: white
radius: 14–20px
font-weight: 600
```

### Secondary

```text
background: #f1f1f1
text: #111
```

### Ghost

```text
background: transparent
```

### Required states

All buttons need:

- hover
- active
- focus-visible
- disabled

Transitions should be subtle.

Do not give every button a shadow.

---

## 12. Navigation

### Desktop

Use a simple horizontal navigation when appropriate.

Example:

```text
Logo      Home   Portfolio   Activity   Discover            Profile
```

Recommended properties:

- white background
- 64–72px height
- optional sticky positioning
- very soft bottom border
- no glassmorphism
- no floating nav card

### Mobile

Use a compact native-like navigation pattern.

A bottom tab bar is allowed only if the product structure benefits from it.

Example:

```text
Home
Explore
Portfolio
Activity
Profile
```

Each item may contain:

- 18–22px icon
- 11–12px label

Do not compress a desktop sidebar into mobile.

---

## 13. Tabs

Primary tabs should look textual.

Example:

```text
Home   Portfolio   Rewards   Profile   Apps
────
```

### Active state

- primary text color
- weight 600
- thin underline

### Inactive state

- secondary text color

Do not turn every tab into a pill.

---

## 14. Category Filters

Pills are appropriate for compact category filters.

Example:

```text
All   Crypto   ETF   Stocks   Predictions
```

### Active

```text
background: #0a0a0a
color: white
```

### Inactive

```text
background: white or surface-secondary
color: text-secondary
```

Suggested height:

```text
40–44px
```

---

## 15. Segmented Controls

Use small segmented controls for time ranges or display modes.

Example:

```text
24h   7d   30d   All
```

Selected item:

- white or slightly elevated surface
- primary text
- 8–10px radius

Inactive items:

- transparent
- muted text

Keep the control compact.

---

## 16. Metrics and Financial Numbers

Important numbers should be visually dominant.

Example:

```text
$20,567.60
+$300,480.22   7d
```

or:

```text
Balance
$2,400.20
Balance in eUSD
```

Rules:

- use size before decoration
- primary value should use semibold weight
- secondary value should be muted
- positive change uses green
- negative change uses red
- decimals may be visually reduced when useful
- use tabular numerals where values update dynamically

---

## 17. Lists

Lists are a major part of this design language.

Use rows rather than cards.

Typical row:

```text
[avatar/icon]  Primary label                    Value
               Secondary label                  Change
```

### Suggested dimensions

- row height: 60–72px
- avatar/icon: 40–52px
- primary text: 15–17px, weight 600
- secondary text: 13–15px, muted
- value: 15–17px, weight 600

Separate rows with spacing first. Use dividers only when necessary.

---

## 18. Avatars and Verification

### Avatar

Typical size:

```text
36–48px
```

Shape:

- circle for people when appropriate
- 10–14px radius for square media or product identity

Use `object-fit: cover`.

### Verification badge

Keep badges small and close to the avatar or name.

Do not let verification badges become decorative focal points.

---

## 19. Charts

Charts should be extremely restrained.

Preferred style:

```text
stroke: 3–4px
smooth curve
transparent background
minimal or no visible axes
minimal or no grid
few labels
```

The final point may use a small circular marker.

Avoid:

- thick grid lines
- card containers when unnecessary
- 3D effects
- gradient fills by default
- cluttered legends
- decorative trading UI clichés

The chart should support the number, not compete with it.

---

## 20. Forms

Inputs should feel native and low-noise.

Suggested base style:

```text
height: 44–48px
background: #f3f3f3
border: transparent or very light
radius: 12–14px
```

Focus state:

- slightly darker border
- subtle focus ring

Avoid oversized blue glows.

Labels should be simple and readable.

---

## 21. Iconography

Use the project’s existing icon system if consistent.

If none exists, prefer Lucide.

Recommended sizes:

```text
16px
18px
20px
22px
```

Rules:

- consistent stroke style
- avoid mixing multiple icon families
- avoid emojis as primary UI icons
- do not put every icon inside a circle

---

## 22. Loading States

Prefer simple skeletons.

Avoid:

- giant spinners
- dramatic loading animations
- highly animated gradients
- novelty loaders

Loading should feel calm and fast.

---

## 23. Empty States

Use:

- small icon
- concise title
- one descriptive sentence
- optional action

Avoid giant illustrations or mascot-style empty states unless the product identity genuinely depends on them.

---

## 24. Error States

Errors should be:

- clear
- concise
- actionable
- visually restrained

Use red only where it improves comprehension.

---

## 25. Motion

Use motion to clarify interaction, not decorate the screen.

### Timing

```text
120–160ms  hover / press
160–200ms  tabs / segmented controls
200–280ms  panels / dialogs
```

### Easing

```css
cubic-bezier(.2, .8, .2, 1)
```

### Allowed

- background shift
- opacity transition
- small scale/translate response
- panel enter/exit

### Avoid

- permanent floating motion
- parallax for basic UI
- cursor effects
- magnetic buttons
- animated blobs
- card tilts
- mouse-follow glow

Respect `prefers-reduced-motion`.

---

## 26. Responsive System

The design must be deliberately responsive.

Do not build desktop first and simply apply `flex-direction: column` on mobile.

Validate at minimum:

```text
360px
390px
430px
768px
1024px
1280px
1440px
1728px+
```

### Mobile

- horizontal padding: 16–20px
- touch targets: minimum 44px
- nearly full-width primary surfaces
- reduced title sizes
- simplified navigation
- no hover-dependent interactions
- no compressed desktop tables

The interface should feel close to a native app.

### Tablet

Use extra space gradually.

Allow two-column layouts only where they genuinely improve readability.

### Desktop

Translate the same visual language to web.

Do **not** place a fake phone mockup in the center.

Recommended content width:

```text
1200–1360px
```

Use wider layouts when data benefits from it.

A reasonable desktop structure might be:

```text
----------------------------------------------------------
Navigation
----------------------------------------------------------

Page title                              Secondary action

Primary metric / chart     Secondary information

Main content

Lists / activity / data
----------------------------------------------------------
```

Do not default to a generic 12-card dashboard.

---

## 27. Layout Density

Minimal does **not** mean empty.

Avoid layouts where every section has huge unused vertical space.

Use information density similar to native financial apps:

- compact metadata
- clear row structure
- generous but controlled spacing
- strong vertical rhythm

A useful screen should look useful even before interaction.

---

## 28. Real Product Rules

The redesign must preserve the product.

Do not:

- replace real data with lorem ipsum
- invent fake data for visual balance
- remove working features to simplify styling
- create a `/redesign`, `/concept`, or `/demo` route as a substitute
- generate screenshots instead of code
- render the site inside an iPhone frame

Do:

- modify real components
- preserve state and business logic
- preserve backend integrations
- preserve navigation
- preserve forms
- preserve accessibility
- preserve data relationships

The work should improve the presentation, not replace the application with a prototype.

---

## 29. Component Guidelines

Reusable components are encouraged where the abstraction is real.

Good candidates:

- `PageHeader`
- `Tabs`
- `SegmentedControl`
- `PrimaryButton`
- `SecondaryButton`
- `Metric`
- `MetricChange`
- `ListRow`
- `Avatar`
- `VerifiedBadge`
- `Surface`
- `EmptyState`
- `MobileNav`
- `DesktopNav`

Do not turn every `div` into a component.

---

## 30. Accessibility

Maintain:

- semantic HTML
- keyboard navigation
- visible `focus-visible` states
- correct button/link semantics
- meaningful `aria-label`s where necessary
- readable contrast
- 44px touch targets
- reduced-motion support

Accessibility should be part of the component design, not a patch added afterward.

---

## 31. Implementation Order

Use this order when refactoring the current product:

1. inspect the existing project
2. identify framework, router, styling system and component architecture
3. identify repeated visual inconsistencies
4. define design tokens
5. normalize typography
6. normalize page background and surfaces
7. simplify navigation
8. remove AI-slop patterns
9. reduce unnecessary cards
10. improve visual hierarchy
11. standardize buttons
12. standardize list rows
13. standardize forms
14. simplify charts
15. implement mobile layout
16. implement tablet layout
17. implement desktop layout
18. add restrained microinteractions
19. validate accessibility
20. complete visual polish

---

## 32. Visual QA

After implementation, inspect the actual application in-browser.

If Playwright is available, capture screenshots at:

```text
390 × 844
430 × 932
768 × 1024
1024 × 768
1440 × 900
1728 × 1117
```

Check for:

- horizontal overflow
- clipped text
- broken navigation
- inconsistent spacing
- oversized cards
- inconsistent radii
- weak hierarchy
- excessive empty space
- mobile tap issues
- chart overflow
- table overflow
- dialog issues
- bad focus states
- hover-only functionality
- content that still resembles a template

Do not consider the redesign finished only because the application compiles.

---

## 33. Final Quality Test

For every element, ask:

> Does this look like a deliberate product-design decision, or something added because it looked “modern”?

If it feels decorative, generic, trendy, or unnecessary, simplify it.

The final product should feel:

- simpler than before
- more refined than before
- easier to scan
- easier to use
- consistent across screen sizes
- visually calm
- distinctly real

The target is not to imitate iOS literally.

The target is to apply the same **discipline, hierarchy, restraint, density, and clarity** to a responsive web product.
