import * as vscode from 'vscode';
import { SnapshotManager } from './snapshotManager';
import { Snapshot } from './types';
import { DiffViewer } from './diffViewer';

/**
 * TimelinePanel manages the webview that displays snapshot history
 * This is our time travel UI!
 */
export class TimelinePanel {
    public static currentPanel: TimelinePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _snapshotManager: SnapshotManager;

    /**
     * Create or show the timeline panel
     */
    public static createOrShow(extensionUri: vscode.Uri, snapshotManager: SnapshotManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (TimelinePanel.currentPanel) {
            TimelinePanel.currentPanel._panel.reveal(column);
            TimelinePanel.currentPanel.refresh();
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'hindsightTimeline',
            'Hindsight Time Travel',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        TimelinePanel.currentPanel = new TimelinePanel(panel, extensionUri, snapshotManager);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        snapshotManager: SnapshotManager
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._snapshotManager = snapshotManager;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed (user closes it)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'viewSnapshot':
                        await this.viewSnapshot(message.snapshotId);
                        return;
                    case 'refresh':
                        this.refresh();
                        return;
                    case 'compareDiff':
                        await this.compareDiff(message.oldSnapshotId, message.newSnapshotId);
                        return;
                    case 'restoreSnapshot':
                        await this.restoreSnapshot(message.snapshotId);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Refresh the timeline with latest snapshots
     */
    public async refresh() {
        await this._update();
    }

    /**
     * View details of a specific snapshot
     */
    private async viewSnapshot(snapshotId: string) {
        const snapshot = await this._snapshotManager.loadSnapshot(snapshotId);

        if (!snapshot) {
            vscode.window.showErrorMessage(`Snapshot ${snapshotId} not found`);
            return;
        }

        // Send snapshot data back to webview
        this._panel.webview.postMessage({
            command: 'showSnapshot',
            snapshot: this.serializeSnapshot(snapshot)
        });
    }

    /**
     * Compare two snapshots in diff viewer
     */
    private async compareDiff(oldSnapshotId: string, newSnapshotId: string) {
        DiffViewer.createOrShow(
            this._extensionUri,
            this._snapshotManager,
            oldSnapshotId,
            newSnapshotId
        );
    }

    /**
     * Restore code to a previous snapshot
     */
    private async restoreSnapshot(snapshotId: string) {
        const snapshot = await this._snapshotManager.loadSnapshot(snapshotId);
        if (!snapshot) {
            vscode.window.showErrorMessage('Snapshot not found');
            return;
        }

        // Ask for confirmation
        const fileList = snapshot.files.map(f => f.path).join(', ');
        const message = `Restore to snapshot from ${snapshot.timestamp.toLocaleString()}?\n\nFiles: ${fileList}\n\nA backup will be created automatically.`;

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Restore',
            'Cancel'
        );

        if (choice !== 'Restore') {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Restoring snapshot...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Creating backup...' });

            const result = await this._snapshotManager.restoreSnapshot(snapshotId);

            if (result.success) {
                vscode.window.showInformationMessage(
                    `✅ Successfully restored to ${snapshot.timestamp.toLocaleString()}. Backup saved: ${result.backupId}`
                );
                // Refresh the timeline
                this.refresh();
            } else {
                vscode.window.showErrorMessage(
                    `❌ Failed to restore snapshot: ${result.error}`
                );
            }
        });
    }

    /**
     * Update the webview content
     */
    private async _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Hindsight Time Travel';

        const snapshots = await this._snapshotManager.getAllSnapshots();
        this._panel.webview.html = this._getHtmlForWebview(webview, snapshots);
    }

    /**
     * Clean up resources
     */
    public dispose() {
        TimelinePanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Convert Snapshot to JSON-safe format
     */
    private serializeSnapshot(snapshot: Snapshot): any {
        return {
            id: snapshot.id,
            timestamp: snapshot.timestamp.toISOString(),
            trigger: snapshot.trigger,
            files: snapshot.files,
            gitCommit: snapshot.gitCommit
        };
    }

    /**
     * Generate the HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview, snapshots: Snapshot[]) {
        const snapshotsJson = JSON.stringify(
            snapshots.map(s => this.serializeSnapshot(s))
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Atlas Time Travel</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                }

                h1 {
                    font-size: 24px;
                    margin-bottom: 20px;
                    color: var(--vscode-foreground);
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .header-buttons {
                    display: flex;
                    gap: 10px;
                }

                .btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    cursor: pointer;
                    border-radius: 2px;
                }

                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }

                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .btn-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .compare-badge {
                    display: inline-block;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    margin-left: 10px;
                }

                .snapshot-card.compare-selected {
                    border: 2px solid var(--vscode-focusBorder);
                }

                .timeline {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .snapshot-card {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .snapshot-card:hover {
                    background-color: var(--vscode-list-hoverBackground);
                    border-color: var(--vscode-focusBorder);
                }

                .snapshot-card.selected {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    border-color: var(--vscode-focusBorder);
                }

                .snapshot-time {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .snapshot-trigger {
                    display: inline-block;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    margin-bottom: 8px;
                }

                .snapshot-files {
                    font-size: 13px;
                    color: var(--vscode-descriptionForeground);
                }

                .snapshot-id {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 5px;
                    font-family: monospace;
                }

                .snapshot-detail {
                    margin-top: 20px;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    display: none;
                }

                .snapshot-detail.visible {
                    display: block;
                }

                .detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .detail-header h2 {
                    margin: 0;
                }

                .restore-btn {
                    background-color: #007acc;
                    color: white;
                    font-weight: bold;
                }

                .restore-btn:hover {
                    background-color: #005a9e;
                }

                .file-content {
                    margin-top: 15px;
                }

                .file-header {
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 10px;
                }

                .code-block {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    white-space: pre;
                    line-height: 1.5;
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--vscode-descriptionForeground);
                }

                .empty-state h2 {
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 id="header-title">🔍 Hindsight Time Travel</h1>
                <div class="header-buttons">
                    <button class="btn btn-secondary" id="compare-btn" onclick="toggleCompareMode()">Compare Mode</button>
                    <button class="btn" onclick="refresh()">Refresh</button>
                </div>
            </div>

            <div id="timeline" class="timeline"></div>
            <div id="snapshot-detail" class="snapshot-detail"></div>

            <script>
                const vscode = acquireVsCodeApi();
                let snapshots = ${snapshotsJson};
                let selectedSnapshotId = null;
                let compareMode = false;
                let compareSnapshots = { old: null, new: null };

                function renderTimeline() {
                    const timeline = document.getElementById('timeline');

                    if (snapshots.length === 0) {
                        timeline.innerHTML = \`
                            <div class="empty-state">
                                <h2>No snapshots yet</h2>
                                <p>Edit or create files to start capturing snapshots!</p>
                            </div>
                        \`;
                        return;
                    }

                    timeline.innerHTML = snapshots.map(snapshot => {
                        const date = new Date(snapshot.timestamp);
                        const timeStr = date.toLocaleString();
                        const fileList = snapshot.files.map(f => f.path).join(', ');
                        const isSelected = snapshot.id === selectedSnapshotId ? 'selected' : '';
                        const isCompareOld = compareMode && compareSnapshots.old === snapshot.id ? 'compare-selected' : '';
                        const isCompareNew = compareMode && compareSnapshots.new === snapshot.id ? 'compare-selected' : '';
                        const compareLabel = compareMode && compareSnapshots.old === snapshot.id ? 'OLD' :
                                            compareMode && compareSnapshots.new === snapshot.id ? 'NEW' : '';

                        return \`
                            <div class="snapshot-card \${isSelected} \${isCompareOld} \${isCompareNew}" onclick="selectSnapshot('\${snapshot.id}')">
                                <div class="snapshot-time">\${timeStr}
                                    \${compareLabel ? \`<span class="compare-badge">\${compareLabel}</span>\` : ''}
                                </div>
                                <span class="snapshot-trigger">\${snapshot.trigger}</span>
                                <div class="snapshot-files">Files: \${fileList}</div>
                                <div class="snapshot-id">\${snapshot.id}</div>
                            </div>
                        \`;
                    }).join('');
                }

                function toggleCompareMode() {
                    compareMode = !compareMode;
                    const btn = document.getElementById('compare-btn');
                    const title = document.getElementById('header-title');

                    if (compareMode) {
                        btn.textContent = 'Exit Compare Mode';
                        btn.classList.remove('btn-secondary');
                        btn.classList.add('btn');
                        title.textContent = '📊 Compare Snapshots - Select OLD then NEW';
                        compareSnapshots = { old: null, new: null };
                        document.getElementById('snapshot-detail').classList.remove('visible');
                    } else {
                        btn.textContent = 'Compare Mode';
                        btn.classList.remove('btn');
                        btn.classList.add('btn-secondary');
                        title.textContent = '🔍 Hindsight Time Travel';
                        compareSnapshots = { old: null, new: null };
                    }
                    renderTimeline();
                }

                function selectSnapshot(snapshotId) {
                    if (compareMode) {
                        // In compare mode, select old then new
                        if (!compareSnapshots.old) {
                            compareSnapshots.old = snapshotId;
                        } else if (!compareSnapshots.new) {
                            compareSnapshots.new = snapshotId;
                            // Both selected, show diff
                            vscode.postMessage({
                                command: 'compareDiff',
                                oldSnapshotId: compareSnapshots.old,
                                newSnapshotId: compareSnapshots.new
                            });
                            // Reset selections
                            compareSnapshots = { old: null, new: null };
                        } else {
                            // Reset if both already selected
                            compareSnapshots = { old: snapshotId, new: null };
                        }
                    } else {
                        // Normal mode - view snapshot
                        selectedSnapshotId = snapshotId;
                        vscode.postMessage({ command: 'viewSnapshot', snapshotId: snapshotId });
                    }
                    renderTimeline();
                }

                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.command) {
                        case 'showSnapshot':
                            displaySnapshot(message.snapshot);
                            break;
                    }
                });

                function displaySnapshot(snapshot) {
                    const detailDiv = document.getElementById('snapshot-detail');

                    const filesHtml = snapshot.files.map(file => \`
                        <div class="file-content">
                            <div class="file-header">📄 \${file.path} (\${file.size} bytes)</div>
                            <div class="code-block">\${escapeHtml(file.content)}</div>
                        </div>
                    \`).join('');

                    detailDiv.innerHTML = \`
                        <div class="detail-header">
                            <h2>Snapshot Details</h2>
                            <button class="btn restore-btn" onclick="restoreSnapshot('\${snapshot.id}')">
                                ⏮️ Restore to this Point
                            </button>
                        </div>
                        <p><strong>Time:</strong> \${new Date(snapshot.timestamp).toLocaleString()}</p>
                        <p><strong>Trigger:</strong> \${snapshot.trigger}</p>
                        <p><strong>ID:</strong> \${snapshot.id}</p>
                        \${filesHtml}
                    \`;

                    detailDiv.classList.add('visible');
                }

                function restoreSnapshot(snapshotId) {
                    vscode.postMessage({ command: 'restoreSnapshot', snapshotId: snapshotId });
                }

                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                // Initial render
                renderTimeline();
            </script>
        </body>
        </html>`;
    }
}
