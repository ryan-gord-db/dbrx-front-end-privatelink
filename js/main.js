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
  const useCaseCard      = $('#useCaseCard');
  const useCaseText      = $('#useCaseText');
  const caveatsCard      = $('#caveatsCard');
  const caveatsList      = $('#caveatsList');
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

    // Use Case
    if (s.useCase) {
      useCaseCard.classList.remove('hidden');
      useCaseText.innerHTML = s.useCase;
    } else {
      useCaseCard.classList.add('hidden');
    }

    // Caveats
    if (s.caveats) {
      caveatsCard.classList.remove('hidden');
      caveatsList.innerHTML = '';
      s.caveats.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = c;
        caveatsList.appendChild(li);
      });
    } else {
      caveatsCard.classList.add('hidden');
    }

  }

  /* ----- Step-through mode helpers ----- */
  function applyStepMode() {
    const s = SCENARIOS[currentScenario];
    const total = DiagramRenderer.getStepCount(s);
    DiagramRenderer.pauseAnimations(diagramContainer);
    DiagramRenderer.showStep(diagramContainer, currentStep, total, s);
    stepIndicator.textContent = `Step ${currentStep} / ${total}`;
    stepPrev.disabled = currentStep <= 1;
    stepNext.disabled = currentStep >= total;

    // Focus the text summary on the active step
    highlightStepText(currentStep, s);
  }

  function highlightStepText(stepNum, scenario) {
    const stepData = scenario.steps.find(st => st.id === stepNum);
    if (!stepData) return;

    // Show current step detail prominently in the overview area
    summaryOverview.innerHTML =
      `<span class="step-focus-badge">Step ${stepData.id}</span> ` +
      `<strong>${stepData.label}</strong> — ${stepData.detail}`;

    // Highlight the corresponding list item
    const items = summarySteps.querySelectorAll('li');
    items.forEach((li, idx) => {
      const itemStep = idx + 1;
      li.classList.toggle('step-text-active', itemStep === stepNum);
      li.classList.toggle('step-text-dimmed', itemStep !== stepNum);
    });
  }

  function resetStepText(scenario) {
    summaryOverview.innerHTML = scenario.overview;
    const items = summarySteps.querySelectorAll('li');
    items.forEach(li => {
      li.classList.remove('step-text-active', 'step-text-dimmed');
    });
  }

  function setAnimMode(mode) {
    animMode = mode;
    $$('.anim-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    const detailsEl = document.querySelector('.detail-expander');
    if (mode === 'auto') {
      stepControls.classList.add('hidden');
      DiagramRenderer.showAllSteps(diagramContainer);
      DiagramRenderer.resumeAnimations(diagramContainer);
      resetStepText(SCENARIOS[currentScenario]);
    } else {
      stepControls.classList.remove('hidden');
      if (detailsEl) detailsEl.setAttribute('open', '');
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
