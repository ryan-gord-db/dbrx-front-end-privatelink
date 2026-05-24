# Databricks Front-End PrivateLink Visual Explainer

An interactive single-page reference that visualizes DNS resolution and network connectivity paths for Databricks front-end PrivateLink on AWS. Built for customer network and cloud engineers evaluating or implementing PrivateLink configurations.

**[Live Site](https://pages.github.com/)** · **[PRD](PRD.md)**

---

## What This Does

Databricks front-end PrivateLink has several DNS configuration patterns, each with different trade-offs. This tool lets engineers select a scenario and instantly see:

- An **animated SVG diagram** showing the full DNS resolution and data flow
- A **step-by-step breakdown** of how each query resolves
- **Side-by-side comparison** of any two scenarios
- A **component reference table** listing every AWS and Databricks resource involved

### Scenarios

| Scenario | Description |
|----------|-------------|
| **Public Path** | Baseline — no PrivateLink. DNS resolves publicly over the internet. |
| **Wildcard Forward** | On-prem DNS forwards `*.cloud.databricks.com` to Route 53 Inbound Resolver via Direct Connect/VPN. All workspaces resolve privately through a single regional PHZ. |
| **Per-Workspace PHZ** | Same wildcard forwarding from on-prem, but each workspace gets its own Private Hosted Zone and can route through a different VPCE (prod vs. dev isolation). |
| **Workspace Forward** | On-prem DNS forwards only specific workspace domains. Other workspaces resolve publicly. More surgical, but requires forwarding multiple domains per workspace. |

## Getting Started

No build step, no dependencies. Just open the file or serve it:

```bash
# Option 1: open directly
open index.html

# Option 2: local server
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Diagram Interaction

- **Auto mode** (default): continuous animation showing the full resolution and data flow
- **Step-through mode**: click Next/Prev to walk through each numbered resolution step — useful for presenting in meetings
- **Compare mode**: select any two scenarios for side-by-side comparison with difference highlighting
- **Export PDF**: renders a print-friendly static view via `window.print()`

## Project Structure

```
index.html                  Single-page entry point
css/
  styles.css                Layout, branding, component styles
  animations.css            SVG/CSS animation keyframes
js/
  scenarios.js              Scenario data and switching logic
  diagrams.js               SVG diagram rendering and animation control
  main.js                   Init, event listeners, UI controls
assets/
  databricks-logo.svg       Header logo
  favicon.svg               Browser tab icon
PRD.md                      Full product requirements document
```

## Tech Stack

- **Plain HTML / CSS / JS** — no frameworks, no build step, no external dependencies
- **Inline SVG + CSS animations** — crisp at any resolution, no image assets for diagrams
- **Desktop-optimized** — designed for 1280px+ viewports (network engineers on laptops/desktops)
- **Works offline** — after initial load, no external fetches required

## Deployment

Designed for GitHub Pages. Push to `main` and enable Pages in repo settings, or serve from any static file host.

## References

- [Databricks PrivateLink Documentation](https://docs.databricks.com/en/security/network/classic/privatelink.html)
- [AWS VPC Endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html)
- [Route 53 Resolver](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html)
