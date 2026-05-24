/* ============================================================
   main.js — Init, Event Handlers, Compare Mode, PDF Export
   ============================================================ */

(function () {
  'use strict';

  /* ----- State ----- */
  let currentScenario = 'public';
  let animMode = 'auto';   // 'auto' | 'step'
  let currentStep = 1;
  let compareActive = false;

  /* ----- DOM refs ----- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const diagramContainer = $('#diagramContainer');
  const summaryTitle     = $('#summaryTitle');
  const summaryOverview  = $('#summaryOverview');
  const summarySteps     = $('#summarySteps');
  const stepControls     = $('#stepControls');
  const stepIndicator    = $('#stepIndicator');
  const stepPrev         = $('#stepPrev');
  const stepNext         = $('#stepNext');
  const singleView       = $('#singleView');
  const compareView      = $('#compareView');
  const compareBar        = $('#compareBar');
  const compareToggle    = $('#compareToggle');

  /* ----- Load a scenario into the single view ----- */
  function loadScenario(id) {
    const s = SCENARIOS[id];
    if (!s) return;
    currentScenario = id;

    // Update selector buttons
    $$('.scenario-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scenario === id);
    });

    // Diagram
    DiagramRenderer.render(diagramContainer, s);
    if (animMode === 'step') {
      currentStep = 1;
      applyStepMode();
    }

    // Summary
    summaryTitle.textContent = s.title;
    summaryOverview.innerHTML = s.overview;

    // Steps
    summarySteps.innerHTML = '';
    s.steps.forEach(step => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>Step ${step.id}: ${step.label}</strong> — ${step.detail}`;
      summarySteps.appendChild(li);
    });

  }

  /* ----- Step-through mode helpers ----- */
  function applyStepMode() {
    const s = SCENARIOS[currentScenario];
    const total = DiagramRenderer.getStepCount(s);
    DiagramRenderer.pauseAnimations(diagramContainer);
    DiagramRenderer.showStep(diagramContainer, currentStep, total);
    stepIndicator.textContent = `Step ${currentStep} / ${total}`;
    stepPrev.disabled = currentStep <= 1;
    stepNext.disabled = currentStep >= total;
  }

  function setAnimMode(mode) {
    animMode = mode;
    $$('.anim-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    if (mode === 'auto') {
      stepControls.classList.add('hidden');
      DiagramRenderer.showAllSteps(diagramContainer);
      DiagramRenderer.resumeAnimations(diagramContainer);
    } else {
      stepControls.classList.remove('hidden');
      currentStep = 1;
      applyStepMode();
    }
  }

  /* ----- Compare mode ----- */
  function enterCompare() {
    compareActive = true;
    compareToggle.classList.add('active');
    singleView.classList.add('hidden');
    compareView.classList.remove('hidden');
    compareBar.classList.remove('hidden');
    $$('.scenario-btn').forEach(b => b.disabled = true);
    updateCompare();
  }

  function exitCompare() {
    compareActive = false;
    compareToggle.classList.remove('active');
    singleView.classList.remove('hidden');
    compareView.classList.add('hidden');
    compareBar.classList.add('hidden');
    $$('.scenario-btn').forEach(b => b.disabled = false);
    loadScenario(currentScenario);
  }

  function updateCompare() {
    const leftId = $('#compareLeft').value;
    const rightId = $('#compareRight').value;
    const leftS = SCENARIOS[leftId];
    const rightS = SCENARIOS[rightId];

    $('#compareLabelLeft').textContent = leftS.title;
    $('#compareLabelRight').textContent = rightS.title;
    $('#compareOverviewLeft').innerHTML = leftS.overview;
    $('#compareOverviewRight').innerHTML = rightS.overview;

    DiagramRenderer.render($('#compareDiagramLeft'), leftS);
    DiagramRenderer.render($('#compareDiagramRight'), rightS);
  }

  /* ----- PDF Export ----- */
  function exportPdf() {
    // Force-open all <details> elements for print
    const detailsEls = $$('details');
    detailsEls.forEach(d => d.setAttribute('open', ''));
    window.print();
  }

  /* ----- Event Listeners ----- */
  // Scenario selector
  $$('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (compareActive) return;
      loadScenario(btn.dataset.scenario);
    });
  });

  // Animation mode toggle
  $$('.anim-btn').forEach(btn => {
    btn.addEventListener('click', () => setAnimMode(btn.dataset.mode));
  });

  // Step controls
  stepPrev.addEventListener('click', () => {
    if (currentStep > 1) { currentStep--; applyStepMode(); }
  });
  stepNext.addEventListener('click', () => {
    const total = DiagramRenderer.getStepCount(SCENARIOS[currentScenario]);
    if (currentStep < total) { currentStep++; applyStepMode(); }
  });

  // Keyboard step navigation
  document.addEventListener('keydown', (e) => {
    if (animMode !== 'step') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      stepNext.click();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      stepPrev.click();
      e.preventDefault();
    }
  });

  // Compare toggle
  compareToggle.addEventListener('click', () => {
    if (compareActive) exitCompare();
    else enterCompare();
  });

  // Compare dropdowns
  $('#compareLeft').addEventListener('change', () => { if (compareActive) updateCompare(); });
  $('#compareRight').addEventListener('change', () => { if (compareActive) updateCompare(); });

  // PDF export
  $('#exportPdf').addEventListener('click', exportPdf);

  /* ----- Init ----- */
  loadScenario('public');

})();
