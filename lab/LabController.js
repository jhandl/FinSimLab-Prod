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
    const countriesButton = document.getElementById('countryAccessButtonMobile');
    const recoverLicenseButton = document.getElementById('recoverLicenseButtonMobile');
    const feedbackButton = document.getElementById('feedbackButtonMobile');
    const latestUpdatesButton = document.getElementById('latestUpdatesMobile');
    const toggleButton = document.getElementById('experimentalToggleMobile');
    const eventsWizardToggleButton = document.getElementById('eventsWizardToggleMobile');
    const presentValueToggleButton = document.getElementById('presentValueToggleMobile');
    const customFeesToggleButton = document.getElementById('customFeesToggleMobile');
    const countryTabsSyncToggleButton = document.getElementById('countryTabsSyncToggleMobile');
    const coffeeButton = document.getElementById('coffeeButton');
    const firstDivider = document.getElementById('mobileRunDivider');
    const secondDivider = document.getElementById('mobileSaveLoadDivider');
    const countriesDivider = document.getElementById('mobileCountriesDivider');
    const feedbackDivider = document.getElementById('mobileFeedbackDivider');
    const thirdDivider = document.getElementById('mobileToggleDivider');
    const fourthDivider = document.getElementById('mobileCoffeeDivider');
    const isVisibleMenuItem = function (element) {
      return !!(element && element.style.display !== 'none' && !element.hidden);
    };

    // Hardcoded toggle to show/hide the experimental toggle button
    const SHOW_TOGGLE_BUTTON = false;
    // Always show the Events Wizard toggle
    const SHOW_EVENTS_WIZARD_TOGGLE = true;
    // Always show the Present Value toggle
    const SHOW_PRESENT_VALUE_TOGGLE = true;
    const SHOW_CUSTOM_FEES_TOGGLE = true;
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
    let hasCountriesSection = false;
    let hasToggleSection = SHOW_TOGGLE_BUTTON || SHOW_EVENTS_WIZARD_TOGGLE || SHOW_PRESENT_VALUE_TOGGLE || SHOW_CUSTOM_FEES_TOGGLE || SHOW_COUNTRY_TABS_SYNC_TOGGLE;

    if (currentWidth > breakpoints.countries) {
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';
      if (loadButton) loadButton.style.display = 'none';
      if (demoButton) demoButton.style.display = 'none';
      if (helpButton) helpButton.style.display = 'none';
      if (countriesButton) countriesButton.style.display = 'none';

      hasRunSection = false;
      hasSaveLoadSection = false;
      hasDemoHelpSection = false;
      hasCountriesSection = false;
    } else if (currentWidth > breakpoints.tablet) {
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';
      if (loadButton) loadButton.style.display = 'none';
      if (demoButton) demoButton.style.display = 'none';
      if (helpButton) helpButton.style.display = 'none';
      if (countriesButton) countriesButton.style.display = 'flex';

      hasRunSection = false;
      hasSaveLoadSection = false;
      hasDemoHelpSection = false;
      hasCountriesSection = true;
    } else if (currentWidth > breakpoints.mobile) {
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'none';
      if (loadButton) loadButton.style.display = 'none';
      if (demoButton) demoButton.style.display = 'flex';
      if (helpButton) helpButton.style.display = 'flex';
      if (countriesButton) countriesButton.style.display = 'flex';

      hasRunSection = false;
      hasSaveLoadSection = false;
      hasDemoHelpSection = true;
      hasCountriesSection = true;
    } else {
      if (runButton) runButton.style.display = 'none';
      if (statusDiv) statusDiv.style.display = 'none';
      if (saveButton) saveButton.style.display = 'flex';
      if (loadButton) loadButton.style.display = 'flex';
      if (demoButton) demoButton.style.display = 'flex';
      if (helpButton) helpButton.style.display = 'flex';
      if (countriesButton) countriesButton.style.display = 'flex';

      hasRunSection = false;
      hasSaveLoadSection = true;
      hasDemoHelpSection = true;
      hasCountriesSection = true;
    }

    if (latestUpdatesButton) latestUpdatesButton.style.display = 'flex';
    if (feedbackButton) feedbackButton.style.display = 'flex';

    const hasLicenseSection = hasCountriesSection || isVisibleMenuItem(recoverLicenseButton);
    const hasFeedbackSection = isVisibleMenuItem(feedbackButton) || isVisibleMenuItem(latestUpdatesButton);

    // Show dividers only when they separate visible content
    // First divider: between Run/Status and Save/Load
    if (firstDivider) {
      firstDivider.style.display = (hasRunSection && hasSaveLoadSection) ? 'block' : 'none';
    }

    // Second divider: between Save/Load and Demo/Help/Toggle
    if (secondDivider) {
      secondDivider.style.display = (hasSaveLoadSection && (hasDemoHelpSection || hasCountriesSection || hasToggleSection)) ? 'block' : 'none';
    }

    // Countries divider: between Help and Real Countries
    if (countriesDivider) {
      countriesDivider.style.display = (hasDemoHelpSection && hasCountriesSection) ? 'block' : 'none';
    }

    // Feedback divider: between Recover License/Real Countries and Feedback/Change log
    if (feedbackDivider) {
      feedbackDivider.style.display = (hasLicenseSection && hasFeedbackSection) ? 'block' : 'none';
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
    if (customFeesToggleButton) {
      customFeesToggleButton.style.display = SHOW_CUSTOM_FEES_TOGGLE ? 'flex' : 'none';
    }
    if (countryTabsSyncToggleButton) {
      countryTabsSyncToggleButton.style.display = SHOW_COUNTRY_TABS_SYNC_TOGGLE ? 'flex' : 'none';
    }

    // Third divider: between Change log and toggles
    if (thirdDivider) {
      thirdDivider.style.display = (isVisibleMenuItem(latestUpdatesButton) && hasToggleSection) ? 'block' : 'none';
    }

    // Fourth divider: between toggles and Coffee
    if (fourthDivider) {
      const coffeeVisible = !!(coffeeButton && !coffeeButton.hidden);
      fourthDivider.style.display = (hasToggleSection && coffeeVisible) ? 'block' : 'none';
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

    // Custom Fees Toggle
    const customFeesToggleMobile = document.getElementById('customFeesToggleMobile');
    if (customFeesToggleMobile) {
      customFeesToggleMobile.addEventListener('click', () => {
        this.handleCustomFeesToggle();
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

  handleCustomFeesToggle() {
    WebUI.getInstance().toggleCustomFees();
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

    const customFeesToggleButton = document.getElementById('customFeesToggleMobile');
    if (customFeesToggleButton) {
      WebUI.getInstance().syncCustomFeesMenuToggle();
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

let cssLengthProbe = null;
let adaptiveLayoutScheduled = false;

function getBreakpoints() {
  const style = getComputedStyle(document.documentElement);
  return {
    countries: parseInt(style.getPropertyValue('--breakpoint-countries'), 10),
    tablet: parseInt(style.getPropertyValue('--breakpoint-tablet'), 10),
    mobile: parseInt(style.getPropertyValue('--breakpoint-mobile'), 10)
  };
}

function getHeaderResponsiveMode() {
  const currentWidth = window.innerWidth;
  const breakpoints = getBreakpoints();
  if (currentWidth > breakpoints.countries) return 'full';
  if (currentWidth > breakpoints.tablet) return 'country-menu';
  if (currentWidth > breakpoints.mobile) return 'secondary-menu';
  return 'save-load-menu';
}

function updateHeaderResponsiveState() {
  document.body.classList.remove(
    'header-name-hidden',
    'header-country-menu',
    'header-secondary-menu',
    'header-save-load-menu',
    'header-run-short'
  );
  document.body.setAttribute('data-header-mode', getHeaderResponsiveMode());
  if (window.mobileBurgerMenuInstance && typeof window.mobileBurgerMenuInstance.updateMenuContent === 'function') {
    window.mobileBurgerMenuInstance.updateMenuContent();
  }
  return { mode: getHeaderResponsiveMode() };
}

function generateHeaderResponsiveCSS() {
  const bp = getBreakpoints();
  const css = `
    header {
      max-width: 2350px;
      margin: 0 auto;
    }

    @media (min-width: ${bp.tablet + 1}px) {
      header { display: flex !important; flex-wrap: nowrap !important; gap: 0.5rem !important; padding: 0.75rem 1.2rem !important; height: 60px !important; justify-content: space-between !important; align-items: center !important; }
      .header-left { flex: 0 0 auto !important; min-width: 40px !important; justify-content: flex-start !important; display: flex !important; align-items: center !important; gap: 0.75rem !important; }
      .header-left .app-name { display: none !important; }
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

    @media (min-width: 994px) {
      .header-left .app-name { display: block !important; margin: 0 !important; font-size: 1.25rem !important; font-weight: 700 !important; }
    }

    @media (max-width: ${bp.countries}px) and (min-width: ${bp.tablet + 1}px) {
      #countryAccessButton { display: none !important; }
    }

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
    }
  `;

  let styleElement = document.getElementById('dynamic-header-responsive-css');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'dynamic-header-responsive-css';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

function getCssLength(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const numeric = parseFloat(raw);
  if (Number.isFinite(numeric) && raw.endsWith('px')) return numeric;
  if (!document.body) return Number.isFinite(numeric) ? numeric : fallback;
  if (!cssLengthProbe) {
    cssLengthProbe = document.createElement('div');
    cssLengthProbe.style.position = 'fixed';
    cssLengthProbe.style.visibility = 'hidden';
    cssLengthProbe.style.pointerEvents = 'none';
    cssLengthProbe.style.height = '0';
    cssLengthProbe.style.overflow = 'hidden';
    cssLengthProbe.style.left = '0';
    cssLengthProbe.style.top = '0';
    document.body.appendChild(cssLengthProbe);
  }
  cssLengthProbe.style.width = raw;
  const measured = cssLengthProbe.getBoundingClientRect().width;
  return measured > 0 ? measured : fallback;
}

function getCssVariableLength(name, fallback) {
  return getCssLength('var(' + name + ')', fallback);
}

function getComputedLength(element, property, fallback) {
  if (!element) return fallback;
  return getCssLength(window.getComputedStyle(element).getPropertyValue(property), fallback);
}

function formatPx(value) {
  return Math.max(0, Math.round(value * 100) / 100) + 'px';
}

function parameterGridWidth(columns, cardWidth, gap) {
  return columns * cardWidth + Math.max(0, columns - 1) * gap;
}

function fittedParameterColumns(available, cardWidth, gap) {
  for (let columns = 3; columns >= 2; columns--) {
    if (parameterGridWidth(columns, cardWidth, gap) <= available + 0.5) return columns;
  }
  return 1;
}

function updateMainAdaptiveLayout() {
  const main = document.querySelector('main');
  const parametersSection = document.querySelector('.parameters-section');
  if (!main || !parametersSection) return null;

  const root = document.documentElement;
  const mainStyle = window.getComputedStyle(main);
  const viewportWidth = root.clientWidth || window.innerWidth || 0;
  const mainPadding = getCssLength(mainStyle.paddingLeft, 0) + getCssLength(mainStyle.paddingRight, 0);
  const available = Math.max(1, viewportWidth - mainPadding);
  const cardWidth = Math.max(1, getCssVariableLength('--parameter-card-width', 348));
  const eventsWidth = Math.max(1, getCssVariableLength('--events-section-width', 810));
  const eventsTableMinWidth = Math.max(1, getCssVariableLength('--events-table-min-width', 774));
  const graphMinWidth = Math.max(1, getCssVariableLength('--graphs-section-min-width', 520));
  const graphPreferredWidth = Math.max(graphMinWidth, getCssVariableLength('--graphs-section-preferred-width', graphMinWidth));
  const labMaxWidth = Math.max(1, getCssVariableLength('--lab-max-width', 2350));
  const mainGap = getComputedLength(main, 'column-gap', getCssVariableLength('--lab-main-gap', 28.8));
  const parameterGap = getComputedLength(parametersSection, 'column-gap', getCssVariableLength('--parameter-grid-gap', 21.6));

  const pairedParameterWidth = parameterGridWidth(2, cardWidth, parameterGap);
  const fullRequiredWidth = pairedParameterWidth + eventsWidth + graphMinWidth + 2 * mainGap;
  const paramsEventsRequiredWidth = pairedParameterWidth + eventsWidth + mainGap;
  let mode = 'stacked';
  let columns = fittedParameterColumns(available, cardWidth, parameterGap);

  if (available >= fullRequiredWidth) {
    mode = 'full';
    columns = 2;
  } else if (available >= paramsEventsRequiredWidth) {
    mode = 'params-events';
    columns = 2;
  }

  const renderedCardWidth = (columns === 1) ? Math.min(cardWidth, available) : cardWidth;
  const parametersWidth = parameterGridWidth(columns, renderedCardWidth, parameterGap);
  const renderedEventsWidth = Math.min(eventsWidth, available);
  let mainMaxWidth = labMaxWidth;
  if (mode === 'full') {
    mainMaxWidth = Math.max(labMaxWidth, parametersWidth + renderedEventsWidth + graphPreferredWidth + 2 * mainGap);
  } else if (mode === 'params-events') {
    mainMaxWidth = parametersWidth + renderedEventsWidth + mainGap;
  } else if (mode === 'stacked') {
    mainMaxWidth = Math.max(parametersWidth, renderedEventsWidth);
  }

  root.style.setProperty('--parameter-column-count', String(columns));
  root.style.setProperty('--adaptive-parameter-card-width', formatPx(renderedCardWidth));
  root.style.setProperty('--adaptive-parameters-width', formatPx(parametersWidth));
  root.style.setProperty('--adaptive-events-width', formatPx(renderedEventsWidth));
  root.style.setProperty('--adaptive-main-max-width', formatPx(mainMaxWidth));
  main.dataset.layoutMode = mode;
  main.dataset.parameterColumns = String(columns);

  document.body.classList.toggle('lab-layout-full', mode === 'full');
  document.body.classList.toggle('lab-layout-params-events', mode === 'params-events');
  document.body.classList.toggle('lab-layout-stacked', mode === 'stacked');
  document.body.classList.toggle('lab-data-deferred', available < eventsTableMinWidth);

  return {
    mode: mode,
    parameterColumns: columns,
    availableWidth: available,
    parameterCardWidth: cardWidth,
    renderedCardWidth: renderedCardWidth,
    parametersWidth: parametersWidth,
    eventsWidth: renderedEventsWidth,
    graphPreferredWidth: graphPreferredWidth,
    mainMaxWidth: mainMaxWidth
  };
}

function updateLabAdaptiveLayout() {
  const layoutState = updateMainAdaptiveLayout();
  const headerState = updateHeaderResponsiveState();
  window.__labAdaptiveLayoutState = {
    layout: layoutState,
    header: headerState
  };
  document.dispatchEvent(new CustomEvent('lab-layout-updated', { detail: window.__labAdaptiveLayoutState }));
  if (typeof scheduleDataSectionViewportLockUpdate === 'function') {
    scheduleDataSectionViewportLockUpdate();
  }
  return window.__labAdaptiveLayoutState;
}

function scheduleLabAdaptiveLayout() {
  if (adaptiveLayoutScheduled) return;
  adaptiveLayoutScheduled = true;
  requestAnimationFrame(function () {
    adaptiveLayoutScheduled = false;
    updateLabAdaptiveLayout();
  });
}

function initializeAdaptiveLayoutObservers() {
  const observer = new MutationObserver(scheduleLabAdaptiveLayout);
  const header = document.querySelector('header');
  const parameters = document.querySelector('.parameters-section');
  if (header) observer.observe(header, { childList: true, subtree: true });
  if (parameters) observer.observe(parameters, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleLabAdaptiveLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleLabAdaptiveLayout);
  }
}

window.updateLabAdaptiveLayout = updateLabAdaptiveLayout;

document.addEventListener('DOMContentLoaded', () => {
  generateHeaderResponsiveCSS();
  updateLabAdaptiveLayout();
  initializeAdaptiveLayoutObservers();

  // Create global instance for wizard access
  window.mobileBurgerMenuInstance = new MobileBurgerMenu();
  updateLabAdaptiveLayout();
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
