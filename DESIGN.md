---
name: Agendaly
description: Quietly premium scheduling software for service businesses and their customers.
colors:
  primary-amber-50: "#fffbeb"
  primary-amber-100: "#fef3c7"
  primary-amber-200: "#fde68a"
  primary-amber-500: "#f59e0b"
  primary-amber-600: "#d97706"
  primary-amber-700: "#b45309"
  ink-950: "#030712"
  ink-900: "#111827"
  ink-700: "#374151"
  ink-600: "#4b5563"
  ink-500: "#6b7280"
  line-200: "#e5e7eb"
  line-100: "#f3f4f6"
  canvas-50: "#f9fafb"
  paper: "#ffffff"
  success-600: "#16a34a"
  info-600: "#2563eb"
  role-provider-600: "#9333ea"
  danger-600: "#dc2626"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.025em"
rounded:
  xs: "2px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-accent:
    backgroundColor: "{colors.primary-amber-600}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge-default:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Agendaly

## 1. Overview

**Creative North Star: "The Well-Run Front Desk"**

Agendaly should feel like a composed front desk at a busy service business: everything is findable, the next action is obvious, and the interface stays calm even when the schedule is full. The system is product-first, with marketing surfaces allowed to be more editorial, but daily provider workflows should stay restrained, legible, and quick to scan.

The current UI uses system typography, white and soft gray surfaces, rounded controls, thin borders, modest shadows, and an amber accent for brand warmth. It should preserve that operational clarity while becoming more intentional: quiet enough for repeated provider use, polished enough for serious businesses, and flexible enough to let provider pages carry each business's own identity.

Key Characteristics:
- Restrained product surfaces with amber used as a warm accent, not decoration.
- White cards, gray canvases, clear borders, and small shadows for practical hierarchy.
- Dense but readable management screens for provider work.
- Mobile-first booking steps with direct copy and obvious progress.
- Provider identity is supported without turning Agendaly into a marketplace.

## 2. Colors

The palette is neutral-first with a warm amber accent and pragmatic status colors. The CSS source includes OKLCH semantic tokens in `src/style.css`; the frontmatter uses hex values for Stitch compatibility.

### Primary
- **Front Desk Amber** (#d97706): Brand warmth, primary accents, selected states, provider logos, and key booking calls to action. Use sparingly so it keeps meaning.
- **Soft Appointment Amber** (#fef3c7): Low-emphasis amber backgrounds, notices, and selected containers.
- **Quiet Gold Wash** (#fffbeb): The lightest amber surface for subtle warmth.

### Secondary
- **Provider Violet** (#9333ea): Role and provider-context accents where the app distinguishes provider work from customer booking.
- **Booking Blue** (#2563eb): Customer role markers, links, and informational states.
- **Confirmed Green** (#16a34a): Success, revenue, confirmed bookings, and positive availability.

### Neutral
- **Schedule Ink** (#030712): High-contrast hero backgrounds and strongest text.
- **Interface Ink** (#111827): Primary product text.
- **Operational Gray** (#4b5563): Secondary text and descriptions.
- **Muted Gray** (#6b7280): Metadata, helper text, and lower-priority labels.
- **Divider Gray** (#e5e7eb): Borders, separators, input strokes.
- **Worksurface Gray** (#f9fafb): App page backgrounds.
- **Paper** (#ffffff): Cards, forms, menus, and primary content surfaces.

### Named Rules
**The Amber Earns Its Place Rule.** Amber should identify action, selection, or brand presence. Do not spread it across every card or section.

## 3. Typography

**Display Font:** system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Body Font:** system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Label/Mono Font:** system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif

**Character:** The typography is direct and utilitarian. It relies on weight, size, and spacing rather than distinctive typefaces, which fits an operational product where clarity matters more than brand performance.

### Hierarchy
- **Display** (700, 48px or 60px on wide marketing heroes, 1.1 line-height): Landing page hero statements and rare brand moments.
- **Headline** (700, 24-30px, 1.2 line-height): Page titles, dashboard headers, and major booking step headings.
- **Title** (600-700, 18-20px, 1.35 line-height): Card titles, modal titles, section headings.
- **Body** (400-500, 14-16px, 1.5 line-height): Forms, descriptions, table-like detail, and booking instructions. Keep long reading text to 65-75 characters per line.
- **Label** (600, 12-14px, normal to slight positive tracking): Form labels, badges, metadata, status text, and compact navigation.

### Named Rules
**The Workday Scale Rule.** Provider screens should not use hero-scale type inside dashboards, cards, or modals. Large type belongs to real page-level moments.

## 4. Elevation

Agendaly uses a hybrid of borders, tonal surfaces, and modest shadows. Most product surfaces are flat at rest, with `border` and `shadow-sm` doing the work. Heavier `shadow-lg`, `shadow-xl`, and `shadow-2xl` are reserved for overlays, menus, search suggestions, and landing-page previews.

### Shadow Vocabulary
- **Surface Shadow** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05)`): Default cards, inputs, tabs, and subtle framed surfaces.
- **Interactive Lift** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)`): Hoverable cards and operational actions.
- **Overlay Shadow** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)`): Dialogs, popovers, dropdowns, and floating panels.
- **Presentation Shadow** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`): Marketing previews and search hero panels only.

### Named Rules
**The Flat Until Needed Rule.** Surfaces are flat by default. Shadows appear to clarify layers, floating content, or interaction, not to decorate static grids.

## 5. Components

### Buttons
- **Shape:** Rounded medium corners (`8px`), compact heights (`36px` default, `40px` large), icon gap of `8px`.
- **Primary:** Semantic `bg-primary text-primary-foreground` in the shared button primitive; app-specific CTAs often use `primary-600` amber with white text.
- **Hover / Focus:** Hover darkens or softens the fill. Focus uses a 3px ring from the semantic ring token.
- **Secondary / Ghost / Outline:** Secondary buttons use muted fills, outlines keep white backgrounds with borders, and ghost buttons rely on hover background only.

### Chips
- **Style:** Rounded-full pills, compact `12px` text, 2px vertical and 8px horizontal padding.
- **State:** Role chips use color coding: provider violet, customer blue, shared/positive green. Category pills may invert on dark or image-backed surfaces.

### Cards / Containers
- **Corner Style:** Shared cards use `12px`; older feature cards and dashboard panels usually use `8px`.
- **Background:** Paper on worksurface gray for product screens; dark ink sections with paper preview cards for institutional landing.
- **Shadow Strategy:** Default cards use `shadow-sm`; hover cards move to `shadow-md` only when clickable.
- **Border:** Thin neutral borders are expected. Avoid heavy colored side stripes.
- **Internal Padding:** `24px` is the main card padding; compact rows use `16px`.

### Inputs / Fields
- **Style:** `36px` height, `8px` radius, thin border, transparent or paper background, 12px horizontal padding.
- **Focus:** Border shifts to the ring token with a 3px soft focus ring.
- **Error / Disabled:** Errors use destructive border/ring treatment. Disabled fields reduce opacity and remove pointer interaction.

### Navigation
- **Style:** Sticky top navigation uses a translucent background, border-bottom, backdrop blur, and compact icon-text buttons.
- **Typography:** Brand mark uses bold 24px text in amber. Navigation labels use 14px medium text.
- **States:** Menus and mobile navigation use muted hover backgrounds, clear role switches, and compact language controls.
- **Mobile:** The menu expands below the top bar, preserving account, role, language, and install actions.

### Booking Flow
The booking flow should prioritize forward motion. Progress indicators use small numbered circles connected by thin lines; provider identity sits above the flow; forms and selection cards stay centered and narrow enough for mobile comprehension.

## 6. Do's and Don'ts

### Do:
- **Do** keep product work surfaces on `#f9fafb` with `#ffffff` content panels and `#e5e7eb` borders.
- **Do** use `#d97706` or the semantic primary token for important actions, selected states, and brand anchors.
- **Do** keep provider management screens dense, scan-friendly, and direct.
- **Do** use role color deliberately: violet for provider context, blue for customer context, green for success.
- **Do** use clear focus states and maintain WCAG AA contrast for bilingual English and Portuguese users.
- **Do** let provider pages express provider identity through logo, imagery, services, and business details.

### Don't:
- **Don't** create generic SaaS dashboards with decorative metric cards and visual filler.
- **Don't** use overdecorated salon aesthetics, beauty stock cliches, or excessive pink/gold treatment.
- **Don't** make Agendaly feel like a sterile enterprise scheduling tool.
- **Don't** create noisy marketplace vibes; provider pages should feel owned by the provider.
- **Don't** translate WhatsApp chaos into software with crowded messages, unclear next steps, or too many competing actions.
- **Don't** use colored side-stripe borders greater than 1px on cards, alerts, or list items.
- **Don't** use gradient text, decorative glassmorphism, or oversized hero typography inside operational dashboards.
