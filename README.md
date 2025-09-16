# Test Case Helper Chrome Extension

A Chrome extension designed to assist developers in writing test cases by highlighting and extracting element selectors from web pages.

## Features

### Element Inspector
- **Toggle Inspector**: Use `⌥⌘I→E` to activate/deactivate the element inspector
- **Element Highlighting**: Hover over elements to see them highlighted with a blue outline
- **Real-time Popup**: Shows element information in a popup that follows your cursor

### Element Hierarchy Display
- **Parent-Current-Child Chain**: Shows the direct parent, current element, and direct child
- **Smart Child Display**: 
  - Shows text content for text-only children
  - Shows single child elements with their selectors
  - Skips children when there are multiple child elements
- **Element Information**: Displays tag name, selector, and text content for each element

### Selector Extraction
- **Customizable Selector Order**: Configure the priority order of selectors (data-cy, id, class, role, etc.)
- **Combined Selectors**: Support for combined selectors like `class + role`
- **Copy Functionality**: Copy selectors to clipboard with `⌥⌘I→C`

### Popup Management
- **Position Toggle**: Use `⌥⌘I→M` to switch between cursor-following and fixed position
- **Interactive Mode**: When fixed, you can interact with the popup controls
- **Settings Panel**: Configure selector preferences and popup behavior

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar

## Usage

### Basic Usage
1. Navigate to any webpage
2. Press `⌃⌘I→E` (Control+Command+I, then E) to activate the inspector
3. Hover over elements to see their information in the popup
4. Press `⌃⌘I→C` to copy the current element's selector
5. Press `⌃⌘I→E` again to deactivate

### Customization
1. Click the extension icon in the toolbar
2. Click "Settings" or press the gear icon in the popup
3. Customize selector order and popup behavior
4. Changes are saved automatically

### Keyboard Shortcuts
- `⌃⌘I→E`: Toggle element inspector on/off
- `⌃⌘I→M`: Toggle popup position (cursor-following vs fixed)
- `⌃⌘I→C`: Copy current element selector to clipboard

## Selector Priority

You can customize the order in which selectors are prioritized:

1. **data-cy**: Cypress data attributes (default first priority)
2. **id**: Element ID attributes
3. **class**: CSS class names
4. **role**: ARIA role attributes
5. **data-testid**: Test ID attributes
6. **name**: Form element names
7. **type**: Input type attributes

### Combined Selectors

You can create combined selectors by using the `+` operator:
- `class + role`: Combines class and role attributes
- `data-cy + type`: Combines data-cy and type attributes

## File Structure

- `manifest.json`: Extension configuration
- `content.js`: Main content script with inspector logic
- `content.css`: Styling for the inspector popup
- `popup.html`: Extension popup interface
- `popup.js`: Popup functionality
- `background.js`: Background script for keyboard shortcuts

## Development

The extension uses Chrome Extension Manifest V3. Key components:

- **Content Script**: Handles DOM inspection and user interaction
- **Background Script**: Manages keyboard shortcuts
- **Popup**: Provides status and settings interface
- **Storage**: Persists user preferences

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.