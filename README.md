# Atlas - Code Time Travel IDE

A VS Code extension that automatically saves code snapshots and enables time-travel debugging.

## Phase 1: Basic Extension & File Watcher ✅

### What We Built
- VS Code extension that monitors file changes in your workspace
- File watcher that detects creates, changes, and deletes
- Basic commands to start/stop watching and view status

### How to Test the Extension

1. **Open this project in VS Code** (you're probably already here!)

2. **Press F5** (or go to Run → Start Debugging)
   - This will open a new VS Code window titled **"Extension Development Host"**
   - Your Atlas extension will be running in that window

3. **In the Extension Development Host window:**
   - Open any folder/project
   - You should see a notification: "Atlas Time Travel is now watching your code!"

4. **Test file watching:**
   - Create or edit any file in the workspace
   - Look at the bottom status bar - you should see "Atlas: filename.ext changed" messages
   - Try these commands (Cmd+Shift+P or Ctrl+Shift+P):
     - **Atlas: Show Status** - See how many files have changed
     - **Atlas: Stop Watching** - Stop tracking changes
     - **Atlas: Start Watching** - Resume tracking

5. **View logs:**
   - In the Extension Development Host window, open the Output panel (View → Output)
   - Select "Extension Host" from the dropdown
   - You'll see console logs like `[Atlas] File changed: src/app.ts`

### Project Structure

```
Atlas/
├── extension/              # VS Code extension
│   ├── src/
│   │   ├── extension.ts    # Main entry point
│   │   └── fileWatcher.ts  # File watching logic
│   ├── out/                # Compiled JavaScript (generated)
│   ├── package.json        # Extension manifest
│   └── tsconfig.json       # TypeScript config
└── .vscode/
    ├── launch.json         # Debug configuration
    └── tasks.json          # Build tasks
```

### What It Does Right Now

- ✅ Detects when files are created, modified, or deleted
- ✅ Filters out irrelevant files (node_modules, .git, etc.)
- ✅ Shows notifications in status bar
- ✅ Logs all changes to console
- ✅ Tracks statistics (number of changes)

### What's Next (Phase 2)

- Save snapshots of file contents to disk
- Store snapshots in a `.atlas/` folder
- Add timestamps and metadata
- Create a simple snapshot viewer

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
- **VS Code Extension Structure**: package.json, activation events, commands
- **TypeScript Compilation**: .ts → .js with source maps
- **File System Watching**: VS Code's FileSystemWatcher API
- **Event Listeners**: onDidChange, onDidCreate, onDidDelete
- **VS Code APIs**: vscode.window, vscode.workspace, vscode.commands

### Files Explained
- **package.json**: Extension manifest (tells VS Code what your extension is)
- **tsconfig.json**: TypeScript compiler settings
- **extension.ts**: Main entry point with activate() and deactivate()
- **fileWatcher.ts**: Class that monitors file changes
- **.eslintrc.json**: Code quality rules
- **launch.json**: VS Code debugging configuration

---

**Phase 1 Complete!** 🎉

You now have a working VS Code extension that watches files. Next up: saving snapshots!
