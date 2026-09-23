---
name: TechMed Modern
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434657'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#747688'
  outline-variant: '#c4c5da'
  surface-tint: '#0046fa'
  primary: '#0035c5'
  on-primary: '#ffffff'
  primary-container: '#0047ff'
  on-primary-container: '#d4d9ff'
  inverse-primary: '#b9c3ff'
  secondary: '#00677f'
  on-secondary: '#ffffff'
  secondary-container: '#00ccf9'
  on-secondary-container: '#005266'
  tertiary: '#3130c0'
  on-tertiary: '#ffffff'
  tertiary-container: '#4b4dd8'
  on-tertiary-container: '#d9d8ff'
  error: '#EF4444'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001257'
  on-primary-fixed-variant: '#0033c0'
  secondary-fixed: '#b7eaff'
  secondary-fixed-dim: '#4cd6ff'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#004e60'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  slate-900: '#0F172A'
  slate-600: '#475569'
  slate-400: '#94A3B8'
  slate-200: '#E2E8F0'
  success: '#10B981'
  warning: '#F59E0B'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.04em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: -0.011em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: -0.009em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  gap-xs: 4px
  gap-sm: 8px
  gap-md: 16px
  gap-lg: 32px
  gap-xl: 64px
---

## Brand & Style

This design system represents a shift from sterile institutionalism to a high-performance **TechMed** aesthetic. The personality is defined by technological sophistication, clinical precision, and "velvet-glove" reliability. It is designed for modern healthcare professionals who require the efficiency of a high-end SaaS tool combined with the life-critical trustworthiness of medical software.

The visual style is **Modern / Corporate** with a "Soft Flat" influence. It moves away from rigid boxy structures in favor of fluid surfaces, micro-elevations, and refined optical balance. By utilizing subtle background fills and high-precision typography, the interface feels less like a legacy database and more like a high-performance operating system for medicine. The emotional response should be one of calm, ultra-efficient control and advanced technical capability.

## Colors

The color strategy transitions from "Clinical Blue" to a more vibrant **Electric Indigo** (#0047FF), signaling modern technology and speed.

- **Primary (Tech Blue):** Used for primary actions, critical navigation, and active states. It provides a high-energy focal point against the neutral background.
- **Surface & Background:** The base of the application uses an off-white **Slate-tinted Neutral** (#F8FAFC). This reduces eye strain compared to pure white while maintaining a clean, high-end feel.
- **Depth Layers:** Depth is created using a palette of Slate Grays. `slate-200` is used for subtle container fills, while `slate-900` ensures maximum readability for primary text.
- **Semantic Colors:** Success, error, and warning states use vibrant, high-saturation tones that harmonize with the Electric Indigo primary, moving away from the "blood red" of the previous system to a more "digital alert" palette.

## Typography

This system uses a dual-font strategy to maximize precision and modern appeal. **Geist** is used for headlines and data-heavy labels for its technical, mono-spaced influence and sharp terminals. **Inter** is used for body text to ensure maximum legibility at all sizes.

- **Precision Hierarchy:** Letter-spacing is tightened on larger headlines (-0.04em) to create a "locked-in," professional appearance.
- **Data Display:** `numeric-data` uses Geist's high-precision numerals for patient vitals, ensuring they stand out from standard body text.
- **Labels:** Small labels use uppercase with tracking (0.05em) to provide clear section headers without overwhelming the data.

## Layout & Spacing

The design system utilizes a **4px base grid** for tight, purposeful spacing. The layout philosophy is a **Fluid Grid** with fixed maximum widths for content readability.

- **Breakpoints:** 
    - Mobile: 0 - 599px (4 columns, 16px margins)
    - Tablet: 600 - 1023px (8 columns, 24px margins)
    - Desktop: 1024px+ (12 columns, 48px margins)
- **Reflow:** On desktop, data sidebars are pinned, while the primary medical feed expands. On mobile, sidebars collapse into a bottom-sheet or drawer navigation.
- **Rhythm:** Use `gap-lg` for separating major modules (e.g., Patient Info vs. Treatment Plan) and `gap-sm` for internal component relationships.

## Elevation & Depth

This system moves away from flat borders in favor of **Micro-Elevations**. Hierarchy is established through layering and soft, diffused shadows.

- **Tier 1 (Surface):** The background canvas.
- **Tier 2 (Card/Container):** Uses a subtle background fill (`slate-100`) or a white surface with an ultra-soft ambient shadow: `0 4px 12px rgba(15, 23, 42, 0.04)`.
- **Tier 3 (Popovers/Modals):** High elevation with a more pronounced shadow to indicate temporary interaction: `0 12px 32px rgba(15, 23, 42, 0.08)`.
- **Shadow Tinting:** All shadows use a tiny amount of the neutral Slate tint to prevent a "dirty" gray appearance, ensuring the UI remains clean and "medical-grade."

## Shapes

The shape language is **Rounded (0.5rem base)**. This softens the high-tech aesthetic, making it feel like a modern consumer-grade "app" rather than a cold clinical tool.

- **Standard Elements:** Buttons, inputs, and small cards use 8px (`rounded-md`).
- **Large Containers:** Dashboard widgets and main content areas use 16px (`rounded-xl`) to create a distinct framing effect.
- **Interactive Pills:** Search bars and status tags use a full pill radius to clearly distinguish them from functional action buttons.

## Components

- **Buttons:** Primary buttons are solid `primary-color` with white text. They feature a subtle inner-glow on top to provide a "soft flat" 3D feel. Secondary buttons use a light slate fill instead of an outline.
- **Input Fields:** Fields use a subtle background fill of `slate-100` with no border. On focus, they transition to a white background with a 2px `primary-color` outline and a soft glow.
- **Cards:** Cards should have no borders. They are defined by their 16px corner radius and either a white background with a soft shadow or a very light `slate-50` fill.
- **Chips & Tags:** Status chips (e.g., "Stable", "Critical") use a high-contrast background with 15% opacity of the semantic color and bold 700-weight text in the same color for maximum scannability.
- **Data Lists:** Use clean rows with 12px padding. Remove horizontal dividers; instead, use a subtle `slate-50` hover state to indicate interactivity.
- **Data Visualizations:** Charts should use the `primary-color` and `secondary-color` gradients, with 2px stroke widths for line graphs to maintain a "high-precision" look.