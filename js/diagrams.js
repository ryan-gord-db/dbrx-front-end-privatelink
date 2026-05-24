/* ============================================================
   diagrams.js — SVG Diagram Renderer & Animation Engine
   ============================================================ */

// eslint-disable-next-line no-unused-vars
const DiagramRenderer = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  // Icon paths (simple shapes)
  const ICONS = {
    laptop: 'M3 2h18a1 1 0 011 1v12H2V3a1 1 0 011-1zm-2 14h22v2H1v-2z',
    server: 'M4 2h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm0 12h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2zM7 6a1 1 0 100-2 1 1 0 000 2zm0 12a1 1 0 100-2 1 1 0 000 2z',
    cloud: 'M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
    dns: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 016.32 12.906l-3.82-3.82V8h-5v5.086l-3.82 3.82A8 8 0 0112 4z',
    shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
    link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  };

  /* ----- SVG element helpers ----- */
  function el(tag, attrs, children) {
    const e = document.createElementNS(NS, tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      });
    }
    return e;
  }

  /* ----- Get centre of a node ----- */
  function centre(node) {
    return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
  }

  /* ----- Edge point on a rectangle nearest to a target point ----- */
  function edgePoint(node, target) {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const hw = node.w / 2;
    const hh = node.h / 2;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const sx = hw / Math.abs(dx || 0.001);
    const sy = hh / Math.abs(dy || 0.001);
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  /* ----- Build node map for quick lookup ----- */
  function nodeMap(diagram) {
    const m = {};
    diagram.nodes.forEach(n => { m[n.id] = n; });
    return m;
  }

  /* ----- Render a single zone (dashed boundary) ----- */
  function renderZone(zone) {
    const g = el('g', { class: 'zone-group', 'data-zone': zone.id });
    g.appendChild(el('rect', {
      x: zone.x, y: zone.y, width: zone.w, height: zone.h,
      class: zone.style,
    }));
    g.appendChild(el('text', {
      x: zone.x + 10, y: zone.y + 18, class: 'zone-label',
    }, zone.label));
    return g;
  }

  /* ----- Render a single node (box + label) ----- */
  function renderNode(node) {
    const g = el('g', {
      class: 'node-group',
      'data-node': node.id,
      transform: `translate(${node.x}, ${node.y})`,
    });
    g.appendChild(el('rect', {
      x: 0, y: 0, width: node.w, height: node.h,
      class: node.style || 'comp-box',
      rx: 6,
    }));
    g.appendChild(el('text', {
      x: node.w / 2, y: node.h / 2 - 6, class: 'comp-label',
    }, node.label));
    if (node.sub) {
      g.appendChild(el('text', {
        x: node.w / 2, y: node.h / 2 + 10, class: 'comp-sublabel',
      }, node.sub));
    }
    return g;
  }

  /* ----- Render a connection (line + optional label + animated packet) ----- */
  function renderConnection(conn, nodes, idx) {
    const fromNode = nodes[conn.from];
    const toNode = nodes[conn.to];
    if (!fromNode || !toNode) return null;

    const fromCentre = centre(fromNode);
    const toCentre = centre(toNode);
    const p1 = edgePoint(fromNode, toCentre);
    const p2 = edgePoint(toNode, fromCentre);

    const g = el('g', {
      class: 'conn-group',
      'data-step': conn.step,
      'data-conn-idx': idx,
    });

    // Connection class
    const typeClass = conn.type === 'dns-query' ? 'conn-dns-query'
                    : conn.type === 'dns-response' ? 'conn-dns-response'
                    : 'conn-https';

    // Path id for motion path
    const pathId = `path-${conn.from}-${conn.to}-${idx}`;

    // Curved path (slight arc for visual clarity)
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    // Offset the midpoint perpendicular to the line for a slight curve
    // Use idx to spread parallel connections apart
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const baseOffset = Math.min(len * 0.15, 25);
    const spreadFactor = (idx % 3 - 1) * 6; // spread parallel conns
    const offset = baseOffset + spreadFactor;
    const nx = -dy / len * offset;
    const ny = dx / len * offset;
    const cx_ = mx + nx;
    const cy_ = my + ny;

    const pathD = `M${p1.x},${p1.y} Q${cx_},${cy_} ${p2.x},${p2.y}`;

    g.appendChild(el('path', {
      d: pathD,
      class: typeClass,
      id: pathId,
    }));

    // Label offset from midpoint (above the curve)
    if (conn.label) {
      g.appendChild(el('text', {
        x: cx_, y: cy_ - 12, class: 'conn-label',
      }, conn.label));
    }

    // Animated packet dot
    const packetClass = conn.type === 'dns-query' ? 'packet-dns-query'
                      : conn.type === 'dns-response' ? 'packet-dns-response'
                      : 'packet-https';

    const packet = el('circle', {
      r: 4,
      class: packetClass,
      style: `offset-path: path('${pathD}'); animation-delay: ${idx * 0.35}s;`,
    });
    g.appendChild(packet);

    // Step badge
    const badgeCx = p1.x + (cx_ - p1.x) * 0.3;
    const badgeCy = p1.y + (cy_ - p1.y) * 0.3 - 12;
    g.appendChild(el('circle', {
      cx: badgeCx, cy: badgeCy, r: 8, class: 'step-badge-bg',
    }));
    g.appendChild(el('text', {
      x: badgeCx, y: badgeCy, class: 'step-badge',
    }, String(conn.step)));

    return g;
  }

  /* ----- Render legend ----- */
  function renderLegend(y) {
    const g = el('g', { class: 'legend', transform: `translate(30, ${y})` });
    const items = [
      { color: '#137CBD', dash: '6 4', label: 'DNS Query' },
      { color: '#00A972', dash: '6 4', label: 'DNS Response' },
      { color: '#FF3621', dash: '',    label: 'HTTPS Data' },
    ];
    items.forEach((item, i) => {
      const x = i * 160;
      const lineAttrs = {
        x1: x, y1: 0, x2: x + 30, y2: 0,
        stroke: item.color,
        'stroke-width': 2,
      };
      if (item.dash) lineAttrs['stroke-dasharray'] = item.dash;
      g.appendChild(el('line', lineAttrs));
      g.appendChild(el('circle', { cx: x + 15, cy: 0, r: 4, fill: item.color }));
      const ig = el('g', { class: 'legend-item' });
      ig.appendChild(el('text', { x: x + 38, y: 4 }, item.label));
      g.appendChild(ig);
    });
    return g;
  }

  /* ----- Main render function ----- */
  function render(container, scenario, options) {
    options = options || {};
    container.innerHTML = '';

    const diagram = scenario.diagram;
    const nodes = nodeMap(diagram);

    // Calculate viewBox
    const vbW = 960;
    const vbH = 420;

    const svg = el('svg', {
      viewBox: `0 0 ${vbW} ${vbH}`,
      xmlns: NS,
      'aria-label': `Network diagram: ${scenario.title}`,
      role: 'img',
    });

    // Render zones
    diagram.zones.forEach(z => svg.appendChild(renderZone(z)));

    // Render connections (behind nodes)
    diagram.connections.forEach((c, i) => {
      const cEl = renderConnection(c, nodes, i);
      if (cEl) svg.appendChild(cEl);
    });

    // Render nodes (on top)
    diagram.nodes.forEach(n => svg.appendChild(renderNode(n)));

    // Legend
    svg.appendChild(renderLegend(vbH - 20));

    container.appendChild(svg);
    return svg;
  }

  /* ----- Step-through mode: show only one step ----- */
  function showStep(container, stepNum, totalSteps) {
    const conns = container.querySelectorAll('.conn-group');
    conns.forEach(g => {
      const s = parseInt(g.getAttribute('data-step'), 10);
      if (s === stepNum) {
        g.classList.remove('step-dimmed');
        g.classList.add('step-visible');
      } else {
        g.classList.remove('step-visible');
        g.classList.add('step-dimmed');
      }
    });

    // Highlight active nodes for this step
    const nodes = container.querySelectorAll('.node-group');
    nodes.forEach(n => {
      n.classList.remove('step-active', 'step-dimmed');
    });
  }

  /* ----- Reset all steps to visible (auto mode) ----- */
  function showAllSteps(container) {
    container.querySelectorAll('.conn-group').forEach(g => {
      g.classList.remove('step-dimmed', 'step-visible');
    });
    container.querySelectorAll('.node-group').forEach(n => {
      n.classList.remove('step-active', 'step-dimmed');
    });
    container.classList.remove('anim-paused');
  }

  /* ----- Pause animations (for step mode) ----- */
  function pauseAnimations(container) {
    container.classList.add('anim-paused');
  }

  function resumeAnimations(container) {
    container.classList.remove('anim-paused');
  }

  /* ----- Get total step count for a scenario ----- */
  function getStepCount(scenario) {
    return scenario.steps.length;
  }

  return { render, showStep, showAllSteps, pauseAnimations, resumeAnimations, getStepCount };
})();
