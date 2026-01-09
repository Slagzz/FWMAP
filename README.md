# FWMAP
**Visual firmware analysis tool for mapping and annotating filesystem structures**

FWMAP is a browser-based tool for visually mapping firmware filesystems during security research. Import an extracted firmware filesystem, classify components, add analysis notes, and export your annotated map for later use.




## Features

- **Import Filesystem** - Load any extracted firmware directory structure with all subdirectories and files
- **Dual View Modes**
  - **Tree View** - Traditional hierarchical view with collapsible folders
  - **Mind Map View** - Draggable node graph with pan/zoom for spatial analysis
- **Classification System** - Tag files and directories as:
  - 🔒 Read-Only
  - ✏️ Writable
  - ⚡ Executable
  - 🚀 Runs on Boot
  - ⚙️ Config
  - 📚 Library
  - 🧠 Kernel
  - ⚠️ Potential Vulnerability
  - ❓ Unknown
- **Search & Filter** - Find files by name or filter by classification type
- **Analysis Notes** - Add notes to any file or directory
- **Export/Import .FMAP** - Save your annotated maps and reload them later

## Screenshots

### Tree View
Hierarchical view with expandable folders and classification badges.
<img width="1116" height="754" alt="image" src="https://github.com/user-attachments/assets/188ff422-028c-451f-a9c1-1a852198e0d0" />

### Mind Map View
Draggable nodes with visual connections. Pan with click-drag, zoom with scroll wheel.
<img width="1120" height="672" alt="image" src="https://github.com/user-attachments/assets/a73d01ce-7bdd-4423-918f-068b51e1a783" />
## Installation

### Option 1: Use directly in browser

The component can run in any React environment or be used as an artifact in Claude.

### Option 2: Local development

```bash
# Clone the repo
git clone https://github.com/Slagzz/FWMAP.git
cd fwmap

# Create a new React project (if needed)
npx create-react-app fwmap-app
cd fwmap-app

# Copy App.js to src/App.js
# Then run:
npm start
```

### Option 3: Vite

```bash
npm create vite@latest fwmap -- --template react
cd fwmap
# Copy firmware-mapper.jsx content to src/App.jsx
npm install
npm run dev
```

## Usage

1. **Import a Firmware Filesystem**
   - Click "Import Filesystem" and select an extracted firmware root directory
   - The tool will load all directories and files into the map

2. **Classify Components**
   - Click any file/directory to select it
   - Use the right panel to assign a classification type
   - Add analysis notes as needed

3. **Navigate**
   - **Tree View**: Click arrows to expand/collapse folders
   - **Mind Map**: 
     - Drag background to pan
     - Scroll to zoom in/out
     - Drag nodes to reposition them
     - Use +/- buttons or Reset for zoom control

4. **Search & Filter**
   - Use the search box to find files by name
   - Use the type dropdown or click legend items to filter by classification

5. **Save Your Work**
   - Click "Export .FMAP" to save your annotated map
   - Click "Import .FMAP" to reload a saved map

## .FMAP File Format

The `.fmap` export is a JSON file containing:

```json
{
  "version": "1.0",
  "exportDate": "2024-01-15T10:30:00.000Z",
  "nodes": [...],
  "connections": [...],
  "nodePositions": {...},
  "expandedNodes": [...]
}
```

## Use Cases

- **Firmware Security Research** - Map attack surfaces, identify writable regions, track boot sequence
- **Embedded Systems Analysis** - Understand filesystem layout and component relationships
- **Vulnerability Documentation** - Annotate findings with notes and classifications
- **Team Collaboration** - Share .FMAP files with annotated analysis

## Tech Stack

- React 18+
- No external dependencies (vanilla CSS, no UI libraries)
- Client-side only (no backend required)

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## License

MIT License - feel free to use this for any purpose.

## Acknowledgments

Built for the firmware security research community.

---

**Note**: This tool is intended for legitimate security research on firmware you own or have permission to analyze.
