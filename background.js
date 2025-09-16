console.log('Test Case Helper background script loaded');

chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.log('No active tab found');
      return;
    }
    
    switch (command) {
      case 'toggle-inspector':
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle-inspector' });
        break;
      case 'toggle-popup-mode':
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle-popup-mode' });
        break;
      case 'copy-selector':
        await chrome.tabs.sendMessage(tab.id, { action: 'copy-selector' });
        break;
      case 'toggle-lock':
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle-lock' });
        break;
    }
  } catch (error) {
    console.error('Could not send message to content script:', error);
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'execute-custom-function') {
    try {
      const result = executeCustomFunction(request.functionCode, request.element, request.selector, request.hierarchy);
      sendResponse({ success: true, result: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }
});

function executeCustomFunction(templateConfig, element, selector, hierarchy) {
  try {
    // Use predefined templates instead of eval
    const templates = {
      'selector': () => selector,
      
      'cypress': (options = {}) => {
        const cmd = options.command || 'get';
        const assertion = options.assertion ? `.should('${options.assertion}', '${options.expectedValue || element.textContent?.trim() || ''}')` : '';
        return `cy.${cmd}('${selector}')${assertion}`;
      },
      
      'playwright': (options = {}) => {
        const method = options.method || 'locator';
        const action = options.action ? `.${options.action}()` : '';
        if (options.role && element.textContent?.trim()) {
          return `await page.getByRole('${options.role}', { name: '${element.textContent.trim()}' })${action}`;
        }
        return `await page.${method}('${selector}')${action}`;
      },
      
      'selenium': (options = {}) => {
        const method = options.method || 'cssSelector';
        return `driver.findElement(By.${method}('${selector}'))`;
      },
      
      'testcafe': (options = {}) => {
        return `Selector('${selector}')`;
      },
      
      'element-info': (options = {}) => {
        const parts = [];
        if (options.includeTag !== false) parts.push(element.tagName);
        if (options.includeText !== false && element.textContent?.trim()) {
          parts.push(`"${element.textContent.trim()}"`);
        }
        if (options.includeId && element.id) parts.push(`#${element.id}`);
        if (options.includeClass && element.className) parts.push(`.${element.className.split(' ').join('.')}`);
        return parts.join(' - ') || selector;
      },
      
      'data-attribute': (options = {}) => {
        const attr = options.attribute || 'data-cy';
        const value = element.attributes[attr];
        if (value) {
          return `[${attr}="${value}"]`;
        }
        return selector;
      },
      
      'custom-format': (options = {}) => {
        let result = options.template || '${selector}';
        
        // Simple template replacement without regex complexity
        result = result.split('${selector}').join(selector);
        result = result.split('${element.tagName}').join(element.tagName);
        result = result.split('${element.textContent}').join(element.textContent || '');
        result = result.split('${element.id}').join(element.id || '');
        result = result.split('${element.className}').join(element.className || '');
        
        // Handle common attributes
        if (element.attributes['data-cy']) {
          result = result.split('${element.dataCy}').join(element.attributes['data-cy']);
        }
        if (element.attributes['role']) {
          result = result.split('${element.role}').join(element.attributes['role']);
        }
        
        return result;
      }
    };
    
    // Parse the template configuration
    let config;
    try {
      config = JSON.parse(templateConfig);
    } catch (e) {
      // If it's not JSON, treat as simple template type
      config = { type: templateConfig || 'selector' };
    }
    
    const templateFn = templates[config.type] || templates['selector'];
    const result = templateFn(config.options || {});
    
    return String(result || selector);
    
  } catch (error) {
    console.error('Template execution error:', error);
    return selector;
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  chrome.storage.sync.set({
    selectorOrder: ['data-cy', 'id', 'class'],
    isPopupFixed: false
  });
});