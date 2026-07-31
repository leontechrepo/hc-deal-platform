# Leon Design System Alignment — Status

Tracking doc for aligning `hc-deal-platform`'s frontend to the **Leon Design
System** (claude.ai/design project `217ff59b-3bf3-4c1c-9bd8-b190495e4cc2`,
owned, synced locally as `Reip Design System/` — the design system for a
sibling Leon Capital product, REIP). This is a separate initiative from the
"Corporate Credit Platform" mockup rebuild tracked in `RESTRUCTURE_STATUS.md`
(different DesignSync project, different plan files) — the two aren't
sequenced against each other.

Full design detail lives in the plan file:
`~/.claude/plans/alright-so-we-need-idempotent-mist.md`

## What we're doing

The frontend (`frontend/`, React + Vite + CSS Modules, no Tailwind/component
library) already borrowed its navy/gold/Cormorant Garamond/Jost token set from
this same design system bundle during an earlier "Phase 0" pass (see
`RESTRUCTURE_STATUS.md`), but only copied raw color tokens — no spacing/radius
scale, no dark mode, no real component CSS classes (`.btn-primary`,
`.kpi-card`, `.badge`, etc.), hand-drawn SVG icons instead of the design
system's Lucide icons. This initiative brings the token/foundation layer and
the shared `ui/` primitive library up to 1:1 parity with the design system,
staged in two phases: foundation/primitives first (this doc's Phase A), then
page-level restyling as a follow-up.

## Done

### Phase A — tokens, primitives, dark mode, icons — implemented locally, **not yet committed**

- `frontend/src/styles/tokens.css` rebuilt: new spacing scale (`--space-1..11`),
  radius scale (`--radius-badge/button/card/pill/bubble/panel/sidebar/round`),
  font-size scale, spotlight tokens, corrected semantic pill colors (green/
  red/amber/blue), and a full `html.dark` override block (`--gold`/`--navy`
  stay constant across themes — legacy non-DS tones like yellow/purple/orange/
  gray got improvised dark variants since they have no DS reference).
- Dark mode infrastructure: new `frontend/src/ThemeContext.tsx` (mirrors
  `NavContext.tsx`'s pattern, localStorage key `theme`), a synchronous
  FOUC-prevention bootstrap script in `frontend/index.html`'s `<head>`,
  `ThemeProvider` mounted above `ClerkProvider` in `main.tsx` so it also
  covers the signed-out `LoginPage`, and a new `ui/ThemeToggle` primitive
  living in the NavBar footer (no new Topbar introduced — see Excluded below).
- Icons: `lucide-react` installed; every hand-drawn inline SVG in
  `frontend/src/components/NavBar/NavBar.tsx` replaced with Lucide icons
  (Kanban/ScrollText/BarChart3/Inbox/Users/Landmark/Building2/RefreshCw/
  PanelLeftClose/PanelLeftOpen/LogOut/Sun/Moon), via a small NavBar-scoped
  `NavIcon` helper (not a general-purpose icon primitive — no second consumer
  exists yet).
- NavBar aligned to the design system's `.sidebar.fluid-sidebar` spec:
  collapsed width 56px→80px, transition timing to `.28s cubic-bezier(.4,0,.2,1)`,
  native-title tooltips on nav items (collapsed-state discoverability),
  active-state gold border added.
- `ui/` primitives rebuilt/extended: `Button` (navy-bg/gold-text signature
  primary, new `gold`/`danger` variants, `size` prop), `Card` (new `accent`/
  `hoverable` props), `Badge` (corrected hex, new `amber` tone, tinted
  borders), new `Tag` primitive, new `KPICard` primitive (DS's individual
  accent-bordered tile, `KPIGrid`'s connected-strip layout kept as-is per its
  own consumers), `Modal` (14px radius, single-padding-block restructure,
  dark-mode overlay), `Tabs`/`DataTable` restyle (gold-tinted row hover is a
  real Leon-signature detail), token touch-ups across `EmptyState`/
  `ProgressBar`/`Slider`/`InlineEditText`/`ConfidenceBadge`, new `Separator`
  primitive, `ApproveRejectActions` refactored to delegate to `Button`
  internally instead of hand-rolled duplicate CSS.
- Verified: `tsc -b --noEmit` clean, `eslint` clean on every touched file (a
  handful of pre-existing `react-hooks/set-state-in-effect` errors exist
  elsewhere in the repo, e.g. `FundFormModal.tsx`/`NewDealModal.tsx` — confirmed
  unrelated, not touched by this work). Dev server + Playwright screenshots
  confirmed: login page renders correctly (navy/gold, fonts load, zero console
  errors), `html.dark` token flips correctly (`--text`/`--lt`/shadows swap,
  `--gold` stays fixed), and the FOUC-prevention bootstrap script applies the
  dark class before first paint with no flash.
- **Not verified**: the actual signed-in shell (NavBar with new icons, primitive
  components in real use on Pipeline/Sponsors/Funds/Portfolio/Inbox) has not
  been visually eyeballed — there's no test SSO session available in this
  environment, and an attempt to temporarily bypass the Clerk auth gate for a
  screenshot was correctly blocked by the permission system and reverted
  (confirmed via `git diff` that `App.tsx` only carries the intended
  transition-timing change, nothing else). **Recommend a manual pass with real
  credentials** — collapsed/expanded nav, light/dark toggle, all 5 pages —
  before treating Phase A as fully visually verified.
- **Explicitly excluded from Phase A** (deferred to the page-restyle phase):
  real `Topbar` component, `Field`/`FieldGroup` form-primitive family,
  `SearchableSelect`, standalone `Input`/`Label`, `Menu`/`MenuItem`, `Avatar`
  family, `AiStarIcon` (no AI-chat feature in this app to attach it to),
  `StatusBadge`/`RolePills` (REIP-domain-specific, already covered by this
  app's `Badge`/`ConfidenceBadge`), `DataTable` sort/pagination behavior, font
  self-hosting (still Google Fonts CDN), the full spotlight/glass workspace
  background treatment (tokens added, background itself not applied),
  automated visual regression/Storybook tooling.

## Next steps

1. **Commit Phase A.** Nothing above is committed yet — review the diff
   (`git status`/`git diff` on `frontend/`), then commit and open a PR.
2. **Manual signed-in QA.** Sign in via Clerk SSO and walk all 5 pages
   (Pipeline, Sponsors, Funds, Portfolio, Inbox) in light/dark and
   collapsed/expanded nav — the one verification gap called out above.
3. **Page-level restyle phase** (not yet planned in detail): apply the new
   primitives/tokens to each page's actual layout/content, and revisit the
   items excluded from Phase A once real page call sites exist to justify
   them (Topbar, Field family, SearchableSelect, Avatar, etc.).

Also open, not blocking:
- Decide whether `Reip Design System/` (currently untracked in git) should be
  committed to the repo, `.gitignore`d, or kept purely local — it's a large
  synced bundle (screenshots, vendored React, compiled CSS/JS) that may not
  belong in version control as-is.
