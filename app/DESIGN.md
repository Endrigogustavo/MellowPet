---
version: alpha
name: MellowPet
description: Calm, empathetic, tactile design system for MellowPet emotional companionship and local expression awareness.
colors:
  brand-plum: "#4A3550"
  brand-cream: "#FAF6F2"
  brand-peach: "#FFC9A8"
  brand-rose: "#F3AEB6"
  brand-lilac: "#C6A9F0"
  page: "#EFE9E2"
  background: "#FAF6F2"
  surface: "#FFFFFF"
  surface-warm: "#F6EFE8"
  border: "#E6DFD7"
  border-subtle: "#EFE9E1"
  foreground: "#2B1E30"
  foreground-secondary: "#5C4963"
  foreground-muted: "#745F7C"
  primary: "#684878"
  primary-soft: "#F3ECF7"
  on-primary: "#FFFFFF"
  seal-body: "#ECE2D8"
  seal-belly: "#F7D9C6"
  seal-line: "#4A3550"
  seal-whisker: "#B59EB3"
  status-ok: "#287D5E"
  status-warn: "#9E5A10"
  status-danger: "#C23E3E"
  emotion-happy: "#FFD166"
  emotion-happy-ink: "#8A5A00"
  emotion-sad: "#74B9FF"
  emotion-sad-ink: "#235A94"
  emotion-angry: "#FF7675"
  emotion-angry-ink: "#A63232"
  emotion-neutral: "#B2BEC3"
  emotion-neutral-ink: "#4E5B61"
  emotion-surprised: "#FD79A8"
  emotion-surprised-ink: "#9E2B59"
  emotion-disgusted: "#55EFC4"
  emotion-disgusted-ink: "#1B6E56"
  emotion-fearful: "#A29BFE"
  emotion-fearful-ink: "#4B429E"
typography:
  display:
    fontFamily: Nunito
    fontSize: 44px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Nunito
    fontSize: 30px
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Nunito
    fontSize: 22px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.01em
  title:
    fontFamily: Nunito
    fontSize: 16px
    fontWeight: 800
    lineHeight: 1.3
  body-lg:
    fontFamily: Nunito
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Nunito
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.2
  caption:
    fontFamily: Nunito
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
rounded:
  xs: 8px
  control: 14px
  card: 22px
  stage: 28px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    padding: 16px
    height: 52px
  chip:
    backgroundColor: "{colors.surface-warm}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.control}"
    padding: 12px
    height: 44px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: 18px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: 14px
    height: 50px
---

# MellowPet Design System

## Overview

MellowPet is a privacy-first emotional well-being companion where **Mellow** (an illustrated vector seal and companion menagerie) responds to local, on-device facial expression cues, daily check-ins, calming soundscapes, and caregiver support links.

The visual identity rejects generic SaaS analytics clichés, cold hospital grays, and electric neon purples. Instead, MellowPet feels like a quiet, sunlit ceramic object and a warm paper journal: organic limestone surfaces, deep plum ink drawn directly from Mellow's eyes and whiskers, generous negative space around the pet stage, and calm tactile micro-interactions.

Every screen is governed by one explicit **Interface Mode**:

| Surface | Interface Mode | Intent & Visual Posture |
|---|---|---|
| **Home (Mellow Stage), Splash, Lullaby, Growth Ceremony** | `Experience` | The pet leads and breathes in generous negative space; chrome, borders, and secondary metrics recede until needed. |
| **Check-in, Diário, Ferramentas, Rotina, Chat, Login, Ajustes** | `Operate` | Ergonomic clarity, zero-friction logging, tactile `>= 44x44px` touch targets, and immediate press feedback (`scale 0.97` in `120-160ms`). |
| **Bem-estar (Dashboard), Mapa Emocional (Heatmap), Painel do Cuidador** | `Read` / `Operate` | Calm comprehension of emotional patterns over time; clean hierarchy, accessible contrast, and zero alarmist visual noise. |

## Colors

MellowPet's palette originates from the canonical vector geometry in `brand/mellow_mark.py`: warm cream (`#FAF6F2`), deep plum (`#4A3550`), peach blush (`#FFC9A8`), soft rose (`#F3AEB6`), and gentle lilac (`#C6A9F0`).

- **Canvas & Surfaces:** Light mode rests on warm limestone cream (`background`) with pure white elevated containers (`surface`) and warm sand hairlines (`border`), eliminating cold blue-gray SaaS backgrounds.
- **Plum Ink Hierarchy:** All text tones carry a subtle plum warmth (`foreground`, `foreground-secondary`, `foreground-muted`). Every text tier, including captions and placeholders (`foreground-muted`), maintains at least **4.5:1 WCAG AA** contrast against both `background` and `surface`.
- **Single Intentional Accent:** `primary` (warm berry-plum in Light, soft luminous lilac in Dark) is reserved for primary actions, active navigation states, and focused controls.
- **Emotion Fill vs. Emotion Ink:** Pastel emotion fills (`emotion-happy`, `emotion-disgusted`, `emotion-neutral`) are used only for soft halos, badges, and chart bars. Whenever an emotion is rendered as text or an icon on a light surface, pair it with its dedicated accessible ink (`emotion-happy-ink`, etc.).

```design-tokens
fonts: Nunito
colors: #4A3550, #FAF6F2, #FFC9A8, #F3AEB6, #C6A9F0, #EFE9E2, #FFFFFF, #F6EFE8, #E6DFD7, #EFE9E1, #2B1E30, #5C4963, #745F7C, #684878, #F3ECF7, #ECE2D8, #F7D9C6, #B59EB3, #287D5E, #9E5A10, #C23E3E, #140E18, #1C1422, #281D30, #D4C5DC, #AE9CB8, #CCAFF2, #221529
radii: 0, 8px, 14px, 22px, 28px, 9999px
```

## Themes

Light mode is the daytime journal default; Dark mode is a nocturnal plum sanctuary designed for evening wind-down and lullaby sessions without OLED harshness.

| Semantic Token | `palette.ts` Key | Light Value | Dark Value | Minimum WCAG Contrast |
|---|---|---|---|---|
| `page` | `page` | `#EFE9E2` | `#140E18` | Outer frame |
| `background` | `bg` | `#FAF6F2` | `#1C1422` | Base canvas |
| `surface` | `surf` | `#FFFFFF` | `#281D30` | Tonal elevation |
| `surface-warm` | `surfWarm` | `#F6EFE8` | `#23192B` | Quiet secondary fill |
| `border` | `bd` | `#E6DFD7` | `rgba(250,246,242,0.11)` | Subtle structural boundary |
| `border-subtle` | `bdL` | `#EFE9E1` | `rgba(250,246,242,0.07)` | Track & inner divider |
| `foreground` | `t1` | `#2B1E30` | `#FAF6F2` | >= 14.6:1 (AAA) |
| `foreground-secondary` | `t2` | `#5C4963` | `#D4C5DC` | >= 7.5:1 (AAA) |
| `foreground-muted` | `t3` | `#745F7C` | `#AE9CB8` | >= 5.3:1 (AA) |
| `primary` | `pri` | `#684878` | `#CCAFF2` | >= 7.0:1 on canvas |
| `primary-soft` | `priL` | `#F3ECF7` | `rgba(204,175,242,0.15)` | Soft selection wash |
| `on-primary` | `onPri` | `#FFFFFF` | `#221529` | >= 7.5:1 on `primary` |
| `status-ok` | `ok` | `#287D5E` | `#5EDBA8` | >= 4.6:1 (AA) |
| `status-warn` | `warn` | `#9E5A10` | `#F5BC6B` | >= 4.8:1 (AA) |
| `status-danger` | `danger` | `#C23E3E` | `#F28B8B` | >= 4.8:1 (AA) |

## Typography

MellowPet uses **Nunito** across five explicitly loaded font files (`400Regular`, `600SemiBold`, `700Bold`, `800ExtraBold`, `900Black`) so rounded terminals echo Mellow's organic SVG curves.

- **Headings (`headline-lg`, `headline-md`):** Sentence case, tight negative tracking, and strong weight (`800`). Headings stand on their own without tracked-out uppercase eyebrow labels above them.
- **Reading & Reflection (`body-lg`, `body-md`):** Generous `1.55` line-height for empathetic messages, journal entries, and insight explanations.
- **Inputs (`input-field`):** Always `>= 16px` font size so mobile browsers and iOS WebViews never auto-zoom the viewport on focus.
- **Tabular Numerals:** Timers, streaks, breath counters, and percentages reserve stable width or `tabular-nums` so numbers never jitter as they update.

## Layout

- **Proximity Law (2x Rule):** Spacing between distinct groups (`24px-32px`) must be at least twice the internal spacing within a group (`8px-12px`). Never stack ten identical cards separated by a uniform `10px` gap.
- **Screen Margins & Safe Areas:** Primary content uses `20px` horizontal padding on headers and `16px-20px` on content sections, respecting `react-native-safe-area-context` insets at the top (notch / Dynamic Island) and bottom (home indicator + floating audio dock).
- **Touch Targets:** Every interactive control (emotion faces, feedback buttons, tab items, audio transport, routine delete actions, password reveal) must provide a physical hit area of at least **`44x44px`** via dimensions or `hitSlop`.

## Elevation & Depth

Depth is achieved through **warm tonal layering** (`#FAF6F2` canvas -> `#FFFFFF` surface -> `#F6EFE8` recessed well) rather than heavy drop shadows or colored neon glows.

- **No Colored Glows:** Never put a high-radius colored halo (`shadowColor: pri`) on buttons or floating tabs.
- **Floating Chrome Only:** Soft neutral elevation (`shadowOpacity <= 0.10`, downward offset) is reserved strictly for floating layers that pass over scrolling content (`NowPlayingBar`, `TabBar`, active `Segmented` thumb).

## Shapes

Corner radius communicates hierarchy and role rather than applying a single uniform radius everywhere:

- **Pet Stage & Ceremonial Surfaces (`stage`: `28px`):** Soft, organic framing around Mellow and ritual moments.
- **Primary Content Containers (`card`: `22px`):** Calm, approachable grouping for distinct functional blocks.
- **Interactive Controls & Inputs (`control`: `14px`):** Tactile precision for buttons, chips, and text fields.
- **Pills & Avatars (`full`: `9999px`):** Reserved for segmented rails, circular icon buttons, and Mellow avatar badges.

## Components

- **PetStage (`Experience`):** Occupies open canvas space with breathing room above and below; subtle concentric halo responds to the `4-4-4` guided breath rhythm and gentle touch wobble.
- **Pet Micro-Interactions (`Alimentar` & `Brincar`):**
  - **Alimentar:** Alternates deterministically through 6 custom vector foods (`strawberry`, `fish`, `honey`, `apple`, `cookie`, `berries`). Drives rhythmic chewing mouth frames (`bite` -> `chewA` -> `chewB`), adaptive species paws/flippers, crumb particles, and satisfaction hearts, allowing tasting even when daily meals are full.
  - **Brincar:** Rotates through 5 playful tricks (`spin360`, `headerBall`, `sixSeven`, `bubbleBoop`, `starJuggle`) with anticipation crouch, parabolic ball physics, and species-adapted paw gestures.
- **Delicate Disclosures (Calm First, Details on Demand):**
  - Complex telemetry (such as facial reading signal evidence on Home, or rapid diary entries in Tools) stays tucked behind concise, purposeful disclosure triggers (e.g. delicate `18x18px` `?` indicator or interactive count pill `X registros`) so interfaces remain serene and never dump walls of data unprompted.
- **Touchable & PrimaryButton (`Operate`):** Responds immediately on pointer-down (`scale: 0.97` + subtle opacity shift in `120-160ms` ease-out), paired with gentle haptic feedback on emotional check-in and pet care actions.
- **Cards vs. Quiet Rows:** Use bordered `Card` containers only when grouping heterogeneous controls or highlighting a single focal insight. Lists of Homogeneous items (routine blocks, recent check-ins, trigger bullets) belong inside one shared surface or clean spacing, never chopped into micro-cards.
- **Vector Icons (`Icon`):** Drawn from the unified `24x24` stroke icon set (`strokeLinecap="round"`, `strokeLinejoin="round"`). Never use text arrows (`->`, `↗`) or platform emoji as structural icons.
- **Motion Discipline:** Interactive UI transitions stay between `150ms` and `250ms` using strong `ease-out` curves or calm springs (`damping: 18, stiffness: 180`). Continuous ambient loops (`PetStage`, `SplashScreen`) honor system reduced-motion preferences.

## Do's and Don'ts

- Do let Mellow and white space lead on `HomeScreen` (`Experience` mode) before presenting secondary telemetry.
- Don't place tracked-out `ALL-CAPS` eyebrow labels above every screen title or card heading.
- Do verify `>= 4.5:1` contrast for all text, using darkened emotion inks (`emotion-*-ink`) when rendering emotion labels on light backgrounds.
- Don't use raw `#6C63FF` electric purple, Tailwind cold grays (`#6B7280`, `#9CA3AF`), or text glyph arrows (`->`, `↗`).
- Do enforce `>= 44x44px` hit targets and `>= 16px` input text across all mobile surfaces.
- Don't animate layout properties (`width`, `height`) or run `> 300ms` transitions on frequent navigation and UI controls.

