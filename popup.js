document.addEventListener('DOMContentLoaded', async function() {
  const toggleBtn = document.getElementById('toggle-inspector');
  const settingsBtn = document.getElementById('open-settings');
  const statusDiv = document.getElementById('status');
  
  let isInspectorActive = false;
  
  async function updateStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'get-status' });
      
      if (response && response.isActive) {
        isInspectorActive = true;
        statusDiv.textContent = 'Inspector is active';
        statusDiv.className = 'status active';
        toggleBtn.textContent = 'Deactivate Inspector';
      } else {
        isInspectorActive = false;
        statusDiv.textContent = 'Inspector is inactive';
        statusDiv.className = 'status inactive';
        toggleBtn.textContent = 'Activate Inspector';
      }
    } catch (error) {
      isInspectorActive = false;
      statusDiv.textContent = 'Inspector is inactive';
      statusDiv.className = 'status inactive';
      toggleBtn.textContent = 'Activate Inspector';
    }
  }
  
  toggleBtn.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'toggle-inspector' });
      
      setTimeout(() => {
        updateStatus();
      }, 100);
    } catch (error) {
      console.error('Could not toggle inspector:', error);
    }
  });
  
  settingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  await updateStatus();
  
  setInterval(updateStatus, 1000);
});