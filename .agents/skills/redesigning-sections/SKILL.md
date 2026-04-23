---
name: redesigning-sections
description: "Generates 3-5 design variants for a website component, section, or text element and adds a floating picker to toggle between them. Use when asked to redesign, restyle, rework, or propose alternatives for any UI element."
---

# Redesigning Sections

Generate multiple design variants for a website element and let the user preview them with a floating picker.

## Workflow

### Step 1 — Understand the Target

1. Read the component or section the user wants redesigned.
2. Note existing conventions: Tailwind classes, shadcn/ui primitives, Framer Motion usage, typography, color palette, spacing patterns.
3. Identify what specifically should change (layout, copy, style, animation, all of the above).
4. Read any sibling or neighboring components to capture the project's design language (colors, fonts, spacing, animation patterns).

### Step 2 — Spawn Sub-Agents to Create Variants

**Do NOT create the variant designs yourself.** Use the `Task` tool to spawn **3–5 sub-agents in parallel**, one per variant. Each sub-agent independently designs and implements its variant.

Each sub-agent Task call must include:

1. **Full context** — paste or reference the original component source, the file path, the project's conventions (libraries, Tailwind version, color palette, existing patterns you noted in Step 1).
2. **A distinct design direction** — give each sub-agent a clear, differentiated creative brief. For example:
   - Variant A: "Minimal and spacious — lots of whitespace, muted tones, subtle fade-in animations"
   - Variant B: "Bold and editorial — large typography, strong color blocks, dramatic motion"
   - Variant C: "Card-based grid layout — compact, information-dense, hover interactions"
   - Variant D: "Split-screen / asymmetric layout — image-heavy, magazine-style"
   - Variant E: "Playful and animated — bouncy Framer Motion, gradients, rounded shapes"
3. **Output requirements** — tell the sub-agent to:
   - Implement the variant as a single named export suffixed with its letter (e.g., `HeroSectionVariantA`).
   - Use only the project's existing libraries (Tailwind v4, shadcn/ui, Framer Motion, Lucide icons). No new dependencies.
   - Make the component fully self-contained — no shared state or external wrappers.
   - Return the **complete component code** as its final output so the main agent can paste it into the file.
4. **The `frontend-design` skill** — tell each sub-agent to load the `frontend-design` skill for design guidance.

**Example Task call structure (repeat for each variant):**

```
Task(
  description: "Design Variant A for PricingSection",
  prompt: """
  Load the `frontend-design` skill.

  You are redesigning the <PricingSection> component.
  Here is the original source: [paste full component code]
  File path: src/components/landing/PricingSection.tsx

  Project conventions:
  - Tailwind v4, shadcn/ui, Framer Motion, Lucide icons
  - [paste relevant color/font/spacing notes]

  Creative direction: Minimal and spacious — lots of whitespace, muted tones, subtle fade-in animations.

  Requirements:
  - Export a single component named `PricingSectionVariantA`.
  - Use only existing project libraries. Do not add dependencies.
  - Component must be fully self-contained.
  - Return the complete component code (imports + component) as your final answer.
  """
)
```

### Step 3 — Assemble Variants and Add the Picker

Once all sub-agents return:

1. **Add each variant** to the same file as the original component. Append all variant components below the original. Keep the original component intact — do not modify it.
2. **Create the `VariantPicker`** component (if it doesn't already exist) at the appropriate path for the project (e.g., `src/components/VariantPicker.tsx`). See the reference implementation below.
3. In the **parent page or layout** that renders the target component, wire up the switcher:
   - Import all variants and the `VariantPicker`.
   - Use a `useState` to track the active variant index.
   - Render the active variant conditionally.
   - Render `<VariantPicker>` alongside it.

### Step 4 — Present to the User

1. Briefly describe each variant (1-2 sentences each) so the user understands the design direction before previewing.
2. Tell the user to run the dev server (if not already running) and toggle through variants in the browser.

### Step 5 — Finalize Selection

When the user picks a variant:

1. Replace the original component's implementation with the chosen variant's code.
2. Remove all other variant components from the file.
3. Remove the `VariantPicker` import and usage from the parent.
4. Delete the `VariantPicker.tsx` file if no other redesign is in progress.
5. Clean up any unused imports.

## VariantPicker Reference Implementation

```tsx
import { useState } from "react";

interface VariantPickerProps {
  variants: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function VariantPicker({ variants, activeIndex, onChange }: VariantPickerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
      <button
        onClick={() => onChange((activeIndex - 1 + variants.length) % variants.length)}
        className="rounded-full p-1 transition-colors hover:bg-white/20"
        aria-label="Previous variant"
      >
        ←
      </button>
      <span className="min-w-[80px] text-center font-medium">
        {variants[activeIndex]}
      </span>
      <button
        onClick={() => onChange((activeIndex + 1) % variants.length)}
        className="rounded-full p-1 transition-colors hover:bg-white/20"
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}
```

## Astro Projects

Astro renders React components as static HTML by default — `useState`, `onClick`, and all interactivity are stripped out unless the component is **hydrated** with a `client:` directive.

When the variant picker needs to work in an Astro project:

1. **Identify the `.astro` page** that renders the parent React component (e.g., `src/pages/index.astro`).
2. **Add `client:load`** to the React component that holds the `useState` for the variant switcher. For example, change `<LandingPage />` to `<LandingPage client:load />`.
3. If the parent component was previously rendered without a `client:` directive (purely static), adding `client:load` ships the entire component tree as client-side JS. This is fine during the redesign phase; it can be reverted when finalizing.
4. During **finalization** (Step 5), after replacing the original with the chosen variant and removing the picker, also **remove the `client:load` directive** if the component no longer needs client-side interactivity, restoring static rendering.

**Quick checklist before testing the picker:**
- [ ] The React component using `useState` has a `client:load` (or `client:visible`) directive on its Astro usage site.
- [ ] The `VariantPicker` is rendered **inside** that hydrated component, not in a separate non-hydrated island.

## Rules

- **The main agent must NOT design variants itself.** All variant creation must happen in parallel sub-agent Tasks.
- Never delete or modify the original component until the user makes a final selection.
- Each variant must be self-contained — no shared state or wrappers between variants.
- Keep all variant code in the same file as the original to minimize file churn.
- Respect the project's existing design language (colors, fonts, spacing) unless the user explicitly asks for a departure.
- If the component is very large (> 200 lines), consider redesigning only the specific sub-section the user mentions rather than the entire component.
