# AEOGEO Design Brief — AI Visibility Platform

> For AI design agent / designer consumption. Describes every screen, component, interaction, and token needed to produce production-ready designs.

---

## 1. Brand Identity

**Product name:** AEOGEO
**Tagline:** "Get Advertised by AI"
**Positioning:** B2B SaaS platform that helps businesses get accurately represented, cited, and recommended by AI answer engines (ChatGPT, Gemini, Perplexity, Claude, etc.)

**Brand personality:** Data-driven, precise, trustworthy, modern, dark-aesthetic premium tool for marketing professionals.

### Typography

| Role | Font | Weight | Size range |
|------|------|--------|------------|
| Headings | Inter | 600 (Semibold), 700 (Bold) | 20px – 36px |
| Body | Inter | 400 (Regular), 500 (Medium) | 13px – 16px |
| Labels / Captions | Inter | 500 (Medium) | 11px – 13px |
| Code / Embed snippets | JetBrains Mono | 400 | 13px – 14px |

### Icon System
- **Library:** Lucide icons
- **Default size:** 20px (sidebar nav), 16px (inline), 24px (feature icons)
- **Stroke:** 1.5px
- **Style:** Outline only, no filled variants

### Color Palette — Dark Theme Primary

#### Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#0a0a0f` | Page/app background |
| `bg-surface` | `#141420` | Cards, sidebar, panels |
| `bg-surface-hover` | `#1c1c2e` | Card/row hover states |
| `bg-elevated` | `#1e1e30` | Modals, dropdowns, popovers |
| `bg-input` | `#12121e` | Input field backgrounds |

#### Borders
| Token | Hex | Usage |
|-------|-----|-------|
| `border-default` | `#2a2a3e` | Card borders, dividers |
| `border-focus` | `#3b82f6` | Focused input rings |
| `border-subtle` | `#1e1e30` | Subtle separators |

#### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#f0f0f5` | Headings, primary content |
| `text-secondary` | `#8888a0` | Labels, descriptions |
| `text-muted` | `#55556a` | Placeholders, disabled text |
| `text-inverse` | `#0a0a0f` | Text on light/accent backgrounds |

#### Accents
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-blue` | `#3b82f6` | Primary actions, links, focused states |
| `accent-blue-hover` | `#2563eb` | Primary button hover |
| `accent-purple` | `#8b5cf6` | AI/visibility features, premium indicators |
| `accent-green` | `#22c55e` | Success, "Published" status, positive sentiment |
| `accent-amber` | `#f59e0b` | Warning, "In Review" status |
| `accent-red` | `#ef4444` | Danger, destructive actions, negative sentiment |
| `accent-cyan` | `#06b6d4` | Chart data, secondary data accents |

#### Accent Backgrounds (muted, for badges/pills)
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-blue-bg` | `#3b82f620` | Blue badge background |
| `accent-purple-bg` | `#8b5cf620` | Purple badge background |
| `accent-green-bg` | `#22c55e20` | Green badge background |
| `accent-amber-bg` | `#f59e0b20` | Amber badge background |
| `accent-red-bg` | `#ef444420` | Red badge background |

### Spacing & Radius
| Token | Value |
|-------|-------|
| `spacing-xs` | 4px |
| `spacing-sm` | 8px |
| `spacing-md` | 12px |
| `spacing-lg` | 16px |
| `spacing-xl` | 24px |
| `spacing-2xl` | 32px |
| `spacing-3xl` | 48px |
| `radius-sm` | 6px |
| `radius-md` | 8px |
| `radius-lg` | 12px |
| `radius-full` | 9999px |

### Shadows (dark theme)
| Token | Value |
|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` |
| `shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.4)` |
| `shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.5)` |
| `shadow-glow-blue` | `0 0 20px rgba(59, 130, 246, 0.15)` |
| `shadow-glow-purple` | `0 0 20px rgba(139, 92, 246, 0.15)` |

---

## 2. Global Layout

### App Shell (Dashboard)
```
┌─────────────────────────────────────────────────┐
│ Sidebar (256px)  │  Topbar (56px height)        │
│                  ├──────────────────────────────-│
│  Logo            │                               │
│  ─────────       │  Main Content Area            │
│  Nav Items       │  (scrollable)                 │
│  (icons+labels)  │                               │
│                  │  max-width: 1400px             │
│                  │  padding: 24px                 │
│  ─────────       │                               │
│  User avatar     │                               │
│  Org name        │                               │
└─────────────────────────────────────────────────-┘
```

### Sidebar
- **Width:** 256px (expanded), 64px (collapsed)
- **Background:** `bg-surface` (#141420)
- **Border right:** 1px `border-default`
- **Logo area:** Top, 56px height, padding 16px. Logo mark + "AEOGEO" text (hidden when collapsed)
- **Navigation items:**
  - Height: 40px per item
  - Padding: 12px horizontal
  - Icon (20px) + Label (14px, medium weight)
  - Default: `text-secondary`, icon `text-muted`
  - Hover: `bg-surface-hover`, `text-primary`
  - Active: `accent-blue-bg` background, `accent-blue` text + icon, left 2px border accent-blue
  - Group dividers: 1px `border-subtle` with 8px vertical margin
- **Navigation groups:**
  - **Main:** Overview, AI Visibility, Reports, Content, Widgets, Projects
  - **Divider**
  - **System:** Settings
- **Bottom section:** User avatar (32px circle), org name, collapse toggle button
- **Collapse animation:** 200ms ease, icons remain centered at 64px width

### Topbar
- **Height:** 56px
- **Background:** `bg-primary` (transparent, blends with page bg)
- **Border bottom:** 1px `border-default`
- **Left:** Breadcrumb (page title, 16px semibold, `text-primary`)
- **Right:** Notification bell icon (with badge count, red dot), User avatar dropdown

### Auth Shell
- **Full viewport height**
- **Background:** `bg-primary` with subtle radial gradient (purple-blue glow center, ~20% opacity)
- **Content:** Centered card, 420px width
- **Card:** `bg-surface`, `border-default`, `radius-lg`, `shadow-lg`, padding 32px
- **Logo:** Centered above form, 40px height

---

## 3. Screen Designs

### 3.1 Login

**URL:** `/login`
**Layout:** Auth shell

**Elements (top to bottom):**
1. Logo (centered, 40px)
2. Heading: "Sign in to AEOGEO" (20px, semibold, `text-primary`)
3. Subheading: "Enter your credentials to access your dashboard" (14px, `text-secondary`)
4. Spacer (24px)
5. Email input (label: "Email", placeholder: "you@company.com")
6. Password input (label: "Password", type password, show/hide toggle icon)
7. "Forgot password?" link (right-aligned, 13px, `accent-blue`)
8. Spacer (16px)
9. "Sign In" button (full-width, primary, 40px height)
10. Spacer (24px)
11. Footer text: "Don't have an account? Contact your administrator for an invitation." (13px, `text-muted`, centered)

**States:**
- Default, Focused (input ring `border-focus`), Error (red border + error text below field), Loading (button shows spinner, disabled)

---

### 3.2 Accept Invite

**URL:** `/accept-invite?token=xxx`
**Layout:** Auth shell

**Elements:**
1. Logo
2. Heading: "Join your team on AEOGEO" (20px, semibold)
3. Subheading: "You've been invited to join [Organization Name]. Set up your account below." (14px, `text-secondary`)
4. Full name input
5. Email input (pre-filled, disabled/muted)
6. Password input
7. Confirm password input
8. "Create Account & Join" button (full-width, primary)

---

### 3.3 Forgot Password

**URL:** `/forgot-password`
**Layout:** Auth shell

**Elements:**
1. Logo
2. Heading: "Reset your password"
3. Subheading: "Enter your email and we'll send you a reset link."
4. Email input
5. "Send Reset Link" button (full-width, primary)
6. "Back to sign in" link (centered, `accent-blue`)

**Success state:** Replaces form with check-circle icon + "Check your email" message

---

### 3.4 Register (Invite-only)

**URL:** `/register`
**Layout:** Auth shell

**Elements:**
1. Logo
2. Heading: "Create your account"
3. Info banner: "Registration is by invitation only. If you have an invite link, please use it." (`accent-amber-bg` background, amber border, 13px)
4. Full name input
5. Email input
6. Password input
7. Confirm password input
8. "Create Account" button (full-width, primary)

---

### 3.5 Dashboard Overview

**URL:** `/overview`
**Layout:** Dashboard shell

**Page title:** "Dashboard" (breadcrumb)

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  [Visibility Score] [Share of Voice] [Sentiment] [Citation Rate]  │  ← 4-column metric cards
├──────────────────────────────────────────────────┤
│                                                  │
│  Quick Actions                                   │  ← Action buttons row
│  [Generate Report]  [Create Content]  [Run Audit]│
│                                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Recent Activity                                 │  ← Activity feed
│  ┌────────────────────────────────────────────┐  │
│  │ Content "Q4 FAQ" published          2h ago │  │
│  │ Report generated for Acme Corp      5h ago │  │
│  │ Engine Perplexity added to project   1d ago│  │
│  │ Invite sent to john@acme.com         1d ago│  │
│  │ Visibility score increased +5        2d ago│  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Metric Cards (each):**
- Background: `bg-surface`, border: `border-default`, radius: `radius-lg`
- Top: Label (13px, `text-secondary`) + icon (16px, accent color)
- Middle: Large value (32px, bold, `text-primary`)
- Bottom: Trend indicator — arrow icon (up green / down red) + percentage + "vs last 30d" (13px, `text-muted`)

**Specific cards:**
1. **Visibility Score:** Value "72/100", trend "+5 vs last 30d", icon Eye, accent purple glow
2. **Share of Voice:** Value "34%", trend "+2.1% vs last 30d", icon PieChart, accent blue
3. **Sentiment:** Value "68% positive", icon ThumbsUp, accent green. Sub-values: "22% neutral, 10% negative" (small text)
4. **Citation Rate:** Value "156 citations", trend "+12 vs last 30d", icon Link, accent cyan

**Quick Actions:**
- Row of 3 buttons, outline style, icon + text
- "Generate Report" (FileText icon), "Create Content" (PenTool icon), "Run Audit" (Search icon)

**Recent Activity:**
- List in a card, no header beyond "Recent Activity" (14px, semibold)
- Each row: icon (16px, color-coded by type) + description (14px, `text-primary`) + timestamp (13px, `text-muted`, right-aligned)
- Row hover: `bg-surface-hover`
- Max 10 items, "View all" link at bottom

---

### 3.6 AI Visibility

**URL:** `/visibility`
**Layout:** Dashboard shell

**Page title:** "AI Visibility Analytics"

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Filters: [Date Range ▼] [Engine ▼] [Project ▼] │  ← Filter bar
├──────────────────────────────────────────────────┤
│                                                  │
│  Visibility Over Time (line chart placeholder)   │  ← Full-width chart area
│  ┌────────────────────────────────────────────┐  │
│  │  📈 Chart: x-axis dates, y-axis score      │  │
│  │  Multiple lines per engine (color-coded)    │  │
│  │  Height: 320px                              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Engine Breakdown                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │  ← Engine cards row
│  │ChatGPT│ │Gemini│ │Perpl.│ │Claude│ │Copilot│  │
│  │ 78/100│ │65/100│ │71/100│ │82/100│ │58/100│  │
│  │  +3 ▲ │ │ -2 ▼ │ │ +1 ▲ │ │ +8 ▲ │ │ +0 — │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Query Tracking                                  │
│  ┌────────────────────────────────────────────┐  │  ← Data table
│  │ Query          │ Engine │ Position │ Trend  │  │
│  │ "best CRM..."  │ GPT    │ #2       │ ▲ +1  │  │
│  │ "AI marketing" │ Gemini │ #5       │ ▼ -2  │  │
│  │ ...            │ ...    │ ...      │ ...   │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Filter bar:**
- Row of dropdowns, `bg-surface` background, sticky top
- Date range: "Last 7 days", "Last 30 days", "Last 90 days", "Custom"
- Engine: Multi-select checkboxes for each configured engine
- Project: Dropdown of all projects

**Chart area:**
- Card wrapper (`bg-surface`, border, radius-lg)
- Header: "Visibility Over Time" (14px, semibold) + chart legend (engine names with colored dots)
- Chart: 320px height placeholder. Gray dashed grid lines, colored lines per engine
- **Placeholder state:** Gray rectangle with centered "Chart visualization" text + bar-chart icon

**Engine cards:**
- Horizontal scrollable row (6 cards)
- Each: 160px wide, `bg-surface`, border, radius-md
- Engine icon/logo placeholder (24px colored circle), name (14px, medium), score (24px, bold), trend (13px, colored arrow + value)

**Query tracking table:**
- Card wrapper
- Headers: Query, Engine, Position, Mentions, Sentiment, Trend, Last Checked
- Sortable columns (chevron icons in headers)
- Alternating row backgrounds (`bg-surface` / `bg-primary`)
- Hover: `bg-surface-hover`
- Pagination: "Showing 1-20 of 156" + prev/next buttons

---

### 3.7 Reports

**URL:** `/reports`
**Layout:** Dashboard shell

**Page title:** "Reports"

**Header row:** Title + "Generate New Report" button (primary, FileText icon)

**Report cards grid (3 columns):**
Each card:
- `bg-surface`, border, radius-lg, padding 20px
- Top: Type badge (e.g., "Visibility Audit" — purple badge, "Competitive Analysis" — blue badge)
- Title: 16px, semibold, `text-primary`
- Date: "Generated Mar 15, 2026" (13px, `text-muted`)
- Metrics preview: 2-3 inline stats (e.g., "Score: 72", "Engines: 5")
- Bottom row: "View" button (outline) + "Share" button (ghost, Share2 icon)

**Empty state:** Illustration area + "No reports yet" + "Generate your first report to see AI visibility insights" + "Generate Report" CTA button

---

### 3.8 Content Workflow

**URL:** `/content`
**Layout:** Dashboard shell

**Page title:** "Content"

**Header row:**
- Title
- Right: "AI Generate" button (accent-purple, Sparkles icon) + "Create Content" button (primary, Plus icon)

**Tab bar (below header):**
- Tabs: All | Drafts | In Review | Published | Archived
- Active tab: `accent-blue` underline (2px), `text-primary`
- Inactive: `text-secondary`
- Count badges on each tab (e.g., "Drafts (3)")

**Content type filter:**
- Below tabs, pill/chip filter group
- Options: All Types, FAQ, Blog, Comparison, Buyer Guide, Pricing Clarifier, Glossary
- Active: `accent-blue-bg` + `accent-blue` text
- Inactive: `bg-surface-hover` + `text-secondary`

**Content table:**
| Column | Width | Content |
|--------|-------|---------|
| Title | 35% | Content title (14px, medium) + type chip (11px) below |
| Status | 12% | Status badge (colored pill) |
| Author | 15% | Avatar (24px) + name |
| Updated | 15% | Relative timestamp |
| Actions | 10% | "..." dropdown menu |

**Status badges:**
- Draft: `bg-surface-hover`, `text-secondary` text
- In Review: `accent-amber-bg`, `accent-amber` text
- Published: `accent-green-bg`, `accent-green` text
- Archived: `bg-surface-hover`, `text-muted` text

**Actions dropdown:**
- Edit, Submit for Review, Approve, Reject, Archive, Delete (red text, separated by divider)
- Available actions depend on current status (design all variants)

---

### 3.9 Widget Configuration

**URL:** `/widgets`
**Layout:** Dashboard shell

**Page title:** "Widgets"

**Header row:** Title + "Create Widget" button (primary)

**Split layout (60/40):**

**Left panel — Configuration form:**
- Card wrapper, padding 24px
- Sections:
  1. **General:** Widget name input, Project dropdown
  2. **Appearance:**
     - Theme: Radio cards — "Dark" (selected by default, preview swatch) / "Light" / "Custom"
     - Position: Dropdown — "Bottom Right", "Bottom Left", "Inline", "Full Page"
     - Border radius slider (0-24px)
     - Font family dropdown
  3. **Content:**
     - Mode: Radio — "FAQ", "Blog Feed", "AI Consultant"
     - Max items: Number input (default 5)
  4. **Save Configuration** button (primary, full-width)

**Right panel — Preview + Embed Code:**
- **Preview area:** Card with dark/light mockup of widget appearance (280px × 400px placeholder with "Widget Preview" text and sample FAQ items skeleton)
- **Embed Code:** Below preview, code block (`bg-input`, JetBrains Mono font, 13px)
  ```html
  <script src="https://cdn.aeogeo.com/widget.js" data-id="wgt_xxx"></script>
  ```
  - "Copy" button (top-right of code block, clipboard icon)

---

### 3.10 Projects

**URL:** `/projects`
**Layout:** Dashboard shell

**Page title:** "Projects"

**Header row:** Title + "New Project" button (primary, Plus icon)

**Project cards grid (3 columns):**
Each card:
- `bg-surface`, border, radius-lg, padding 20px, hover `shadow-md` transition
- Top left: Client logo placeholder (40px circle, initials in `accent-blue-bg`)
- Top right: Visibility score mini-badge (e.g., "72" in `accent-purple-bg` pill)
- Title: Client/project name (16px, semibold)
- Domain: "acme.com" (13px, `text-muted`, link icon)
- Members: Row of overlapping avatar circles (max 4 shown) + "+3 more" text
- Bottom: "View Project" button (outline, full-width)

**Empty state:** "No projects yet" + "Create your first project to start tracking AI visibility" + CTA button

---

### 3.11 Settings

**URL:** `/settings`
**Layout:** Dashboard shell

**Page title:** "Settings"

**Layout: Vertical tabs (left) + Content (right)**
```
┌──────────────┬─────────────────────────────────┐
│  Profile      │  [Content area changes per tab] │
│  Team         │                                 │
│  API Keys     │                                 │
│  Billing      │                                 │
│  Notifications│                                 │
│  Integrations │                                 │
└──────────────┴─────────────────────────────────┘
```

**Tab sidebar:** 200px, `bg-surface`, border-right, each tab 40px height, same active styling as main sidebar

#### Profile tab:
- Avatar (80px circle, upload overlay on hover)
- Full name input
- Email input (disabled, "Contact admin to change")
- "Save Changes" button

#### Team & Invitations tab:
- **"Invite Team Member" button** (primary, UserPlus icon)
- **Pending invites table:** Email, Role, Sent date, "Resend" / "Revoke" actions
- **Team members table:** Avatar + Name, Email, Role badge, "Manage" dropdown (change role, remove)

#### API Keys tab:
- "Generate New Key" button (primary, Key icon)
- Keys table: Name, Key (masked `sk_****...`), Created, Last used, "Revoke" button (danger ghost)
- Warning banner: "API keys grant full access to your account. Keep them secret." (`accent-amber-bg`)

#### Billing tab:
- Current plan card: Plan name, price, features list
- Usage stats: API calls, content items, projects (progress bars)
- "Upgrade Plan" button (primary) / "Manage Billing" button (outline)

#### Notifications tab:
- Toggle rows (Switch component):
  - "Email me when content is published"
  - "Email me when a report is ready"
  - "Email me when my visibility score changes significantly"
  - "Weekly digest email"
- "Save Preferences" button

#### Integrations tab:
- Integration cards grid (2 columns):
  - Each: Logo placeholder + Name + Description + "Connect" button (outline) or "Connected" badge (green)
  - Integrations: Google Search Console, Analytics, Shopify, WordPress, Slack, Zapier
- All show as "Coming Soon" placeholder state

---

## 4. Component Specifications

### Button
| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `accent-blue` | white | none | `accent-blue-hover` |
| Secondary | `bg-surface` | `text-primary` | `border-default` | `bg-surface-hover` |
| Outline | transparent | `accent-blue` | `accent-blue` | `accent-blue-bg` |
| Ghost | transparent | `text-secondary` | none | `bg-surface-hover` |
| Danger | `accent-red` | white | none | darken 10% |
| AI / Purple | `accent-purple` | white | none | darken 10% |

**Sizes:** sm (32px h, 13px text), md (40px h, 14px text), lg (48px h, 16px text)
**States:** Default, Hover, Active (scale 0.98), Disabled (50% opacity), Loading (spinner replaces text)
**Border radius:** `radius-md` (8px)

### Input
- Height: 40px
- Background: `bg-input`
- Border: `border-default`
- Text: `text-primary`, placeholder: `text-muted`
- Focus: `border-focus` ring (2px, `accent-blue` at 30% opacity)
- Error: `accent-red` border + error message below (13px, `accent-red`)
- Label: Above, 13px, medium weight, `text-secondary`
- Radius: `radius-md`

### Card
- Background: `bg-surface`
- Border: 1px `border-default`
- Radius: `radius-lg` (12px)
- Padding: 20px (default), 24px (large)
- Hover (if interactive): `shadow-md` transition + slight border lighten

### Badge / Pill
- Height: 22px
- Padding: 4px 8px
- Radius: `radius-full`
- Font: 11px, medium weight
- Color-coded per variant (green/amber/red/blue/purple/gray)
- Background uses muted accent colors (20% opacity)

### Data Table
- Header row: `bg-surface-hover`, 13px uppercase, `text-muted`, medium weight
- Body rows: alternating `bg-primary` / `bg-surface` (subtle)
- Row hover: `bg-surface-hover`
- Cell padding: 12px horizontal, 8px vertical
- Border between rows: 1px `border-subtle`
- Sortable columns: chevron icon (ChevronUp/ChevronDown) next to header text

### Dropdown Menu
- Background: `bg-elevated`
- Border: `border-default`
- Radius: `radius-md`
- Shadow: `shadow-lg`
- Items: 36px height, 14px text, icon (16px) + label
- Hover: `bg-surface-hover`
- Destructive items: `accent-red` text, separated by divider
- Animation: Scale from 0.95 + fade in, 150ms

### Toast / Notification
- Position: Bottom-right, 16px from edges
- Background: `bg-elevated`
- Border: 1px `border-default` + left 3px accent border (color by type)
- Content: Icon (20px) + title (14px, medium) + description (13px, `text-secondary`)
- Close button: X icon, top-right
- Auto-dismiss: 5 seconds, fade out
- Stack: Max 3 visible, newest on top

### Modal / Dialog
- Overlay: `#000000` at 60% opacity, backdrop-blur 4px
- Card: `bg-surface`, border, radius-lg, shadow-lg
- Width: 480px (small), 640px (medium), 800px (large)
- Header: Title (18px, semibold) + close X button
- Footer: Right-aligned action buttons (Cancel ghost + Confirm primary)
- Animation: Scale from 0.95 + fade in, 200ms

### Skeleton / Loading States
- Shape: Same dimensions as content they replace
- Color: `bg-surface-hover` with animated shimmer
- Shimmer: Linear gradient sweep left-to-right, `bg-surface-hover` -> `#2a2a3e` -> `bg-surface-hover`
- Duration: 1.5s loop
- Apply to: metric values, table rows, card content, chart areas

### Empty State
- Centered in content area
- Icon: 48px, `text-muted` (relevant icon per context)
- Title: 18px, semibold, `text-primary`
- Description: 14px, `text-secondary`, max-width 400px, centered
- CTA button: Primary, below description, 16px margin-top

---

## 5. Responsive Behavior

**This is a desktop-first CRM application.** Primary target: 1280px+ viewport.

| Breakpoint | Sidebar | Metric Cards | Tables | Cards Grid |
|------------|---------|-------------|--------|------------|
| ≥1280px | 256px expanded | 4 columns | Full | 3 columns |
| 768-1279px | 64px icon-only | 2 columns | Horizontal scroll | 2 columns |
| <768px | Off-canvas (hamburger) | 1 column | Horizontal scroll | 1 column |

**Sidebar collapse:**
- 768-1279px: Auto-collapse to 64px, icons only, tooltip on hover showing label
- <768px: Hidden by default, hamburger button in topbar, slide-in overlay from left
- Collapse animation: 200ms ease

**Content area:**
- Max-width: 1400px
- Centered with auto margins when viewport > 1400px + sidebar width
- Padding: 24px (desktop), 16px (tablet), 12px (mobile)

---

## 6. Interaction Patterns

### Navigation
- Instant page transitions (SPA, no full reloads)
- Active sidebar item updates immediately on click
- URL reflects current page state

### Loading
- **Page load:** Full skeleton of page layout (sidebar stays, content area shows skeletons)
- **Data load:** Individual component skeletons (metric cards shimmer independently)
- **Action load:** Button shows spinner, disabled state
- **Never use:** Full-page spinners, progress bars for instant operations

### Form Validation
- **When:** On blur (individual fields) + on submit (all fields)
- **Error display:** Red border on field + error message text below (13px, `accent-red`)
- **Success:** Green check icon in input (right side) for validated fields
- **Required indicator:** Red asterisk (*) after label

### Confirmations
- **Destructive actions** (delete, revoke, remove): Always show confirmation dialog
- **Dialog:** "Are you sure?" title + description of what happens + Cancel (ghost) + Confirm (danger)
- **Non-destructive actions:** Toast notification on success, no confirmation needed

### Transitions
- **Hover effects:** 150ms ease (background color, border color, shadow)
- **Page content:** Fade-in 200ms on route change
- **Modals/Dropdowns:** Scale + fade 150-200ms
- **Sidebar collapse:** Width 200ms ease
- **No bouncy/spring animations** — keep it crisp and professional

---

## 7. Design Deliverables Checklist

When generating designs from this brief, produce the following:

### Pages (14 total)
- [ ] Login
- [ ] Register (invite-only)
- [ ] Forgot Password
- [ ] Accept Invite
- [ ] Dashboard Overview
- [ ] AI Visibility
- [ ] Reports (list view)
- [ ] Content Workflow (table view)
- [ ] Widget Configuration
- [ ] Projects (card grid)
- [ ] Settings — Profile
- [ ] Settings — Team & Invitations
- [ ] Settings — API Keys
- [ ] Settings — Billing

### Component Library
- [ ] Button (all variants × all sizes × all states)
- [ ] Input (default, focused, error, disabled, with icon)
- [ ] Card (static, interactive/hoverable)
- [ ] Badge (all color variants)
- [ ] Data Table (with sort, pagination, empty state)
- [ ] Sidebar (expanded, collapsed, mobile)
- [ ] Topbar
- [ ] Dropdown Menu
- [ ] Modal / Dialog
- [ ] Toast Notification (success, error, warning, info)
- [ ] Tab Bar
- [ ] Skeleton / Loading State
- [ ] Empty State
- [ ] Metric Card (with trend)
- [ ] Status Badge (Draft, Review, Published, Archived)
- [ ] Avatar (single, group/stack)
- [ ] Code Block (with copy button)

### States per page
- [ ] Default (populated with data)
- [ ] Loading (skeleton)
- [ ] Empty (no data yet)
- [ ] Error (API failure — toast + retry suggestion)
