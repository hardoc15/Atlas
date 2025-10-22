import * as vscode from 'vscode';
import * as Diff from 'diff';
import { SnapshotManager } from './snapshotManager';
import { Snapshot } from './types';

/**
 * DiffViewer shows side-by-side comparison between two snapshots
 * This is where you see what changed!
 */
export class DiffViewer {
    public static currentPanel: DiffViewer | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _snapshotManager: SnapshotManager;

    /**
     * Create or show the diff viewer
     */
    public static createOrShow(
        extensionUri: vscode.Uri,
        snapshotManager: SnapshotManager,
        oldSnapshotId: string,
        newSnapshotId: string
    ) {
        const column = vscode.ViewColumn.Two; // Open in second column

        // If we already have a panel, reuse it
        if (DiffViewer.currentPanel) {
            DiffViewer.currentPanel._panel.reveal(column);
            DiffViewer.currentPanel.showDiff(oldSnapshotId, newSnapshotId);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'atlasDiff',
            'Atlas Diff Viewer',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        DiffViewer.currentPanel = new DiffViewer(
            panel,
            extensionUri,
            snapshotManager,
            oldSnapshotId,
            newSnapshotId
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        snapshotManager: SnapshotManager,
        oldSnapshotId: string,
        newSnapshotId: string
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._snapshotManager = snapshotManager;

        // Show the initial diff
        this.showDiff(oldSnapshotId, newSnapshotId);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'showDiff':
                        await this.showDiff(message.oldSnapshotId, message.newSnapshotId);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Display diff between two snapshots
     */
    private async showDiff(oldSnapshotId: string, newSnapshotId: string) {
        const oldSnapshot = await this._snapshotManager.loadSnapshot(oldSnapshotId);
        const newSnapshot = await this._snapshotManager.loadSnapshot(newSnapshotId);

        if (!oldSnapshot || !newSnapshot) {
            vscode.window.showErrorMessage('Failed to load snapshots for comparison');
            return;
        }

        this._panel.title = `Diff: ${oldSnapshot.timestamp.toLocaleTimeString()} → ${newSnapshot.timestamp.toLocaleTimeString()}`;
        this._panel.webview.html = this._getHtmlForDiff(oldSnapshot, newSnapshot);
    }

    /**
     * Clean up resources
     */
    public dispose() {
        DiffViewer.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Generate diff HTML
     */
    private _getHtmlForDiff(oldSnapshot: Snapshot, newSnapshot: Snapshot) {
        // Find files that appear in both snapshots or only in one
        const allFilePaths = new Set<string>();
        oldSnapshot.files.forEach(f => allFilePaths.add(f.path));
        newSnapshot.files.forEach(f => allFilePaths.add(f.path));

        const diffs: Array<{
            path: string;
            oldContent: string | null;
            newContent: string | null;
            diffHtml: string;
        }> = [];

        for (const filePath of allFilePaths) {
            const oldFile = oldSnapshot.files.find(f => f.path === filePath);
            const newFile = newSnapshot.files.find(f => f.path === filePath);

            const oldContent = oldFile?.content || '';
            const newContent = newFile?.content || '';

            // Generate unified diff
            const diffResult = Diff.diffLines(oldContent, newContent);
            const diffHtml = this.generateDiffHtml(diffResult);

            diffs.push({
                path: filePath,
                oldContent: oldFile ? oldContent : null,
                newContent: newFile ? newContent : null,
                diffHtml: diffHtml
            });
        }

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Atlas Diff</title>
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

                .snapshot-info {
                    display: flex;
                    gap: 40px;
                    margin-bottom: 30px;
                    padding: 15px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                }

                .snapshot-box {
                    flex: 1;
                }

                .snapshot-label {
                    font-weight: bold;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 5px;
                }

                .snapshot-time {
                    font-size: 14px;
                }

                .file-diff {
                    margin-bottom: 30px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .file-header {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 10px 15px;
                    font-weight: bold;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .file-status {
                    display: inline-block;
                    margin-left: 10px;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: normal;
                }

                .status-added {
                    background-color: #28a745;
                    color: white;
                }

                .status-deleted {
                    background-color: #dc3545;
                    color: white;
                }

                .status-modified {
                    background-color: #ffc107;
                    color: black;
                }

                .diff-content {
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    line-height: 1.5;
                }

                .diff-line {
                    padding: 2px 10px;
                    white-space: pre;
                    font-family: monospace;
                }

                .diff-added {
                    background-color: rgba(40, 167, 69, 0.2);
                    color: #28a745;
                }

                .diff-added::before {
                    content: '+ ';
                    font-weight: bold;
                }

                .diff-removed {
                    background-color: rgba(220, 53, 69, 0.2);
                    color: #dc3545;
                }

                .diff-removed::before {
                    content: '- ';
                    font-weight: bold;
                }

                .diff-unchanged {
                    color: var(--vscode-editor-foreground);
                }

                .diff-unchanged::before {
                    content: '  ';
                }

                .no-changes {
                    padding: 20px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <h1>📊 Snapshot Comparison</h1>

            <div class="snapshot-info">
                <div class="snapshot-box">
                    <div class="snapshot-label">BEFORE</div>
                    <div class="snapshot-time">${oldSnapshot.timestamp.toLocaleString()}</div>
                    <div>${oldSnapshot.trigger}</div>
                </div>
                <div class="snapshot-box">
                    <div class="snapshot-label">AFTER</div>
                    <div class="snapshot-time">${newSnapshot.timestamp.toLocaleString()}</div>
                    <div>${newSnapshot.trigger}</div>
                </div>
            </div>

            ${diffs.map(diff => this.generateFileDiffHtml(diff)).join('')}
        </body>
        </html>`;
    }

    /**
     * Generate HTML for a single file's diff
     */
    private generateFileDiffHtml(diff: {
        path: string;
        oldContent: string | null;
        newContent: string | null;
        diffHtml: string;
    }): string {
        let status = 'modified';
        let statusLabel = 'MODIFIED';

        if (diff.oldContent === null) {
            status = 'added';
            statusLabel = 'ADDED';
        } else if (diff.newContent === null) {
            status = 'deleted';
            statusLabel = 'DELETED';
        } else if (diff.oldContent === diff.newContent) {
            return ''; // Skip unchanged files
        }

        return `
            <div class="file-diff">
                <div class="file-header">
                    📄 ${diff.path}
                    <span class="file-status status-${status}">${statusLabel}</span>
                </div>
                <div class="diff-content">
                    ${diff.diffHtml || '<div class="no-changes">No changes</div>'}
                </div>
            </div>
        `;
    }

    /**
     * Generate HTML for diff lines
     */
    private generateDiffHtml(diffResult: Diff.Change[]): string {
        return diffResult.map(part => {
            const lines = part.value.split('\n').filter(line => line !== '');

            if (part.added) {
                return lines.map(line =>
                    `<div class="diff-line diff-added">${this.escapeHtml(line)}</div>`
                ).join('');
            } else if (part.removed) {
                return lines.map(line =>
                    `<div class="diff-line diff-removed">${this.escapeHtml(line)}</div>`
                ).join('');
            } else {
                return lines.map(line =>
                    `<div class="diff-line diff-unchanged">${this.escapeHtml(line)}</div>`
                ).join('');
            }
        }).join('');
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}
