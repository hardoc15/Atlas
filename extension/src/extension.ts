import * as vscode from 'vscode';
import { FileWatcher } from './fileWatcher';
import { SnapshotManager } from './snapshotManager';

let fileWatcher: FileWatcher | undefined;
let snapshotManager: SnapshotManager | undefined;

/**
 * This function is called when the extension is activated
 * VS Code will call this when the workspace opens (due to onStartupFinished activation event)
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Atlas extension is now active!');

    // Show a welcome message
    vscode.window.showInformationMessage('Atlas Time Travel is now watching your code!');

    // Register the "Start Watching" command
    const startCommand = vscode.commands.registerCommand('atlas.startWatching', () => {
        if (fileWatcher) {
            vscode.window.showWarningMessage('Atlas is already watching files!');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }

        fileWatcher = new FileWatcher(workspaceFolder.uri.fsPath);
        fileWatcher.start();
        vscode.window.showInformationMessage('Atlas started watching files!');
    });

    // Register the "Stop Watching" command
    const stopCommand = vscode.commands.registerCommand('atlas.stopWatching', () => {
        if (!fileWatcher) {
            vscode.window.showWarningMessage('Atlas is not currently watching files.');
            return;
        }

        fileWatcher.stop();
        fileWatcher = undefined;
        vscode.window.showInformationMessage('Atlas stopped watching files.');
    });

    // Register the "Show Status" command
    const statusCommand = vscode.commands.registerCommand('atlas.showStatus', () => {
        if (fileWatcher) {
            const stats = fileWatcher.getStats();
            vscode.window.showInformationMessage(
                `Atlas Status: Active | Files changed: ${stats.filesChanged} | Last change: ${stats.lastChange || 'None'}`
            );
        } else {
            vscode.window.showInformationMessage('Atlas Status: Inactive');
        }
    });

    // Register the "List Snapshots" command
    const listSnapshotsCommand = vscode.commands.registerCommand('atlas.listSnapshots', async () => {
        if (!snapshotManager) {
            vscode.window.showErrorMessage('Atlas is not initialized.');
            return;
        }

        const snapshots = await snapshotManager.getAllSnapshots();

        if (snapshots.length === 0) {
            vscode.window.showInformationMessage('No snapshots yet. Edit some files to create snapshots!');
            return;
        }

        // Create a quick pick menu to show all snapshots
        const items = snapshots.map(s => {
            const fileList = s.files.map(f => f.path).join(', ');
            return {
                label: `$(history) ${s.timestamp.toLocaleString()}`,
                description: `${s.trigger}`,
                detail: `Files: ${fileList}`,
                snapshot: s
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a snapshot to view details',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const s = selected.snapshot;
            const fileDetails = s.files.map(f => `  - ${f.path} (${f.size} bytes)`).join('\n');
            vscode.window.showInformationMessage(
                `Snapshot: ${s.id}\nTime: ${s.timestamp.toLocaleString()}\nTrigger: ${s.trigger}\nFiles:\n${fileDetails}`,
                { modal: true }
            );
        }
    });

    // Auto-start watching when extension activates
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        fileWatcher = new FileWatcher(workspaceFolder.uri.fsPath);
        snapshotManager = new SnapshotManager(workspaceFolder.uri.fsPath);
        fileWatcher.start();
    }

    // Add commands to subscriptions so they're disposed when extension deactivates
    context.subscriptions.push(startCommand, stopCommand, statusCommand, listSnapshotsCommand);
}

/**
 * This function is called when the extension is deactivated
 */
export function deactivate() {
    if (fileWatcher) {
        fileWatcher.stop();
    }
    console.log('Atlas extension has been deactivated.');
}
