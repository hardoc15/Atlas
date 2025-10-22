# Hindsight - Code Time Travel IDE

A VS Code extension that automatically saves code snapshots and enables time-travel debugging with 20/20 hindsight.

## Current Status: Phase 4 Complete ✅

- ✅ Phase 1: File Watching
- ✅ Phase 2: Snapshot System
- ✅ Phase 3: Time Travel UI
- ✅ Phase 4: Visual Diff Viewer

## Phase 1: Basic Extension & File Watcher ✅

### What We Built
- VS Code extension that monitors file changes in your workspace
- File watcher that detects creates, changes, and deletes
- Basic commands to start/stop watching and view status

### How to Test the Extension

1. **Open this project in VS Code** (you're probably already here!)

2. **Press F5** (or go to Run → Start Debugging)
   - This will open a new VS Code window titled **"Extension Development Host"**
   - Your Hindsight extension will be running in that window

3. **In the Extension Development Host window:**
   - Open any folder/project
   - You should see a notification: "Hindsight is now watching your code!"

4. **Test file watching:**
   - Create or edit any file in the workspace
   - Look at the bottom status bar - you should see "Hindsight: filename.ext changed" messages
   - Try these commands (Cmd+Shift+P or Ctrl+Shift+P):
     - **Hindsight: Show Status** - See how many files have changed
     - **Hindsight: Stop Watching** - Stop tracking changes
     - **Hindsight: Start Watching** - Resume tracking

5. **View logs:**
   - In the Extension Development Host window, open the Debug Console
   - You'll see console logs like `[Hindsight] File changed: src/app.ts`

### Project Structure

```
Hindsight/
├── extension/              # VS Code extension
│   ├── src/
│   │   ├── extension.ts        # Main entry point
│   │   ├── fileWatcher.ts      # File watching logic
│   │   ├── snapshotManager.ts  # Snapshot creation/storage
│   │   ├── timelinePanel.ts    # Time travel UI webview
│   │   ├── diffViewer.ts       # Diff comparison webview
│   │   └── types.ts            # TypeScript type definitions
│   ├── out/                    # Compiled JavaScript (generated)
│   ├── package.json            # Extension manifest
│   └── tsconfig.json           # TypeScript config
├── .vscode/
│   ├── launch.json             # Debug configuration
│   └── tasks.json              # Build tasks
└── .hindsight/                 # Snapshot storage (created in workspace)
    └── snapshots/              # Individual snapshot JSON files
```

### What It Does Right Now

- ✅ Detects when files are created, modified, or deleted
- ✅ Filters out irrelevant files (node_modules, .git, etc.)
- ✅ Shows notifications in status bar
- ✅ Logs all changes to console
- ✅ Tracks statistics (number of changes)

## Phase 2: Snapshot System ✅

### What We Built
- `.hindsight/` folder structure for storing snapshots
- SnapshotManager class for creating/saving/loading snapshots
- Automatic snapshot creation on file save/create
- JSON-based storage with timestamps and metadata
- "List Snapshots" command to browse history

### Features Added
- ✅ Snapshot creation with unique IDs
- ✅ File content capture with metadata
- ✅ Persistent storage in JSON format
- ✅ Quick Pick UI for browsing snapshots

## Phase 3: Time Travel UI ✅

### What We Built
- Interactive webview panel for visualizing snapshot timeline
- Beautiful UI with VS Code theme integration
- Click snapshots to view file contents
- Real-time message passing between extension and UI
- Refresh functionality to update timeline

### How to Use
1. **Open the Time Travel Panel:**
   - Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
   - Type "Hindsight: Open Time Travel"
   - A new panel will open showing your snapshot timeline

2. **Browse Snapshots:**
   - See all snapshots in chronological order (newest first)
   - Each card shows: timestamp, trigger type, and files changed

3. **View Snapshot Details:**
   - Click any snapshot card
   - View the complete file content at that point in time
   - See file sizes and metadata

### Features Added
- ✅ Custom webview panel with HTML/CSS/JavaScript
- ✅ Timeline visualization with snapshot cards
- ✅ Click to view snapshot details
- ✅ Display file contents in code blocks
- ✅ VS Code theme integration (dark/light mode support)
- ✅ Refresh button to update timeline

## Phase 4: Visual Diff Viewer ✅

### What We Built
- Side-by-side diff comparison between any two snapshots
- Visual highlighting for added/removed/unchanged lines
- Compare mode in timeline panel
- Separate diff viewer webview panel
- Uses the `diff` library for intelligent line-by-line comparison

### How to Use
1. **Open Timeline Panel:**
   - Run "Hindsight: Open Time Travel" command

2. **Enter Compare Mode:**
   - Click "Compare Mode" button in the timeline
   - Title changes to "Compare Snapshots - Select OLD then NEW"

3. **Select Snapshots to Compare:**
   - Click first snapshot (marked as "OLD")
   - Click second snapshot (marked as "NEW")
   - Diff viewer opens automatically in a new panel

4. **View the Diff:**
   - Green lines = Added content
   - Red lines = Removed content
   - White/gray lines = Unchanged content
   - Files shown with status badges (ADDED, DELETED, MODIFIED)

### Features Added
- ✅ Diff algorithm integration (using `diff` npm package)
- ✅ Line-by-line comparison with color coding
- ✅ Compare mode toggle in timeline
- ✅ Two-step selection (OLD → NEW)
- ✅ Separate diff viewer panel
- ✅ File status indicators (added/deleted/modified)
- ✅ Unchanged files are filtered out
- ✅ HTML escaping for safe code display
- ✅ Before/After snapshot metadata display

## Development Commands

```bash
# Install dependencies
cd extension && npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run extension
Press F5 in VS Code
```

## Learning Notes

### Key Concepts Learned

**Phase 1:**
- VS Code Extension Structure: package.json, activation events, commands
- TypeScript Compilation: .ts → .js with source maps
- File System Watching: VS Code's FileSystemWatcher API
- Event Listeners: onDidChange, onDidCreate, onDidDelete

**Phase 2:**
- File I/O Operations: fs.promises.readFile, writeFile, readdir
- Async/Await: Asynchronous programming in TypeScript
- JSON Storage: Serialization and deserialization
- Date Handling: ISO strings, timestamp generation

**Phase 3:**
- VS Code Webview API: Custom UI panels
- HTML/CSS in extensions: Building interfaces
- Message Passing: Extension ↔ Webview communication
- Event Handling: User interactions in webviews

**Phase 4:**
- Diff Algorithms: Line-by-line text comparison
- NPM Package Integration: Using external libraries
- Multi-panel Coordination: Managing multiple webviews
- State Management: Toggle modes and selections
- Visual Feedback: Color-coded diffs and status badges

### Available Commands
- **Hindsight: Start Watching Files** - Begin file monitoring
- **Hindsight: Stop Watching Files** - Stop file monitoring
- **Hindsight: Show Status** - View statistics
- **Hindsight: List Snapshots** - Quick Pick menu of snapshots
- **Hindsight: Open Time Travel** - Open the timeline UI panel

### Files Explained
- **extension.ts**: Main entry point, command registration
- **fileWatcher.ts**: File change detection and snapshot triggering
- **snapshotManager.ts**: Snapshot creation, storage, and retrieval
- **timelinePanel.ts**: Webview panel for time travel UI with compare mode
- **diffViewer.ts**: Diff comparison webview panel
- **types.ts**: TypeScript interfaces and type definitions

### Dependencies
- **diff**: Text diffing library for line-by-line comparison
- **@types/diff**: TypeScript type definitions for diff

---

**Phase 1-4 Complete!** 🎉

You now have Hindsight - a functional time-travel IDE with visual snapshot browsing and diff comparison!
