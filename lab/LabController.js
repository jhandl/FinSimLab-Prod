/**
 * LabController.js
 * 
 * Orchestrates the UI behavior and responsive "glue" for the FinSim Interface (IFS).
 * This file handles application identity, mobile menu logic, layout calculations,
 * and UI toggle states.
 */

// Global error handler
window.addEventListener('error', function (event) {
  console.error('Global error handler:', event.error ? event.error.stack : event.message);
});

// Application Identity Initialization
(function () {
  async function applyAppName() {
    try {
      // Wait until Config is initialized in WebUI flow; Config.getInstance() will throw if not ready
      let appName = null;
      try {
        if (window.Config && typeof Config.getInstance === 'function') {
          appName = Config.getInstance().getApplicationName();
        }
      } catch (_) {
        // If Config isn't initialized yet, listen for DOMContentLoaded completion in WebUI which initializes Config
        // Fallback: poll until Config is ready (short-lived polling)
        const start = Date.now();
        while (Date.now() - start < 3000) {
          try { if (window.Config && typeof Config.getInstance === 'function') { appName = Config.getInstance().getApplicationName(); break; } } catch (_) { }
          await new Promise(r => setTimeout(r, 100));
        }
      }

      if (!appName) return; // Wait for Config to load

      // Set document title
      try { document.title = appName; } catch (_) { }

      // Update header name anchor text
      try {
        const appNameEl = document.querySelector('.app-name a');
        if (appNameEl) appNameEl.textContent = appName;
      } catch (_) { }

      // Update app icon alt
      try {
        const icon = document.querySelector('.app-icon');
        if (icon) icon.setAttribute('alt', appName);
      } catch (_) { }
    } catch (err) { /* swallow errors */ }
  }

  // Defer applying name until after WebUI initializes Config; DOMContentLoaded may have already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // Slight delay to allow WebUI to call Config.initialize
    setTimeout(applyAppName, 50);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(applyAppName, 50); });
  }
})();

// Deferred Mobile Data Table Loader
document.addEventListener('DOMContentLoaded', function () {
  const showLink = document.getElementById('show-data-link');
  const dataTable = document.getElementById('Data');
  const dataSection = dataTable ? dataTable.closest('.data-section') : null;
  const mobileMessage = document.getElementById('mobile-data-message');

  if (showLink && dataSection && mobileMessage) {
    showLink.addEventListener('click', async function (e) {
      e.preventDefault();
      mobileMessage.classList.add('table-rendering');
      showLink.setAttribute('aria-disabled', 'true');
      showLink.style.pointerEvents = 'none';

      await new Promise(function (resolve) { requestAnimationFrame(function () { resolve(); }); });
      await new Promise(function (resolve) { requestAnimationFrame(function () { resolve(); }); });

      const webUI = (typeof WebUI !== 'undefined' && WebUI.getInstance) ? WebUI.getInstance() : null;
      if (webUI && typeof webUI.renderDeferredDataTableIfNeeded === 'function') {
        await webUI.renderDeferredDataTableIfNeeded();
      }
      dataSection.style.display = 'block';
      mobileMessage.style.display = 'none';
      if (webUI && webUI.tableManager && typeof webUI.tableManager.finalizeDataTableLayout === 'function') {
        webUI.tableManager.finalizeDataTableLayout();
      }
      if (typeof updateDataSectionViewportLock === 'function') {
        updateDataSectionViewportLock();
      }
      dataSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Recalculate sticky column widths after table is shown
      setTimeout(updateStickyColumnWidths, 100);
    });
  }
});

// Mobile Burger Menu Controller
class MobileBurgerMenu {
  constructor() {
    this.menuToggle = document.getElementById('mobileMenuToggle');
    this.mobileMenu = document.getElementById('mobileMenu');
    this.menuContent = document.querySelector('.mobile-menu-content');
    this.isOpen = false;

    this.init();
  }

  init() {
    // Bind event listeners
    this.menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;

      // Ignore clicks inside the burger menu itself or on its toggle
      if (this.mobileMenu.contains(e.target) || this.menuToggle.contains(e.target)) {
        return;
      }

      // If the on-screen wizard is active, ignore clicks inside its popover
      const wizardActive = document.body.getAttribute('data-wizard-active') === 'true';
      if (wizardActive && e.target.closest('.driver-popover')) {
        return;
      }

      // Otherwise treat it as an outside click
      this.closeMenu();
    });

    // Handle ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeMenu();
      }
    });

    // Update menu content on resize
    window.addEventListener('resize', () => {
      this.updateMenuContent();
    });

    // Sync mobile menu buttons with desktop actions
    this.syncMenuButtons();

    // Update mobile status indicator
    this.syncStatusIndicator();

    // Initialize toggle state from localStorage
    this.initializeToggleState();
  }

  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    this.isOpen = true;
    this.menuToggle.classList.add('active');
    this.mobileMenu.classList.add('active');
    this.updateMenuContent();
  }

  closeMenu() {
    this.isOpen = false;
    this.menuToggle.classList.remove('active');
    this.mobileMenu.classList.remove('active');
  }

  updateMenuContent() {
    const currentWidth = window.innerWidth;
    const breakpoints = getBreakpoints();
    const runButton = document.getElementById('runSimulationMobile');
    const statusDiv = document.getElementById('progressMobile');
    const saveButton = document.getElementById('saveSimulationMobile');
    const loadButton = document.getElementById('loadSimulationMobile');
    const demoButton = document.getElementById('loadDemoScenarioMobile');
    const helpButton = document.getElementById('startWizardMobile');
    const latestUpdatesButton = document.getElementById('latestUpdatesMobile');
    const toggleButton = document.getElementById('experimentalToggleMobile');
    const eventsWizardToggleButton = document.getElementById('eventsWizardToggleMobile');
    const presentValueToggleButton = document.getElementById('presentValueToggleMobile');
    const countryTabsSyncToggleButton = document.getElementById('countryTabsSyncToggleMobile');
    const firstDivider = document.querySelector('.mobile-menu-divider');
    const secondDivider = document.querySelectorAll('.mobile-menu-divider')[1];
    const thirdDivider = document.querySelectorAll('.mobile-menu-divider')[2];

    // Hardcoded toggle to show/hide the experimental toggle button
    const SHOW_TOGGLE_BUTTON = false;
    // Always show the Events Wizard toggle
    const SHOW_EVENTS_WIZARD_TOGGLE = true;
    // Always show the Present Value toggle
    const SHOW_PRESENT_VALUE_TOGGLE = true;
    // Show only when relocation is active and there is an effective relocation (MV to a different country).
    let SHOW_COUNTRY_TABS_SYNC_TOGGLE = false;
    try {
      if (typeof Config !== 'undefined') {
        const cfg = Config.getInstance();
        const relocationEnabled = cfg && cfg.isRelocationEnabled && cfg.isRelocationEnabled();
        if (relocationEnabled && typeof WebUI !== 'undefined') {
          const webUI = WebUI.getInstance();
          SHOW_COUNTRY_TABS_SYNC_TOGGLE = !!(webUI && typeof webUI.hasEffectiveRelocationEvents === 'function' && webUI.hasEffectiveRelocationEvents());
        }
      }
    } catch (_) { /* no-op */ }

    // Track which sections have visible content
    let hasRunSection = false;
    let hasSaveLoadSection = false;
    let hasDemoHelpSection = false;
    let hasToggleSection = SHOW_TOGGLE_BUTTON || SHOW_EVENTS_WIZARD_TOGGLE || SHOW_PRESENT_VALUE_TOGGLE || SHOW_COUNTRY_TABS_SYNC_TOGGLE;

    if (currentWidth > breakpoints.tablet) {
      // Desktop mode: Only show Demo/Help/Coffee buttons that are visible in header but burger menu is always available
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';
      if (loadButton) loadButton.style.display = 'none';
      if (demoButton) demoButton.style.display = 'none';
      if (helpButton) helpButton.style.display = 'none';

      hasRunSection = false;
      hasSaveLoadSection = false;
      hasDemoHelpSection = false;
    } else if (currentWidth > breakpoints.mobile) {
      // Tablet mode: Show Demo/Help buttons (moved to burger menu)
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';
      if (loadButton) loadButton.style.display = 'none';
      if (demoButton) demoButton.style.display = 'flex';
      if (helpButton) helpButton.style.display = 'flex';

      hasRunSection = false;
      hasSaveLoadSection = false;
      hasDemoHelpSection = true;
    } else {
      // Mobile mode: Show Save/Load + Demo/Help (all hidden from header)
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'flex';
      if (loadButton) loadButton.style.display = 'flex';
      if (demoButton) demoButton.style.display = 'flex';
      if (helpButton) helpButton.style.display = 'flex';

      hasRunSection = false;
      hasSaveLoadSection = true;
      hasDemoHelpSection = true;
    }

    if (latestUpdatesButton) latestUpdatesButton.style.display = 'flex';

    // Show dividers only when they separate visible content
    // First divider: between Run/Status and Save/Load
    if (firstDivider) {
      firstDivider.style.display = (hasRunSection && hasSaveLoadSection) ? 'block' : 'none';
    }

    // Second divider: between Save/Load and Demo/Help/Toggle
    if (secondDivider) {
      secondDivider.style.display = (hasSaveLoadSection && hasDemoHelpSection) ? 'block' : 'none';
    }

    // Show/hide toggle buttons based on the hardcoded booleans
    if (toggleButton) {
      toggleButton.style.display = SHOW_TOGGLE_BUTTON ? 'flex' : 'none';
    }

    if (eventsWizardToggleButton) {
      eventsWizardToggleButton.style.display = SHOW_EVENTS_WIZARD_TOGGLE ? 'flex' : 'none';
    }
    if (presentValueToggleButton) {
      presentValueToggleButton.style.display = SHOW_PRESENT_VALUE_TOGGLE ? 'flex' : 'none';
    }
    if (countryTabsSyncToggleButton) {
      countryTabsSyncToggleButton.style.display = SHOW_COUNTRY_TABS_SYNC_TOGGLE ? 'flex' : 'none';
    }

    // Third divider: between Demo/Help/Toggle and Coffee (Coffee is always visible)
    if (thirdDivider) {
      thirdDivider.style.display = (hasDemoHelpSection || hasToggleSection) ? 'block' : 'none';
    }
  }

  syncMenuButtons() {
    // Run Simulation
    const runSimMobile = document.getElementById('runSimulationMobile');
    const runSimDesktop = document.getElementById('runSimulation');
    if (runSimMobile && runSimDesktop) {
      runSimMobile.addEventListener('click', () => {
        this.closeMenu();
        runSimDesktop.click();
      });
    }

    // Save Simulation
    const saveMobile = document.getElementById('saveSimulationMobile');
    const saveDesktop = document.getElementById('saveSimulation');
    if (saveMobile && saveDesktop) {
      saveMobile.addEventListener('click', () => {
        this.closeMenu();
        saveDesktop.click();
      });
    }

    // Load Simulation
    const loadMobile = document.getElementById('loadSimulationMobile');
    const loadDesktop = document.getElementById('loadSimulation');
    if (loadMobile && loadDesktop) {
      loadMobile.addEventListener('click', () => {
        this.closeMenu();
        loadDesktop.click();
      });
    }

    // Demo
    const demoMobile = document.getElementById('loadDemoScenarioMobile');
    const demoDesktop = document.getElementById('loadDemoScenarioHeader');
    if (demoMobile && demoDesktop) {
      demoMobile.addEventListener('click', () => {
        this.closeMenu();
        demoDesktop.click();
      });
    }

    // Help/Wizard
    const helpMobile = document.getElementById('startWizardMobile');
    const helpDesktop = document.getElementById('startWizard');
    if (helpMobile && helpDesktop) {
      helpMobile.addEventListener('click', () => {
        this.closeMenu();
        helpDesktop.click();
      });
    }

    // Change log
    const latestUpdatesMobile = document.getElementById('latestUpdatesMobile');
    if (latestUpdatesMobile) {
      latestUpdatesMobile.addEventListener('click', () => {
        this.closeMenu();
        WebUI.getInstance().showLatestUpdates(true);
      });
    }

    // Experimental Toggle
    const toggleMobile = document.getElementById('experimentalToggleMobile');
    if (toggleMobile) {
      toggleMobile.addEventListener('click', () => {
        this.handleToggle(toggleMobile);
      });
    }

    // Events Wizard Toggle
    const eventsWizardToggleMobile = document.getElementById('eventsWizardToggleMobile');
    if (eventsWizardToggleMobile) {
      eventsWizardToggleMobile.addEventListener('click', () => {
        this.handleEventsWizardToggle(eventsWizardToggleMobile);
      });
    }

    // Present Value Toggle
    const presentValueToggleMobile = document.getElementById('presentValueToggleMobile');
    if (presentValueToggleMobile) {
      presentValueToggleMobile.addEventListener('click', () => {
        this.handlePresentValueToggle(presentValueToggleMobile);
      });
    }

    // Country Tabs Sync Toggle
    const countryTabsSyncToggleMobile = document.getElementById('countryTabsSyncToggleMobile');
    if (countryTabsSyncToggleMobile) {
      countryTabsSyncToggleMobile.addEventListener('click', () => {
        this.handleCountryTabsSyncToggle(countryTabsSyncToggleMobile);
      });
    }
  }

  syncStatusIndicator() {
    const progressDesktop = document.getElementById('progress');
    const progressMobile = document.getElementById('progressMobile');

    if (progressDesktop && progressMobile) {
      // Initial sync
      progressMobile.textContent = progressDesktop.textContent;
      progressMobile.className = progressDesktop.className.replace('status-indicator', 'mobile-menu-status');

      // Watch for changes using MutationObserver
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            progressMobile.textContent = progressDesktop.textContent;
          }
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            progressMobile.className = progressDesktop.className.replace('status-indicator', 'mobile-menu-status');
          }
        });
      });

      observer.observe(progressDesktop, {
        childList: true,
        characterData: true,
        attributes: true,
        subtree: true
      });
    }
  }

  handleToggle(toggleButton) {
    const currentState = toggleButton.getAttribute('data-toggle-state');
    const newState = currentState === 'off' ? 'on' : 'off';
    const icon = toggleButton.querySelector('i');
    const textSpan = toggleButton.querySelector('span');

    // Update the button state
    toggleButton.setAttribute('data-toggle-state', newState);

    // Update the icon
    if (newState === 'on') {
      icon.classList.remove('fa-toggle-off');
      icon.classList.add('fa-toggle-on');
      textSpan.innerHTML = 'Tooltips: <strong>on</strong>';
    } else {
      icon.classList.remove('fa-toggle-on');
      icon.classList.add('fa-toggle-off');
      textSpan.innerHTML = 'Tooltips: <strong>off</strong>';
    }

    // Store the state in localStorage for persistence
    localStorage.setItem('experimentalFeatureState', newState);

    // Trigger custom event that other parts of the app can listen to
    window.dispatchEvent(new CustomEvent('experimentalFeatureToggle', {
      detail: { state: newState, enabled: newState === 'on' }
    }));
  }

  handleEventsWizardToggle(toggleButton) {
    const currentState = toggleButton.getAttribute('data-toggle-state');
    const newState = currentState === 'off' ? 'on' : 'off';
    const toggleSwitch = toggleButton.querySelector('.toggle-switch');

    // Update the button state
    toggleButton.setAttribute('data-toggle-state', newState);

    // Update the toggle switch visual state
    if (newState === 'on') {
      toggleSwitch.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
    }

    // Store the state in localStorage for persistence
    localStorage.setItem('eventsWizardState', newState);

    // Trigger custom event that other parts of the app can listen to
    window.dispatchEvent(new CustomEvent('eventsWizardToggle', {
      detail: { state: newState, enabled: newState === 'on' }
    }));
  }

  handlePresentValueToggle(toggleButton) {
    const currentState = toggleButton.getAttribute('data-toggle-state');
    const newState = currentState === 'off' ? 'on' : 'off';
    const toggleSwitch = toggleButton.querySelector('.toggle-switch');

    // Update the button state
    toggleButton.setAttribute('data-toggle-state', newState);

    // Update the toggle switch visual state
    if (newState === 'on') {
      toggleSwitch.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
    }

    // Store the state in localStorage for persistence
    localStorage.setItem('presentValueMode', newState);

    // Trigger custom event that other parts of the app can listen to
    window.dispatchEvent(new CustomEvent('presentValueToggle', {
      detail: { state: newState, enabled: newState === 'on' }
    }));

    // Defer heavy rerenders so the toggle visual state paints immediately.
    setTimeout(() => {
      try {
        if (typeof WebUI !== 'undefined') {
          const webUI = WebUI.getInstance();
          const enabled = toggleButton.getAttribute('data-toggle-state') === 'on';
          if (webUI && webUI.tableManager && typeof webUI.tableManager.setPresentValueMode === 'function') {
            webUI.tableManager.setPresentValueMode(enabled);
          }
          if (webUI && webUI.chartManager && typeof webUI.chartManager.setPresentValueMode === 'function') {
            webUI.chartManager.setPresentValueMode(enabled);
          }
        }
      } catch (_) { /* no-op */ }
    }, 0);
  }

  handleCountryTabsSyncToggle(toggleButton) {
    const currentState = toggleButton.getAttribute('data-toggle-state');
    const newState = currentState === 'off' ? 'on' : 'off';
    const toggleSwitch = toggleButton.querySelector('.toggle-switch');

    toggleButton.setAttribute('data-toggle-state', newState);
    if (toggleSwitch) {
      if (newState === 'on') toggleSwitch.classList.add('active');
      else toggleSwitch.classList.remove('active');
    }

    const enabled = newState === 'on';
    localStorage.setItem('countryTabsSynced', enabled ? 'true' : 'false');
    CountryTabSyncManager.getInstance().setSyncState(enabled);
  }

  initializeToggleState() {
    // Initialize experimental toggle
    const toggleButton = document.getElementById('experimentalToggleMobile');
    if (toggleButton) {
      // Get saved state from localStorage
      const savedState = localStorage.getItem('experimentalFeatureState') || 'off';
      const icon = toggleButton.querySelector('i');
      const textSpan = toggleButton.querySelector('span');

      // Set the initial state
      toggleButton.setAttribute('data-toggle-state', savedState);

      // Update the icon and text based on saved state
      if (savedState === 'on') {
        icon.classList.remove('fa-toggle-off');
        icon.classList.add('fa-toggle-on');
        textSpan.innerHTML = 'Tooltips: <strong>on</strong>';
      } else {
        icon.classList.remove('fa-toggle-on');
        icon.classList.add('fa-toggle-off');
        textSpan.innerHTML = 'Tooltips: <strong>off</strong>';
      }

      // Dispatch initial event for any listeners
      window.dispatchEvent(new CustomEvent('experimentalFeatureToggle', {
        detail: { state: savedState, enabled: savedState === 'on' }
      }));
    }

    // Initialize Events Wizard toggle
    const eventsWizardToggleButton = document.getElementById('eventsWizardToggleMobile');
    if (eventsWizardToggleButton) {
      // Get saved state from localStorage (default to 'on')
      const savedState = localStorage.getItem('eventsWizardState') || 'on';
      const toggleSwitch = eventsWizardToggleButton.querySelector('.toggle-switch');

      // Set the initial state
      eventsWizardToggleButton.setAttribute('data-toggle-state', savedState);

      // Update the toggle switch visual state based on saved state
      if (savedState === 'on') {
        toggleSwitch.classList.add('active');
      } else {
        toggleSwitch.classList.remove('active');
      }

      // Dispatch initial event for any listeners
      window.dispatchEvent(new CustomEvent('eventsWizardToggle', {
        detail: { state: savedState, enabled: savedState === 'on' }
      }));
    }

    // Initialize Present Value toggle
    const presentValueToggleButton = document.getElementById('presentValueToggleMobile');
    if (presentValueToggleButton) {
      // Get saved state from localStorage (default to 'off')
      const savedState = localStorage.getItem('presentValueMode') || 'off';
      const toggleSwitch = presentValueToggleButton.querySelector('.toggle-switch');

      // Set the initial state
      presentValueToggleButton.setAttribute('data-toggle-state', savedState);

      // Update the toggle switch visual state based on saved state
      if (savedState === 'on') {
        toggleSwitch.classList.add('active');
      } else {
        toggleSwitch.classList.remove('active');
      }

      // Dispatch initial event for any listeners
      window.dispatchEvent(new CustomEvent('presentValueToggle', {
        detail: { state: savedState, enabled: savedState === 'on' }
      }));

      // Apply initial state to managers
      try {
        if (typeof WebUI !== 'undefined') {
          const webUI = WebUI.getInstance();
          const enabled = (savedState === 'on');
          if (webUI && webUI.tableManager && typeof webUI.tableManager.setPresentValueMode === 'function') {
            webUI.tableManager.setPresentValueMode(enabled);
          }
          if (webUI && webUI.chartManager && typeof webUI.chartManager.setPresentValueMode === 'function') {
            webUI.chartManager.setPresentValueMode(enabled);
          }
        }
      } catch (_) { /* no-op */ }
    }

    // Initialize Country Tabs Sync toggle (default to 'on')
    const countryTabsSyncToggleButton = document.getElementById('countryTabsSyncToggleMobile');
    if (countryTabsSyncToggleButton) {
      const savedRaw = localStorage.getItem('countryTabsSynced');
      const enabled = (savedRaw === null) ? true : (savedRaw === 'true');
      const savedState = enabled ? 'on' : 'off';
      const toggleSwitch = countryTabsSyncToggleButton.querySelector('.toggle-switch');

      countryTabsSyncToggleButton.setAttribute('data-toggle-state', savedState);
      if (toggleSwitch) {
        if (enabled) toggleSwitch.classList.add('active');
        else toggleSwitch.classList.remove('active');
      }
      CountryTabSyncManager.getInstance().setSyncState(enabled);
    }
  }
}

// Get breakpoint values from CSS custom properties
function getBreakpoints() {
  const style = getComputedStyle(document.documentElement);
  return {
    tablet: parseInt(style.getPropertyValue('--breakpoint-tablet')),
    mobile: parseInt(style.getPropertyValue('--breakpoint-mobile'))
  };
}

// Get layout breakpoint values from CSS custom properties
function getLayoutBreakpoints() {
  const style = getComputedStyle(document.documentElement);
  return {
    wide: parseInt(style.getPropertyValue('--layout-breakpoint-wide')),
    medium: parseInt(style.getPropertyValue('--layout-breakpoint-medium')),
    narrow: parseInt(style.getPropertyValue('--layout-breakpoint-narrow')),
    mobile: parseInt(style.getPropertyValue('--layout-breakpoint-mobile'))
  };
}

// Generate header responsive CSS from centralized breakpoints
function generateHeaderResponsiveCSS() {
  const bp = getBreakpoints();

  const css = `
    /* Global max-width constraint for header to align with main content */
    header {
      max-width: 2350px;
      margin: 0 auto;
    }
    

    
    /* Desktop Mode: Show all buttons with grouping */
    @media (min-width: ${bp.tablet + 1}px) {
      header { display: flex !important; flex-wrap: nowrap !important; gap: 0.5rem !important; padding: 0.75rem 1.2rem !important; height: 60px !important; justify-content: space-between !important; align-items: center !important; }
      .header-left { flex: 0 0 auto !important; min-width: 40px !important; justify-content: flex-start !important; display: flex !important; align-items: center !important; gap: 0.75rem !important; }
      .header-left .app-name { display: none !important; } @media (min-width: 994px) { .header-left .app-name { display: block !important; margin: 0 !important; font-size: 1.25rem !important; font-weight: 700 !important; } }
      .header-left .app-name a { color: var(--color-button-dark) !important; text-decoration: none !important; white-space: nowrap !important; }
      .header-left .app-icon-link { display: flex !important; }
      .header-left .app-icon { display: block !important; width: 32px; height: 32px; }
      .header-center-right { flex: 1 1 auto !important; min-width: 0 !important; gap: 0.5rem !important; justify-content: center !important; display: flex !important; }
      .header-center { margin: 0 auto !important; gap: 1rem !important; justify-content: center !important; display: flex !important; }
      .button-group-primary { display: flex !important; gap: 0.5rem !important; justify-content: center !important; }
      .button-group-secondary { display: flex !important; gap: 0.5rem !important; justify-content: center !important; }
      .header-right { display: none !important; }
      .mobile-menu-toggle { flex: 0 0 auto !important; min-width: 40px !important; }
      .mobile-menu { display: block; }
    }
    
    /* Tablet Mode: Move secondary buttons to burger menu */
    @media (max-width: ${bp.tablet}px) and (min-width: ${bp.mobile + 1}px) {
      header { display: flex !important; flex-wrap: nowrap !important; gap: 0.5rem !important; padding: 0.75rem 1.2rem !important; height: 60px !important; justify-content: space-between !important; align-items: center !important; }
      .header-left { flex: 0 0 auto !important; min-width: 40px !important; justify-content: flex-start !important; }
      .header-left .app-name { display: none !important; }
      .header-left .app-icon-link { display: flex !important; }
      .header-left .app-icon { display: block !important; width: 32px; height: 32px; }
      .header-center-right { flex: 1 1 auto !important; min-width: 0 !important; gap: 0.5rem !important; justify-content: center !important; display: flex !important; }
      .header-center { margin: 0 auto !important; gap: 0 !important; justify-content: center !important; display: flex !important; }
      .button-group-primary { display: flex !important; gap: 0.5rem !important; justify-content: center !important; }
      .button-group-secondary { display: none !important; }
      .header-right { display: none !important; }
      .mobile-menu-toggle { flex: 0 0 auto !important; min-width: 40px !important; }
      .mobile-menu { display: block; }
      #runSimulation::before { content: "Run"; }
      #runSimulation span { display: none; }
    }

             /* Mobile Mode: Show Icon + Run + Status + burger menu */
     @media (max-width: ${bp.mobile}px) {
       body { padding-top: 60px !important; }
       header { display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important; justify-content: space-between !important; align-items: center !important; padding: 0.75rem 1.2rem !important; position: fixed !important; top: 0; left: 0; right: 0; z-index: 1000; width: 100%; height: 60px !important; gap: 0.5rem !important; }
       .header-left { flex: 0 0 auto !important; min-width: 40px !important; justify-content: flex-start !important; margin: 0 !important; padding: 0 !important; }
       .header-left .app-name { display: none !important; }
       .header-left .app-icon-link { display: flex !important; }
       .header-left .app-icon { display: block !important; width: 32px; height: 32px; }
       .header-center-right { display: flex !important; flex: 1 1 auto !important; min-width: 0 !important; gap: 0.5rem !important; justify-content: center !important; }
       .header-center { margin: 0 auto !important; gap: 0 !important; justify-content: center !important; display: flex !important; }
       .button-group-primary { display: flex !important; gap: 0.5rem !important; justify-content: center !important; }
       .button-group-secondary { display: none !important; }
       .header-right { display: none !important; }
       .mobile-menu-toggle { flex: 0 0 auto !important; min-width: 40px !important; }
       .mobile-menu { display: block; }
       #saveSimulation, #loadSimulation { display: none !important; }
       #runSimulation { display: inline-block !important; }
       #runSimulation::before { content: "Run"; }
       #runSimulation span { display: none; }
       #progress { display: inline-block !important; }
       main { margin-top: 1.8rem; display: flex; flex-direction: column; gap: 1.8rem; }
       .events-section { width: 100%; max-width: 810px; justify-self: left; overflow-x: auto; }
       .events-section table { width: 100%; }
       .graph-container { width: 100%; max-width: calc(100% - 1.5rem); min-height: calc((100vw - 1.5rem) * 0.6); max-height: calc((100vw - 1.5rem) * 0.9); }
       .data-section { display: none; }
       #mobile-data-message { display: block; max-width: none; }
     }
    `;

  // Inject CSS into the page
  let styleElement = document.getElementById('dynamic-header-responsive-css');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'dynamic-header-responsive-css';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

// Generate layout responsive CSS from centralized breakpoints
function generateLayoutResponsiveCSS() {
  const lbp = getLayoutBreakpoints();
  const bp = getBreakpoints();
  
  // Get width constants from CSS variables
  const rootStyle = getComputedStyle(document.documentElement);
  const parameterCardWidth = rootStyle.getPropertyValue('--parameter-card-width').trim() || '810px';
  const eventsSectionWidth = rootStyle.getPropertyValue('--events-section-width').trim() || '810px';

  const css = `
    /* Global max-width constraint for all screen sizes */
    main {
      max-width: 2350px;
    }
    
    /* Wide Screen to 2-column layout */
    @media (max-width: ${lbp.wide}px) {
      header {
        max-width: calc(2 * ${parameterCardWidth} + 1.35rem + ${eventsSectionWidth} + 2 * 1.8rem);
      }
      main {
        width: 100%;
        max-width: calc(2 * ${parameterCardWidth} + 1.35rem + ${eventsSectionWidth} + 2 * 1.8rem);
        margin: 1.8rem auto var(--data-section-viewport-gap) auto;
        grid-template-columns: calc(2 * ${parameterCardWidth} + 1.35rem) minmax(0, ${eventsSectionWidth});
        grid-template-areas: 
            "parameters events"
            "graphs graphs"
            "data-section data-section";
      }

      .parameters-section {
        justify-content: center;
      }

      .events-section {
        width: 100%;
        max-width: ${eventsSectionWidth};
        min-width: ${eventsSectionWidth};
        justify-self: center;
        margin-right: 0;
        margin-left: 0;
      }

      .graphs-section {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: stretch;
        gap: 1.8rem;
        width: 100%;
        max-height: none;
      }

      .graph-container {
        flex: 1 1 calc(50% - 1rem);
        min-width: 0;
        max-width: 100%;
        width: 100%;
      }
    }

    /* Medium Screen to single column layout */
    @media (max-width: ${lbp.medium}px) {
      header {
        max-width: calc(3 * ${parameterCardWidth} + 2 * 1.35rem + 2 * 1.2rem);
      }
      main {
        grid-template-columns: 1fr;
        grid-template-areas: 
            "parameters"
            "events"
            "graphs"
            "data-section";
        max-width: 100%;
        overflow-x: hidden;
        justify-content: center;
      }

      .parameters-section {
        grid-template-columns: repeat(3, minmax(${parameterCardWidth}, ${parameterCardWidth}));
        justify-content: center;
        max-width: 100%;
        justify-self: center;
      }

      .graphs-section {
        flex-direction: column;
        max-width: ${eventsSectionWidth};
        justify-self: center;
      }

      .events-section {
        width: 100%;
        min-width: 0;
        max-width: ${eventsSectionWidth};
        margin: 0;
        justify-self: center;
      }

      .data-section {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        overflow: visible;
        justify-self: center;
      }
    }

    /* Parameters cards ordering for 3-column parameters layout:
       row 2 = Drawdown, Allocations, Economy */
    @media (max-width: ${lbp.medium}px) and (min-width: ${lbp.narrow + 1}px) {
      .parameters-section > #drawdownPriorities {
        order: 4;
      }
      .parameters-section > #Allocations {
        order: 5;
      }
      .parameters-section > #growthRates {
        order: 6;
      }
    }

    /* Parameters section back to 2 columns */
    @media (max-width: ${lbp.narrow}px) {
      .parameters-section {
        grid-template-columns: repeat(2, minmax(${parameterCardWidth}, ${parameterCardWidth}));
        justify-content: center;
      }
    }

    /* Mobile Screen adjustments */
    @media (max-width: ${lbp.mobile}px) {
      header {
        max-width: none;
      }
      main {
        margin: 1.8rem auto var(--data-section-viewport-gap) auto;
        max-width: none;
      }

      .parameters-section {
        grid-template-columns: 1fr;
        justify-content: center;
        justify-self: center;
        justify-items: center;
      }

      .events-section {
        width: 100%;
        min-width: 0;
        max-width: none;
        justify-self: center;
      }

      .graphs-section {
        max-width: none;
        justify-self: center;
      }

      .data-section {
        justify-self: center;
      }

      .parameters-section > #drawdownPriorities {
        order: 99;
      }
    }
    
    /* Small mobile header compensation */
    @media (max-width: ${bp.smallMobile}px) {
      main {
        margin-top: calc(60px + 1.8rem);
        margin-bottom: var(--data-section-viewport-gap);
      }
    }
    `;

  // Inject CSS into the page
  let styleElement = document.getElementById('dynamic-layout-responsive-css');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'dynamic-layout-responsive-css';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

document.addEventListener('DOMContentLoaded', () => {
  // Generate header responsive CSS from centralized breakpoints
  generateHeaderResponsiveCSS();

  // Generate layout responsive CSS from centralized breakpoints
  generateLayoutResponsiveCSS();

  // Create global instance for wizard access
  window.mobileBurgerMenuInstance = new MobileBurgerMenu();
  initializeResponsiveHeader();
});

// Clean up any previous squeeze adjustments on load
function cleanupButtonStyles() {
  const allButtons = document.querySelectorAll('.header-center button, .header-right button');
  const allContainers = document.querySelectorAll('.header-center, .header-right');

  allButtons.forEach(btn => {
    btn.style.removeProperty('padding');
    btn.style.removeProperty('font-size');
  });

  allContainers.forEach(container => {
    container.style.removeProperty('gap');
  });
}

function initializeResponsiveHeader() {
  // Clean up any existing squeeze adjustments
  cleanupButtonStyles();

  // Reveal the header (hidden by default for first-render flash prevention)
  const header = document.querySelector('header');
  if (header && header.classList.contains('header-hidden')) {
    // Use requestAnimationFrame to ensure this runs in next paint cycle for smoother animation
    requestAnimationFrame(() => header.classList.remove('header-hidden'));
  }
}

// Fix iOS Safari zoom on orientation change
let lastOrientation = window.orientation;
function preventZoomOnOrientationChange(isOrientationChange = false) {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    // Force viewport reset on orientation change
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');

    // Only scroll to top on actual orientation changes, not regular resize events
    if (isOrientationChange) {
      setTimeout(() => {
        if (window.visualViewport) {
          window.scrollTo(0, 0);
        }
      }, 100);
    }
  }
}

// Listen for orientation changes
window.addEventListener('orientationchange', () => {
  lastOrientation = window.orientation;
  preventZoomOnOrientationChange(true);
});

// Listen for resize events but only scroll to top if orientation actually changed
let orientationResizeTimeout;
window.addEventListener('resize', function () {
  clearTimeout(orientationResizeTimeout);
  orientationResizeTimeout = setTimeout(() => {
    // Check if orientation actually changed (fallback for devices that don't fire orientationchange)
    const currentOrientation = window.orientation;
    const orientationChanged = currentOrientation !== lastOrientation;
    if (orientationChanged) {
      lastOrientation = currentOrientation;
    }
    preventZoomOnOrientationChange(orientationChanged);
  }, 100);
});

// Data Table Layout & Sticky Column Manager
let dataSectionViewportLockScheduled = false;

function scheduleDataSectionViewportLockUpdate() {
  if (dataSectionViewportLockScheduled) return;
  dataSectionViewportLockScheduled = true;
  requestAnimationFrame(function () {
    dataSectionViewportLockScheduled = false;
    updateDataSectionViewportLock();
  });
}

function updateDataSectionViewportLock() {
  const dataSection = document.querySelector('.data-section:not(#mobile-data-message)');
  const header = document.querySelector('header');
  if (!dataSection || !header) return;
  if (window.getComputedStyle(dataSection).display === 'none') return;

  const visualViewportHeight = window.visualViewport ? window.visualViewport.height : 0;
  const viewportHeight = Math.max(window.innerHeight || 0, visualViewportHeight || 0);
  const headerHeight = Math.ceil(header.getBoundingClientRect().height || 60);
  const rootStyles = window.getComputedStyle(document.documentElement);
  const viewportGap = parseFloat(rootStyles.getPropertyValue('--data-section-viewport-gap')) || 18;
  const availableHeight = Math.max(220, Math.floor(viewportHeight - headerHeight - 2 * viewportGap));
  document.documentElement.style.setProperty('--data-section-available-height', `${availableHeight}px`);

  const cardHeader = dataSection.querySelector('.card-header-flex');
  const tableContainer = dataSection.querySelector('.table-container');
  if (!tableContainer) return;
  let cardHeaderHeight = 0;
  if (cardHeader) {
    cardHeaderHeight = Math.ceil(cardHeader.getBoundingClientRect().height || cardHeader.offsetHeight || 0);
  }
  if (cardHeaderHeight > 0) {
    document.documentElement.style.setProperty('--data-section-card-header-height', `${cardHeaderHeight}px`);
  } else {
    cardHeaderHeight = 48; // fallback for transient initial layout
  }

  const dataTable = document.getElementById('Data');
  const thead = dataTable ? dataTable.querySelector('thead') : null;
  const taxHeader = dataTable ? dataTable.querySelector('tbody tr.tax-header') : null;
  const tbody = dataTable ? dataTable.querySelector('tbody') : null;
  const dataRowCount = tbody ? tbody.querySelectorAll('tr:not(.tax-header)').length : 0;
  const taxHeaderCount = tbody ? tbody.querySelectorAll('tr.tax-header').length : 0;
  tableContainer.classList.toggle('data-table-empty', dataRowCount === 0 && taxHeaderCount > 0);
  if (dataRowCount === 0 && taxHeaderCount === 0) return;

  // Measure intrinsic table content first, then pin the section to that exact height.
  dataSection.style.removeProperty('height');
  dataSection.style.removeProperty('max-height');
  tableContainer.style.removeProperty('max-height');
  tableContainer.style.removeProperty('overflow-y');
  const sectionRect = dataSection.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const sectionChromeHeight = Math.ceil(Math.max(0, tableContainerRect.top - sectionRect.top));
  if (sectionChromeHeight > 0) {
    document.documentElement.style.setProperty('--data-section-card-header-height', `${sectionChromeHeight}px`);
  }

  const theadHeight = Math.ceil((thead && (thead.getBoundingClientRect().height || thead.offsetHeight || thead.scrollHeight)) || 0);
  const taxHeaderHeight = Math.ceil((taxHeader && (taxHeader.getBoundingClientRect().height || taxHeader.offsetHeight || taxHeader.scrollHeight)) || 0);
  const structuralTableHeight = theadHeight + taxHeaderHeight;
  const tableContainerScrollHeight = Math.ceil(tableContainer.scrollHeight || 0);
  const dataTableHeight = Math.ceil((dataTable && (dataTable.getBoundingClientRect().height || dataTable.offsetHeight || dataTable.scrollHeight)) || 0);
  const naturalTableHeight = Math.max(structuralTableHeight, tableContainerScrollHeight, dataTableHeight);
  const maxTableHeight = Math.max(0, availableHeight - sectionChromeHeight);
  const clampedTableHeight = Math.min(naturalTableHeight, maxTableHeight);
  const clampedHeight = sectionChromeHeight + clampedTableHeight;
  dataSection.style.height = `${clampedHeight}px`;
  dataSection.style.maxHeight = `${clampedHeight}px`;
  tableContainer.style.maxHeight = `${clampedTableHeight}px`;
  tableContainer.style.overflowY = 'auto';

  const centerOffset = Math.max(0, Math.floor((availableHeight - clampedHeight) / 2));
  const stickyTop = headerHeight + viewportGap + centerOffset;
  document.documentElement.style.setProperty('--data-section-sticky-top', `${stickyTop}px`);
}

// Calculate and set dynamic Age column width for sticky positioning
function updateStickyColumnWidths() {
  const dataTable = document.getElementById('Data');
  if (!dataTable) return;
  // Read Age column width from the visible sticky headers when available.
  // On fresh load we create a dynamic \`.tax-header\` row but remove the temporary data row,
  // so the first reliable visible Age cell is the tax-header's first <th>.
  let ageCell = dataTable.querySelector('tbody tr.tax-header th:nth-child(1)');
  if (!ageCell) {
    // Otherwise use the first non-tax data row.
    ageCell = dataTable.querySelector('tbody tr:not(.tax-header) td:nth-child(1)');
  }
  if (!ageCell) {
    // Last resort: static thead (may be hidden when dynamic tax headers are active).
    ageCell = dataTable.querySelector('thead tr:last-child th:nth-child(1)');
  }
  if (!ageCell) return;

  // Prefer offsetWidth when available (includes borders/padding and matches historical layout).
  // If the element is hidden (e.g. header row display:none), offsetWidth can be 0; fall back
  // to computed CSS width + borders so sticky offsets remain correct.
  const ow = ageCell.offsetWidth || 0;
  const cs = window.getComputedStyle(ageCell);
  const w = parseFloat(cs.width) || 0;
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const br = parseFloat(cs.borderRightWidth) || 0;
  const fallbackWidth = w + bl + br;
  const ageWidth = ow || fallbackWidth;

  // Set CSS custom property for dynamic positioning
  if (ageWidth > 0) {
    dataTable.style.setProperty('--age-column-width', `${ageWidth}px`);
  } else {
    dataTable.style.removeProperty('--age-column-width');
  }

  const groupHeaderRow = dataTable.querySelector('thead tr.header-groups');
  if (groupHeaderRow) {
    const rowHeight = (groupHeaderRow.getBoundingClientRect().height || groupHeaderRow.offsetHeight || 0);
    if (rowHeight > 0) {
      dataTable.style.setProperty('--data-header-group-height', `${rowHeight}px`);
    } else {
      dataTable.style.removeProperty('--data-header-group-height');
    }
  }
}

// Update on DOM content loaded
document.addEventListener('DOMContentLoaded', function () {
  // Initial calculation with a small delay to ensure table is rendered
  setTimeout(updateStickyColumnWidths, 100);
  scheduleDataSectionViewportLockUpdate();
});

// Update on window resize
window.addEventListener('resize', updateStickyColumnWidths);
window.addEventListener('resize', scheduleDataSectionViewportLockUpdate);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scheduleDataSectionViewportLockUpdate);
}

// Update when table content changes (observe for changes)
const tableObserver = new MutationObserver(function (mutations) {
  let shouldUpdate = false;
  mutations.forEach(function (mutation) {
    if (mutation.type === 'childList' &&
      (mutation.target.closest('#Data') || mutation.target.id === 'Data')) {
      shouldUpdate = true;
    }
  });
  if (shouldUpdate) {
    setTimeout(updateStickyColumnWidths, 50);
    scheduleDataSectionViewportLockUpdate();
  }
});

// Start observing when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
  const dataTable = document.getElementById('Data');
  if (dataTable) {
    tableObserver.observe(dataTable, {
      childList: true,
      subtree: true
    });
  }
});

// Track color scheme changes for zebra striping control
function updateColorSchemeAttribute(presetName) {
  const dataTable = document.getElementById('Data');
  if (dataTable) {
    dataTable.setAttribute('data-color-scheme', presetName || 'default');
  }
}

// Listen for color scheme dropdown changes
document.addEventListener('DOMContentLoaded', function () {
  const dropdown = document.getElementById('presetOptions');
  if (dropdown) {
    dropdown.addEventListener('click', function (e) {
      const option = e.target.closest('[data-value]');
      if (option) {
        const presetName = option.getAttribute('data-value');
        updateColorSchemeAttribute(presetName);
      }
    });
  }

  // Set initial color scheme attribute
  updateColorSchemeAttribute('default');
});

// App Icon Version Tooltip
document.addEventListener('DOMContentLoaded', function () {
  const appIcon = document.querySelector('.app-icon');
  if (appIcon) {
    const currentVersion = 'current';
    const tooltipText = `FinSimLab version ${currentVersion}`;

    // Use TooltipUtils to attach tooltip with 5-second delay
    TooltipUtils.attachTooltip(appIcon, tooltipText, {
      hoverDelay: 5000,  // 5 seconds
      touchDelay: 5000   // 5 seconds for touch devices too
    });
  }
});

// Welcome Modal & Global Toggle Manager
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('welcomeModalToggleMobile');
  if (!toggle) return;

  const toggleSwitch = toggle.querySelector('.toggle-switch');
  const savedState = localStorage.getItem('welcomeModalState') || 'on';
  toggle.setAttribute('data-toggle-state', savedState);
  if (toggleSwitch) {
    if (savedState === 'on') {
      toggleSwitch.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
    }
  }

  // Attach tooltips to toggles for all layouts
  function attachToggleTooltip(el, textOrProvider) {
    if (!el || typeof TooltipUtils === 'undefined') return;
    // Use reusable TooltipUtils hover/long-press behaviour; supports function providers
    TooltipUtils.attachTooltip(el, textOrProvider);
    // Additionally, on mobile tap show a brief tooltip without long-press
    el.addEventListener('click', function (ev) {
      if (window.innerWidth <= 768) {
        let tooltipText;
        try {
          tooltipText = (typeof textOrProvider === 'function') ? textOrProvider() : textOrProvider;
        } catch (_) {
          tooltipText = (typeof textOrProvider === 'string') ? textOrProvider : "Show all values in today's currency (adjusted for inflation)";
        }
        const tt = TooltipUtils.showTooltip(tooltipText, el, { isMobile: true });
        setTimeout(() => TooltipUtils.hideTooltip(tt), 2000);
      }
    }, { passive: true });
  }

  // Attach tooltips to toggles (mobile & desktop will reuse same logic)
  const eventsToggle = document.getElementById('eventsWizardToggleMobile');
  const presentValueToggle = document.getElementById('presentValueToggleMobile');
  if (typeof TooltipUtils !== 'undefined') {
    if (eventsToggle) {
      attachToggleTooltip(eventsToggle, 'Toggle the Event Wizard for creating events.');
    }
    if (presentValueToggle) {
      attachToggleTooltip(presentValueToggle, function () {
        try {
          // Derive reporting currency without creating WebUI early
          let country = null;
          let currencyCode = null;

          // 1) Prefer reading directly from DOM (hidden input created by Start Country dropdown)
          const hidden = document.getElementById('StartCountry');
          if (hidden && hidden.value) {
            country = String(hidden.value).toLowerCase();
          } else {
            // 2) If a WebUI instance already exists, read via it (do NOT instantiate)
            const existingWebUI = (typeof window !== 'undefined' && window.WebUI_instance) ? window.WebUI_instance : null;
            if (existingWebUI && typeof existingWebUI.getValue === 'function') {
              const v = existingWebUI.getValue('StartCountry');
              if (v) country = String(v).toLowerCase();
            }
          }

          // 3) Resolve currency via cached tax rule set
          if (country && typeof Config !== 'undefined' && typeof Config.getInstance === 'function') {
            try {
              const rs = Config.getInstance().getCachedTaxRuleSet(country);
              if (rs && typeof rs.getCurrencyCode === 'function') {
                currencyCode = rs.getCurrencyCode();
              }
            } catch (_) { }
          }

          const cc = currencyCode || 'currency';
          return "Show all values in today's " + cc + " (adjusted for inflation)";
        } catch (_) {
          return "Show all values in today's currency (adjusted for inflation)";
        }
      });
    }
    attachToggleTooltip(toggle, 'Toggle to always show the intro window on start-up or only through the Help button.');
  }

  window.dispatchEvent(new CustomEvent('welcomeModalToggle', {
    detail: { state: savedState, enabled: savedState === 'on' }
  }));

  toggle.addEventListener('click', function () {
    const currentState = toggle.getAttribute('data-toggle-state');
    const newState = currentState === 'on' ? 'off' : 'on';
    toggle.setAttribute('data-toggle-state', newState);

    if (toggleSwitch) {
      if (newState === 'on') {
        toggleSwitch.classList.add('active');
      } else {
        toggleSwitch.classList.remove('active');
      }
    }

    localStorage.setItem('welcomeModalState', newState);

    window.dispatchEvent(new CustomEvent('welcomeModalToggle', {
      detail: { state: newState, enabled: newState === 'on' }
    }));
  });
});
