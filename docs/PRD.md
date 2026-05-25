# Product Requirements Document: Databricks Front-End PrivateLink Visual Explainer

**Status:** Draft
**Author:** Ryan Gordon
**Created:** 2026-05-24
**Last Updated:** 2026-05-24

---

## 1. Overview

A single-page static website that visually explains the DNS resolution and network path options for Databricks front-end PrivateLink on AWS. The page uses a scenario selector to update animated diagrams and text summaries in-place, allowing customer engineers to see the end-to-end resolution and connectivity flow for each configuration pattern.

## 2. Target Audience

**Customer network and cloud engineers** evaluating or implementing Databricks front-end PrivateLink. The content assumes familiarity with AWS networking concepts (VPCs, VPCEs, Route 53, DNS forwarding) but does not assume prior Databricks PrivateLink knowledge.

## 3. Scope

- **Cloud:** AWS only
- **Endpoints covered:** Front-end workspace VPCE and Route 53 Inbound Resolver VPCE
- **Out of scope:** Back-end SCC relay VPCE, DBFS/S3 VPCE, Azure Private Link, GCP Private Service Connect

## 4. Scenarios

The page presents a scenario selector (e.g., segmented control or dropdown) that switches the entire page content. Five scenarios, presented in this order:

### Scenario 0 — Public Path (Baseline)
- **Purpose:** Establish the default resolution path when PrivateLink is not configured
- **Flow:** On-prem client -> corporate DNS server -> public DNS (recursive resolution) -> public IP returned to client -> internet -> Databricks control plane
- **Why it matters:** Gives the viewer a reference point so they can see exactly what changes with each PrivateLink scenario

### Option 1 (Scenario A) — On-Prem: Forward `*.cloud.databricks.com` + `*.aws.databricksapps.com`
- **Purpose:** Show wildcard DNS forwarding from on-premises to AWS
- **Flow:** On-prem client -> on-prem DNS resolver -> conditional forwarders (`*.cloud.databricks.com` and `*.aws.databricksapps.com`) -> Route 53 Inbound Resolver VPCE -> Route 53 Private Hosted Zone -> VPCE ENI private IP -> Databricks control plane
- **Key components:** On-prem DNS server, two conditional forwarding rules (one per domain), Direct Connect / VPN, Route 53 Inbound Resolver endpoint (VPCE), Route 53 PHZ, front-end workspace VPCE

### Option 2 (Scenario B) — Per-Workspace PHZ (Wildcard Forward + Per-Workspace Route 53 PHZs)
- **Purpose:** Show wildcard DNS forwarding from on-prem (same as Scenario A) combined with per-workspace Private Hosted Zones in Route 53 instead of a single regional PHZ
- **Flow:** On-prem client → on-prem DNS → conditional forwarder (`*.cloud.databricks.com`) → DX/VPN → Route 53 Inbound Resolver → per-workspace PHZ (e.g., `prod-wksp.cloud.databricks.com`) → CNAME to workspace-specific VPCE → VPCE ENI private IP → Databricks control plane
- **Key difference from Scenario A:** Instead of one PHZ for `privatelink.cloud.databricks.com` with a single regional A record that routes all workspaces to the same VPCE, each workspace gets its own PHZ (`<workspace>.cloud.databricks.com`) with a CNAME record pointing to a workspace-specific VPCE. This allows different workspaces to use different VPCEs (e.g., prod workspace → prod VPCE, dev workspace → dev VPCE) and ensures only workspaces with a PHZ resolve privately — workspaces without a PHZ fall through to public DNS.
- **Use case:** Best when only a subset of workspaces need front-end PrivateLink, or when workspaces must route through different VPCEs for environment isolation (prod vs. dev, compliance boundaries, etc.)

### Option 3 (Scenario C) — On-Prem: Forward Specific Workspace Domains
- **Purpose:** Show targeted forwarding for a single workspace and its associated domains
- **Flow:** Same as Scenario A but the conditional forwarders target specific domains instead of the wildcard: `<workspace-name>.cloud.databricks.com`, `dbc-dp-<workspace-id>.cloud.databricks.com` (data plane relay), and any Databricks Apps domains (`<app-name>.aws.databricksapps.com`) tied to the workspace
- **Key difference:** More surgical DNS configuration; other Databricks workspaces resolve publicly. Requires forwarding multiple domains per workspace (workspace URL, data plane relay, each app). Diagram highlights the forwarding rule difference.

### Option 4 (Scenario D) — On-Prem: Corporate DNS Resolution Only (No Route 53)
- **Purpose:** Show DNS resolution handled entirely within corporate DNS infrastructure — no Route 53 Inbound Resolver or Private Hosted Zones involved
- **Flow:** On-prem client → corporate DNS server (static A record / CNAME override / RPZ rule) → returns VPCE ENI private IP → client sends HTTPS over DX/VPN → front-end VPCE → PrivateLink → Databricks control plane
- **Key difference:** No AWS-side DNS infrastructure (no Route 53 Inbound Resolver, no PHZ). All DNS resolution stays on-prem. DNS platforms differ significantly so implementation is platform-dependent (Windows DNS, BIND, Infoblox, Bluecat, etc.). Must map all workspaces of interest and their Databricks Apps domains to the VPCE private IP. Some platforms support CNAME overrides and Response Policy Zones (RPZ) which simplify the process.
- **Use case:** Best when the organization wants to keep all DNS resolution within its existing corporate DNS platform and avoid deploying Route 53 Inbound Resolver endpoints.

## 5. Page Layout & UX

### 5.1 Structure (Single Page)
```
+--------------------------------------------------+
|  Header: Databricks logo + title                 |
+--------------------------------------------------+
|  Scenario Selector (segmented control)           |
|  [ Public Path | Opt 1: Wildcard Fwd | Opt 2: Per-WS PHZ | Opt 3: Workspace Fwd | Opt 4: On-Prem DNS ] |
+--------------------------------------------------+
|  Animated Diagram Area                           |
|  (SVG/CSS, updates per scenario)                 |
|                                                  |
|  [ Auto | Step-through ] toggle                  |
+--------------------------------------------------+
|  Summary Text                                    |
|  - High-level overview (always visible)          |
|  - Expandable: step-by-step resolution detail    |
+--------------------------------------------------+
|  Collapsible: Configuration Snippets             |
|  (AWS CLI, Terraform, console steps)             |
+--------------------------------------------------+
|  Component Reference Table                       |
|  (per-scenario list of AWS/Databricks resources) |
+--------------------------------------------------+
|  Footer                                          |
+--------------------------------------------------+
```

### 5.2 Scenario Selector
- Segmented control at the top of the page
- Selecting a scenario updates all sections below (diagram, summary, config snippets, component table) in-place without page reload
- Active scenario is visually highlighted

### 5.3 Diagram Area
- **Animated SVG/CSS** diagrams rendered inline (not images)
- Databricks-specific components: workspace URL, control plane, data plane, VPCE service
- AWS components: VPC, subnets, Route 53 PHZ, Route 53 Inbound Resolver, VPCE ENI, Direct Connect/VPN gateway
- On-prem components (Scenarios A/B): corporate DNS server, on-prem network, client device
- **Two animation modes:**
  - **Auto-animated loop** (default): continuous animation showing the full DNS resolution and data flow with moving packets/arrows
  - **Step-through mode**: user clicks "Next" to advance through each numbered resolution step; each step highlights the active component and path segment
- Toggle between modes via a button above or below the diagram

### 5.4 Text Summary
- **High-level overview** (always visible): 2-3 sentence summary of what this scenario does and when to use it
- **Expandable detailed steps**: numbered resolution flow (e.g., "1. Client queries on-prem DNS for workspace.cloud.databricks.com -> 2. Conditional forwarder matches *.cloud.databricks.com -> 3. Query forwarded over DX/VPN to Route 53 Inbound Resolver ENI...") — toggled via an expand/collapse control

### 5.5 Configuration Snippets
- Hidden behind a collapsible section ("Show Configuration")
- Per-scenario relevant snippets:
  - Route 53 PHZ CNAME/ALIAS record examples
  - AWS CLI commands for creating VPCEs, inbound resolver endpoints
  - Terraform resource blocks
  - On-prem DNS conditional forwarder config examples (Windows DNS, BIND)
- Code blocks with syntax highlighting and a copy button

### 5.6 Component Reference Table
- Per-scenario table listing each component, its role, and relevant configuration detail
- Columns: Component | Purpose | Key Configuration

## 6. Diagram Components & Visual Language

### 6.1 Databricks Components
| Component | Visual | Notes |
|-----------|--------|-------|
| Databricks Control Plane | Rounded box, Databricks orange | Shows workspace URL |
| VPCE Service (Databricks-side) | Service icon in control plane | The endpoint service Databricks hosts |
| Workspace URL | Label on connection arrow | e.g., `workspace.cloud.databricks.com` |

### 6.2 AWS Components
| Component | Visual | Notes |
|-----------|--------|-------|
| Customer VPC | Dashed border box | Contains subnets, VPCEs |
| Front-end VPCE | Interface endpoint icon in VPC | Shows ENI with private IP |
| Route 53 PHZ | DNS icon associated with VPC | Shows the CNAME/ALIAS record |
| Route 53 Inbound Resolver | Resolver endpoint icon in VPC | Shows ENI IPs for forwarding targets |
| Direct Connect / VPN | Connection line with DX/VPN label | Between on-prem and VPC |

### 6.3 On-Prem Components (Scenarios A & B)
| Component | Visual | Notes |
|-----------|--------|-------|
| On-prem network | Box with building/office icon | Contains DNS server and client |
| Corporate DNS server | Server icon | Shows conditional forwarding rule |
| Client device | Laptop/desktop icon | Origin of the DNS query |

### 6.4 Animation Flow
- **DNS query path:** Dashed animated line (e.g., blue)
- **DNS response path:** Dashed animated line (e.g., green), reverse direction
- **Data/HTTPS path:** Solid animated line (e.g., orange) from client through VPCE to control plane
- Each step numbered; in step-through mode, only the active step animates

## 7. Technical Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Plain HTML / CSS / JS | No build step; simplest deployment to any static host |
| Diagrams | Inline SVG + CSS animations | No external dependencies; crisp at any resolution |
| Hosting | GitHub Pages | Free, integrates with repo, custom domain support |
| Branding | Light Databricks | Databricks color palette (#FF3621 orange, #1B3139 dark, #00A972 green) and logo in header; DM Sans font optional; not a full brand treatment |
| Responsive | Desktop-optimized | Target audience is network engineers on desktops/laptops |

### 7.1 File Structure
```
/
  index.html          — Single-page entry point
  css/
    styles.css        — Layout, branding, component styles
    animations.css    — SVG/CSS animation keyframes
  js/
    scenarios.js      — Scenario data and switching logic
    diagrams.js       — SVG diagram rendering and animation control
    main.js           — Init, event listeners, UI controls
  assets/
    databricks-logo.svg
  docs/
    PRD.md            — This document
  CLAUDE.md           — Agent instructions (points to docs/PRD.md)
  .cursorrules        — Cursor AI instructions (points to docs/PRD.md)
  README.md           — Project overview and dev instructions
```

## 8. Non-Functional Requirements

- **No build step:** The site must work by opening `index.html` directly or serving from any static file server
- **No external runtime dependencies:** No CDN-loaded libraries; all JS/CSS is local
- **Desktop-optimized:** Minimum viewport 1280px wide; graceful degradation below that is acceptable but not required
- **Performance:** Page load under 2s on a typical corporate network; diagrams render without jank
- **Accessibility:** Semantic HTML; diagram alt-text / aria-labels for screen readers (best effort, not WCAG AA target)

## 9. Success Criteria

1. A customer engineer can select each scenario and immediately understand the DNS resolution path and required components
2. The animated diagrams clearly show the flow direction and sequence of resolution
3. Step-through mode allows a presenter to walk through the flow in a meeting
4. Configuration snippets give the viewer enough to start implementation
5. The page loads and works entirely offline after initial download (no external fetches)

## 10. Compare Mode

- A "Compare" toggle or button enables side-by-side comparison of any two scenarios
- Layout: two diagrams rendered at reduced scale, stacked horizontally, with their respective summary text beneath each
- The viewer selects which two scenarios to compare via two independent dropdowns
- Differences between the two scenarios (e.g., components present in one but not the other) should be visually highlighted (e.g., dimmed or outlined)

## 11. PDF / Print Export

- A "Export PDF" button generates a print-friendly view of the currently selected scenario (or comparison)
- The print view uses `@media print` CSS to:
  - Render diagrams as static SVGs (no animation)
  - Expand all collapsed sections (detailed steps, config snippets)
  - Use black/white-friendly colors with the Databricks logo
- The viewer can use the browser's native Print > Save as PDF, triggered by the export button calling `window.print()`

## 12. External Links

- The page should link to the official Databricks PrivateLink documentation where relevant
- Links appear in the component reference table and in configuration snippet sections as "See Databricks docs" references
- Links open in a new tab (`target="_blank"`)

## 13. Resolved Decisions

| Question | Decision |
|----------|----------|
| Compare mode? | Yes — side-by-side two-scenario comparison |
| PDF export? | Yes — print-friendly view via `@media print` + export button |
| Multi-region / cross-account VPCE? | No — out of scope |
| Link to Databricks docs? | Yes — contextual links in component tables and config snippets |
