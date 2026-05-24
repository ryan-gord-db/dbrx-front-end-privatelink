# Front-End PrivateLink Visual Explainer

## Project Context
Read [PRD.md](PRD.md) before doing any work on this project. It contains the full product requirements, scenario definitions, page layout, diagram specifications, and technical stack decisions.

## Key Decisions
- **Single page, plain HTML/CSS/JS** — no frameworks, no build step
- **Animated SVG/CSS diagrams** — inline SVG with CSS animations, no external libraries
- **Scenario selector** switches all page content in-place (diagram, summary, config snippets, component table)
- **Databricks-specific** components (control plane, workspace URL, VPCE service)
- **Light Databricks branding** — color palette (#FF3621, #1B3139, #00A972), logo in header
- **GitHub Pages** hosting target
- **Desktop-optimized** — minimum 1280px viewport

## Scenarios (in order)
0. Public Path (baseline, no PrivateLink)
1. On-prem wildcard forwarding (`*.cloud.databricks.com`)
2. On-prem specific workspace forwarding (`<workspace>.cloud.databricks.com`)

## Diagram Animation
- Two modes: auto-animated loop (default) and step-through (click to advance)
- DNS query = blue dashed, DNS response = green dashed, HTTPS data = orange solid

## Additional Features
- **Compare mode:** Side-by-side comparison of any two scenarios with difference highlighting
- **PDF export:** `@media print` CSS + export button; expands all collapsed sections, renders static SVGs
- **External links:** Contextual links to official Databricks PrivateLink docs in component tables and config snippets

## File Structure
See PRD.md Section 7.1 for the expected file layout.
