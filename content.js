class TestCaseHelper {
  constructor() {
    this.isActive = false;
    this.currentElement = null;
    this.popup = null;
    this.isPopupFixed = false;
    this.isLocked = false;
    this.selectorOrder = ['data-cy', 'id', 'class'];
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.waitingForSecondKey = false;
    
    this.init();
  }

  init() {
    this.loadSettings();
    this.setupEventListeners();
    this.createPopup();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['selectorOrder', 'isPopupFixed', 'isLocked', 'customCopyFunction']);
      this.selectorOrder = result.selectorOrder || ['data-cy', 'id', 'class'];
      this.isPopupFixed = result.isPopupFixed || false;
      this.isLocked = result.isLocked || false;
      this.customCopyFunction = result.customCopyFunction || this.getDefaultCopyFunction();
    } catch (error) {
      console.log('Using default settings');
      this.customCopyFunction = this.getDefaultCopyFunction();
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        selectorOrder: this.selectorOrder,
        isPopupFixed: this.isPopupFixed,
        isLocked: this.isLocked,
        customCopyFunction: this.customCopyFunction
      });
    } catch (error) {
      console.log('Could not save settings');
    }
  }

  getDefaultCopyFunction() {
    return `{
  "type": "selector"
}

/* Available template types and examples:

1. Simple selector:
{
  "type": "selector"
}

2. Cypress commands:
{
  "type": "cypress",
  "options": {
    "command": "get",
    "assertion": "be.visible"
  }
}

3. Playwright locators:
{
  "type": "playwright",
  "options": {
    "method": "locator",
    "action": "click"
  }
}

4. Playwright by role:
{
  "type": "playwright",
  "options": {
    "role": "button",
    "action": "click"
  }
}

5. Selenium:
{
  "type": "selenium",
  "options": {
    "method": "cssSelector"
  }
}

6. Element info:
{
  "type": "element-info",
  "options": {
    "includeTag": true,
    "includeText": true,
    "includeId": true
  }
}

7. Data attributes:
{
  "type": "data-attribute",
  "options": {
    "attribute": "data-cy"
  }
}

8. Custom template:
{
  "type": "custom-format",
  "options": {
    "template": "\${element.tagName} - \${element.textContent}"
  }
}

*/`;
  }

  setupEventListeners() {
    document.addEventListener('mouseover', this.handleMouseOver.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('click', this.handleClick.bind(this), true); // Use capture phase
    document.addEventListener('mousedown', this.handlePageEvent.bind(this), true);
    document.addEventListener('mouseup', this.handlePageEvent.bind(this), true);
    document.addEventListener('dblclick', this.handlePageEvent.bind(this), true);
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle-inspector') {
        this.toggleInspector();
        sendResponse({ isActive: this.isActive });
      } else if (request.action === 'toggle-popup-mode') {
        this.togglePopupMode();
        sendResponse({ isPopupFixed: this.isPopupFixed });
      } else if (request.action === 'copy-selector') {
        this.copyCurrentSelector();
        sendResponse({ success: true });
      } else if (request.action === 'toggle-lock') {
        this.toggleLock();
        sendResponse({ isLocked: this.isLocked });
      } else if (request.action === 'get-status') {
        sendResponse({ isActive: this.isActive, isPopupFixed: this.isPopupFixed, isLocked: this.isLocked });
      }
      return true;
    });
  }

  handleKeyDown(event) {
    // Handle the custom sequence: Command+Control+I followed by E/M/C
    if (event.metaKey && event.ctrlKey && (event.key === 'i' || event.key === 'I')) {
      event.preventDefault();
      this.waitingForSecondKey = true;
      
      const timeout = setTimeout(() => {
        this.waitingForSecondKey = false;
      }, 2000);
      
      document.addEventListener('keydown', (secondEvent) => {
        if (this.waitingForSecondKey && secondEvent.metaKey && secondEvent.ctrlKey) {
          clearTimeout(timeout);
          this.waitingForSecondKey = false;
          secondEvent.preventDefault();
          
          if (secondEvent.key === 'e' || secondEvent.key === 'E') {
            this.toggleInspector();
          } else if (secondEvent.key === 'm' || secondEvent.key === 'M') {
            this.togglePopupMode();
          } else if (secondEvent.key === 'c' || secondEvent.key === 'C') {
            this.copyCurrentSelector();
          } else if (secondEvent.key === 'l' || secondEvent.key === 'L') {
            this.toggleLock();
          }
        }
      }, { once: true });
    }
  }

  handleMouseOver(event) {
    if (!this.isActive || this.isLocked) return;
    
    // Ignore events from our own popup
    if (event.target.closest('#test-helper-popup')) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    if (this.currentElement) {
      this.currentElement.style.outline = '';
    }
    
    this.currentElement = event.target;
    this.currentElement.style.outline = this.isLocked ? '2px solid #ff6b6b' : '2px solid #007acc';
    
    this.updatePopup();
  }

  handleMouseMove(event) {
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    
    if (this.isActive && !this.isPopupFixed && this.popup) {
      this.updatePopupPosition();
    }
  }

  handleClick(event) {
    if (!this.isActive) return;
    
    // Don't interfere with our own popup clicks
    if (event.target.closest('#test-helper-popup')) {
      return;
    }
    
    // Prevent the original click event from executing
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // If clicking on a different element while locked, switch to new element
    if (this.isLocked && this.currentElement && event.target !== this.currentElement) {
      // Clear previous element outline
      this.currentElement.style.outline = '';
      
      // Set new element and lock it
      this.currentElement = event.target;
      this.lockElement();
      this.updatePopup();
      return;
    }
    
    // If we don't have a current element, set it to the clicked element
    if (!this.currentElement || event.target !== this.currentElement) {
      if (this.currentElement) {
        this.currentElement.style.outline = '';
      }
      
      this.currentElement = event.target;
      this.currentElement.style.outline = '2px solid #007acc';
      this.updatePopup();
    }
    
    // Lock the clicked element
    this.lockElement();
  }

  handlePageEvent(event) {
    if (!this.isActive) return;
    
    // Don't interfere with our own popup events
    if (event.target.closest('#test-helper-popup')) {
      return;
    }
    
    // Prevent page events when inspector is active
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  createPopup() {
    this.popup = document.createElement('div');
    this.popup.id = 'test-helper-popup';
    this.popup.innerHTML = `
      <div class="popup-header">
        <span class="popup-title">Element Inspector</span>
        <span class="lock-status" style="display: none;">🔒 LOCKED</span>
        <div class="popup-actions">
          <button id="lock-btn" title="Lock Element (⌃⌘I→L)">🔓</button>
          <button id="copy-btn" title="Copy Selector">📋</button>
          <button id="settings-btn" title="Settings">⚙️</button>
          <button id="close-btn" title="Close">✕</button>
        </div>
      </div>
      <div class="popup-content">
        <div id="element-hierarchy"></div>
        <div id="selector-info"></div>
      </div>
      <div class="popup-settings" style="display: none;">
        <div class="setting-group">
          <label>Selector Order:</label>
          <div id="selector-order-inputs"></div>
        </div>
        <div class="setting-group">
          <label>
            <input type="checkbox" id="popup-fixed-checkbox"> Fixed Position
          </label>
        </div>
        <div class="setting-group">
          <label>Copy Template Configuration:</label>
          <textarea id="custom-copy-function" rows="10" placeholder='{"type": "selector"}'></textarea>
          <div class="function-help">
            <small>Use JSON configuration for predefined templates (CSP-safe)</small>
            <div>
              <button id="preset-cypress-btn">Cypress</button>
              <button id="preset-playwright-btn">Playwright</button>
              <button id="preset-selenium-btn">Selenium</button>
              <button id="reset-function-btn">Reset</button>
              <button id="test-function-btn">Test</button>
            </div>
          </div>
        </div>
        <button id="save-settings-btn">Save Settings</button>
      </div>
    `;
    
    document.body.appendChild(this.popup);
    
    this.popup.querySelector('#lock-btn').addEventListener('click', () => this.toggleLock());
    this.popup.querySelector('#copy-btn').addEventListener('click', () => this.copyCurrentSelector());
    this.popup.querySelector('#settings-btn').addEventListener('click', () => this.toggleSettings());
    this.popup.querySelector('#close-btn').addEventListener('click', () => this.toggleInspector());
    this.popup.querySelector('#save-settings-btn').addEventListener('click', () => this.saveSettingsFromUI());
    this.popup.querySelector('#popup-fixed-checkbox').addEventListener('change', (e) => {
      this.isPopupFixed = e.target.checked;
      this.updatePopupPosition();
    });
    this.popup.querySelector('#preset-cypress-btn').addEventListener('click', () => this.setPreset('cypress'));
    this.popup.querySelector('#preset-playwright-btn').addEventListener('click', () => this.setPreset('playwright'));
    this.popup.querySelector('#preset-selenium-btn').addEventListener('click', () => this.setPreset('selenium'));
    this.popup.querySelector('#reset-function-btn').addEventListener('click', () => this.resetCopyFunction());
    this.popup.querySelector('#test-function-btn').addEventListener('click', () => this.testCopyFunction());
    
    this.createSelectorOrderInputs();
    this.hidePopup();
  }

  createSelectorOrderInputs() {
    const container = this.popup.querySelector('#selector-order-inputs');
    const commonSelectors = ['data-cy', 'id', 'class', 'role', 'data-testid', 'name', 'type'];
    
    container.innerHTML = '';
    
    this.selectorOrder.forEach((selector, index) => {
      const div = document.createElement('div');
      div.innerHTML = `
        <select class="selector-dropdown" data-index="${index}">
          ${commonSelectors.map(s => `<option value="${s}" ${s === selector ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="remove-selector" data-index="${index}">Remove</button>
      `;
      container.appendChild(div);
    });
    
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Selector';
    addButton.addEventListener('click', () => this.addSelectorInput());
    container.appendChild(addButton);
    
    container.addEventListener('change', (e) => {
      if (e.target.classList.contains('selector-dropdown')) {
        const index = parseInt(e.target.dataset.index);
        this.selectorOrder[index] = e.target.value;
      }
    });
    
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-selector')) {
        const index = parseInt(e.target.dataset.index);
        this.selectorOrder.splice(index, 1);
        this.createSelectorOrderInputs();
      }
    });
  }

  addSelectorInput() {
    this.selectorOrder.push('data-cy');
    this.createSelectorOrderInputs();
  }

  toggleSettings() {
    const settings = this.popup.querySelector('.popup-settings');
    const content = this.popup.querySelector('.popup-content');
    
    if (settings.style.display === 'none') {
      settings.style.display = 'block';
      content.style.display = 'none';
      this.popup.querySelector('#popup-fixed-checkbox').checked = this.isPopupFixed;
      this.popup.querySelector('#custom-copy-function').value = this.customCopyFunction;
    } else {
      settings.style.display = 'none';
      content.style.display = 'block';
    }
  }

  saveSettingsFromUI() {
    this.customCopyFunction = this.popup.querySelector('#custom-copy-function').value;
    this.saveSettings();
    this.toggleSettings();
    if (this.currentElement) {
      this.updatePopup();
    }
  }

  setPreset(type) {
    const presets = {
      'cypress': '{\n  "type": "cypress",\n  "options": {\n    "command": "get"\n  }\n}',
      'playwright': '{\n  "type": "playwright",\n  "options": {\n    "method": "locator"\n  }\n}',
      'selenium': '{\n  "type": "selenium",\n  "options": {\n    "method": "cssSelector"\n  }\n}'
    };
    
    const preset = presets[type];
    if (preset) {
      this.popup.querySelector('#custom-copy-function').value = preset;
      this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} preset loaded`);
    }
  }

  resetCopyFunction() {
    this.customCopyFunction = this.getDefaultCopyFunction();
    this.popup.querySelector('#custom-copy-function').value = this.customCopyFunction;
    this.showToast('Copy template reset to default');
  }

  async testCopyFunction() {
    if (!this.currentElement) {
      this.showToast('No element selected to test with');
      return;
    }

    try {
      const functionCode = this.popup.querySelector('#custom-copy-function').value;
      const result = await this.executeCopyFunction(functionCode, this.currentElement);
      const preview = result.length > 50 ? result.substring(0, 50) + '...' : result;
      this.showToast(`Test result: ${preview}`);
      console.log('Test Copy Function Result:', result);
    } catch (error) {
      this.showToast(`Function error: ${error.message}`);
      console.error('Copy function test error:', error);
    }
  }

  toggleInspector() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      this.showPopup();
      document.body.style.cursor = this.isLocked ? '' : 'crosshair';
      this.updatePopupHeader();
    } else {
      this.hidePopup();
      document.body.style.cursor = '';
      this.isLocked = false;
      
      // Clear all highlights
      this.clearHoverHighlights();
      
      if (this.currentElement) {
        this.currentElement.style.outline = '';
        this.currentElement = null;
      }
    }
  }

  togglePopupMode() {
    if (!this.isActive) return;
    
    this.isPopupFixed = !this.isPopupFixed;
    this.popup.querySelector('#popup-fixed-checkbox').checked = this.isPopupFixed;
    this.saveSettings();
    this.updatePopupPosition();
  }

  lockElement() {
    if (!this.isActive || !this.currentElement) return;
    
    const wasAlreadyLocked = this.isLocked;
    this.isLocked = true;
    this.isPopupFixed = true;
    this.currentElement.style.outline = '2px solid #ff6b6b';
    
    if (!wasAlreadyLocked) {
      this.showToast('Element locked! Click elsewhere or press ⌃⌘I→L to unlock');
    } else {
      this.showToast('Switched to new element');
    }
    
    document.body.style.cursor = '';
    
    this.updatePopupHeader();
    this.saveSettings();
    this.updatePopupPosition();
  }

  toggleLock() {
    if (!this.isActive || !this.currentElement) return;
    
    this.isLocked = !this.isLocked;
    
    if (this.isLocked) {
      this.lockElement();
    } else {
      // Unlock and restore normal behavior
      this.currentElement.style.outline = '2px solid #007acc';
      this.showToast('Element unlocked!');
      document.body.style.cursor = 'crosshair';
      
      this.updatePopupHeader();
      this.saveSettings();
      this.updatePopupPosition();
    }
  }

  updatePopupHeader() {
    if (!this.popup) return;
    
    const lockStatus = this.popup.querySelector('.lock-status');
    const lockBtn = this.popup.querySelector('#lock-btn');
    
    if (this.isLocked) {
      lockStatus.style.display = 'inline';
      lockBtn.innerHTML = '🔒';
      lockBtn.title = 'Unlock Element (⌃⌘I→L)';
    } else {
      lockStatus.style.display = 'none';
      lockBtn.innerHTML = '🔓';
      lockBtn.title = 'Lock Element (⌃⌘I→L)';
    }
  }

  showPopup() {
    if (!this.popup) {
      console.error('Popup not created');
      return;
    }
    this.popup.style.display = 'block';
    this.updatePopupPosition();
  }

  hidePopup() {
    this.popup.style.display = 'none';
  }

  updatePopupPosition() {
    if (!this.popup || this.popup.style.display === 'none') return;
    
    if (this.isPopupFixed) {
      this.popup.classList.remove('cursor-following');
      this.popup.style.position = 'fixed';
      this.popup.style.top = '20px';
      this.popup.style.right = '20px';
      this.popup.style.left = 'auto';
      this.popup.style.transform = 'none';
    } else {
      this.popup.classList.add('cursor-following');
      this.popup.style.position = 'fixed';
      this.popup.style.right = 'auto';
      
      // Calculate position with offset to avoid cursor interference
      let leftPos = this.lastMouseX + 20;
      let topPos = this.lastMouseY + 20;
      
      // Get popup dimensions (may need to temporarily show it to measure)
      const wasVisible = this.popup.style.display !== 'none';
      if (!wasVisible) {
        this.popup.style.visibility = 'hidden';
        this.popup.style.display = 'block';
      }
      
      const rect = this.popup.getBoundingClientRect();
      
      if (!wasVisible) {
        this.popup.style.display = 'none';
        this.popup.style.visibility = 'visible';
      }
      
      // Adjust position to keep popup on screen
      if (leftPos + rect.width > window.innerWidth) {
        leftPos = this.lastMouseX - rect.width - 20;
      }
      if (topPos + rect.height > window.innerHeight) {
        topPos = this.lastMouseY - rect.height - 20;
      }
      
      // Ensure popup doesn't go off-screen
      leftPos = Math.max(10, Math.min(leftPos, window.innerWidth - rect.width - 10));
      topPos = Math.max(10, Math.min(topPos, window.innerHeight - rect.height - 10));
      
      this.popup.style.left = leftPos + 'px';
      this.popup.style.top = topPos + 'px';
    }
  }

  updatePopup() {
    if (!this.currentElement || !this.popup) return;
    
    const hierarchy = this.getElementHierarchy(this.currentElement);
    const hierarchyElement = this.popup.querySelector('#element-hierarchy');
    const selectorElement = this.popup.querySelector('#selector-info');
    
    if (hierarchyElement) {
      hierarchyElement.innerHTML = this.formatHierarchy(hierarchy);
      
      // Add hover event listeners to tree items
      this.setupTreeItemHoverListeners(hierarchy);
    }
    
    if (selectorElement) {
      selectorElement.style.display = 'none'; // Hide the separate selector section
    }
    
    this.updatePopupPosition();
  }

  setupTreeItemHoverListeners(hierarchy) {
    // Remove existing hover highlights
    this.clearHoverHighlights();
    
    const hoverableItems = this.popup.querySelectorAll('.tree-item.hoverable');
    
    hoverableItems.forEach(item => {
      // Hover effects
      item.addEventListener('mouseenter', (event) => {
        const elementType = event.currentTarget.dataset.elementType;
        const childIndex = event.currentTarget.dataset.childIndex;
        
        let targetElement = null;
        
        if (elementType === 'parent' && hierarchy.parent) {
          targetElement = this.currentElement.parentElement;
        } else if (elementType === 'child' && hierarchy.children.length > 0) {
          const index = parseInt(childIndex);
          const children = Array.from(this.currentElement.children);
          targetElement = children[index];
        }
        
        if (targetElement) {
          this.highlightHoverElement(targetElement);
        }
      });
      
      item.addEventListener('mouseleave', () => {
        this.clearHoverHighlights();
      });
      
      // Click navigation
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        this.navigateToTreeItem(event.currentTarget, hierarchy);
      });
    });
  }

  navigateToTreeItem(treeItem, hierarchy) {
    const elementType = treeItem.dataset.elementType;
    const childIndex = treeItem.dataset.childIndex;
    
    let targetElement = null;
    
    if (elementType === 'parent' && hierarchy.parent) {
      targetElement = this.currentElement.parentElement;
    } else if (elementType === 'child' && hierarchy.children.length > 0) {
      const index = parseInt(childIndex);
      const children = Array.from(this.currentElement.children);
      targetElement = children[index];
    }
    
    if (targetElement) {
      // Clear highlights
      this.clearHoverHighlights();
      
      // Remove outline from current element
      if (this.currentElement) {
        this.currentElement.style.outline = '';
      }
      
      // Set new current element
      this.currentElement = targetElement;
      
      // Apply appropriate outline based on lock state
      if (this.isLocked) {
        this.currentElement.style.outline = '2px solid #ff6b6b';
        this.showToast('Navigated to new element (locked)');
      } else {
        this.currentElement.style.outline = '2px solid #007acc';
        this.showToast('Navigated to new element');
      }
      
      // Update the popup with new hierarchy
      this.updatePopup();
    }
  }

  highlightHoverElement(element) {
    if (element) {
      // Store the original outline to restore later
      element.dataset.originalOutline = element.style.outline || '';
      // Apply hover highlight
      element.style.outline = '2px dashed #ff9800';
    }
  }

  clearHoverHighlights() {
    // Find all elements with hover highlights and restore their original outlines
    const highlightedElements = document.querySelectorAll('[data-original-outline]');
    highlightedElements.forEach(element => {
      element.style.outline = element.dataset.originalOutline || '';
      delete element.dataset.originalOutline;
    });
  }

  getElementHierarchy(element) {
    const parent = element.parentElement;
    const children = Array.from(element.children);
    
    const hierarchy = {
      parent: parent ? this.getElementInfo(parent) : null,
      current: this.getElementInfo(element),
      children: []
    };
    
    if (children.length === 1) {
      const child = children[0];
      if (child.children.length === 0) {
        const textContent = child.textContent?.trim();
        if (textContent) {
          hierarchy.children.push({
            type: 'text',
            content: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : '')
          });
        } else {
          hierarchy.children.push(this.getElementInfo(child));
        }
      } else {
        hierarchy.children.push(this.getElementInfo(child));
      }
    } else if (children.length === 0) {
      const textContent = element.textContent?.trim();
      if (textContent) {
        hierarchy.children.push({
          type: 'text',
          content: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : '')
        });
      }
    }
    
    return hierarchy;
  }

  getElementInfo(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      selector: this.getElementSelector(element),
      textContent: element.textContent?.trim().substring(0, 30) + (element.textContent?.trim().length > 30 ? '...' : '')
    };
  }

  getElementSelector(element) {
    const selectors = [];
    
    this.selectorOrder.forEach(attr => {
      if (attr.includes('+')) {
        const parts = attr.split('+').map(p => p.trim());
        const combinedSelector = parts.map(part => {
          const value = element.getAttribute(part);
          return value ? `[${part}="${value}"]` : '';
        }).filter(Boolean).join('');
        
        if (combinedSelector) {
          selectors.push(combinedSelector);
        }
      } else {
        const value = element.getAttribute(attr);
        if (value) {
          if (attr === 'class') {
            selectors.push('.' + value.split(' ').join('.'));
          } else if (attr === 'id') {
            selectors.push('#' + value);
          } else {
            selectors.push(`[${attr}="${value}"]`);
          }
        }
      }
    });
    
    return selectors.length > 0 ? selectors[0] : element.tagName.toLowerCase();
  }

  formatHierarchy(hierarchy) {
    let html = '<div class="element-tree">';
    
    if (hierarchy.parent) {
      html += `<div class="tree-item parent hoverable" data-element-type="parent">
        <span class="tree-indent">└─</span>
        <span class="tag">${hierarchy.parent.tagName}</span>
        <span class="selector">${hierarchy.parent.selector}</span>
        <span class="nav-arrow">↑</span>
      </div>`;
    }
    
    const indent = hierarchy.parent ? '  └─' : '└─';
    html += `<div class="tree-item current">
      <span class="tree-indent">${indent}</span>
      <span class="tag current-tag">${hierarchy.current.tagName}</span>
      <span class="selector current-selector">${hierarchy.current.selector}</span>
      ${hierarchy.current.textContent ? `<span class="text current-text">"${hierarchy.current.textContent}"</span>` : ''}
    </div>`;
    
    if (hierarchy.children.length > 0) {
      const childIndent = hierarchy.parent ? '    └─' : '  └─';
      hierarchy.children.forEach((child, index) => {
        if (child.type === 'text') {
          html += `<div class="tree-item child">
            <span class="tree-indent">${childIndent}</span>
            <span class="text">"${child.content}"</span>
          </div>`;
        } else {
          html += `<div class="tree-item child hoverable" data-element-type="child" data-child-index="${index}">
            <span class="tree-indent">${childIndent}</span>
            <span class="tag">${child.tagName}</span>
            <span class="selector">${child.selector}</span>
            <span class="nav-arrow">↓</span>
          </div>`;
        }
      });
    }
    
    html += '</div>';
    return html;
  }

  async executeCopyFunction(functionCode, element) {
    // Create a safe copy of the element with all its properties
    const elementCopy = {
      tagName: element.tagName.toLowerCase(),
      textContent: element.textContent?.trim(),
      innerText: element.innerText?.trim(),
      innerHTML: element.innerHTML,
      className: element.className,
      id: element.id,
      attributes: {},
      dataset: {}
    };

    // Copy all attributes
    for (let attr of element.attributes) {
      elementCopy.attributes[attr.name] = attr.value;
    }

    // Copy dataset
    Object.assign(elementCopy.dataset, element.dataset);

    const selector = this.getElementSelector(element);
    const hierarchy = this.getElementHierarchy(element);

    // Send to background script for safe execution
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'execute-custom-function',
        functionCode: functionCode,
        element: elementCopy,
        selector: selector,
        hierarchy: hierarchy
      });

      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      throw new Error(`Function execution failed: ${error.message}`);
    }
  }

  async copyCurrentSelector() {
    if (!this.currentElement) return;
    
    try {
      const result = await this.executeCopyFunction(this.customCopyFunction, this.currentElement);
      
      try {
        await navigator.clipboard.writeText(result);
        this.showToast('Custom result copied to clipboard!');
      } catch (clipboardError) {
        // Fallback to textarea method
        const textArea = document.createElement('textarea');
        textArea.value = result;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showToast('Custom result copied to clipboard!');
      }
    } catch (functionError) {
      // Fallback to default selector
      try {
        const selector = this.getElementSelector(this.currentElement);
        await navigator.clipboard.writeText(selector);
        this.showToast(`Function error, copied selector: ${functionError.message}`);
        console.error('Copy function error:', functionError);
      } catch (fallbackError) {
        this.showToast('Copy failed completely');
        console.error('Complete copy failure:', fallbackError);
      }
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'test-helper-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }
}

if (window.testCaseHelper) {
  window.testCaseHelper = null;
}

window.testCaseHelper = new TestCaseHelper();