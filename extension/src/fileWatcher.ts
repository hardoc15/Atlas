import * as vscode from 'vscode';
import * as path from 'path';
import { SnapshotManager } from './snapshotManager';
import { SnapshotTrigger } from './types';

/**
 * FileWatcher monitors the workspace for file changes
 * This is the core component that detects when code changes happen
 */
export class FileWatcher {
    private watcher: vscode.FileSystemWatcher | undefined;
    private workspacePath: string;
    private filesChanged: number = 0;
    private lastChangeTime: string | undefined;
    private snapshotManager: SnapshotManager;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.snapshotManager = new SnapshotManager(workspacePath);
    }

    /**
     * Start watching files in the workspace
     */
    public start(): void {
        // Create a file watcher for all files except common excludes
        // The pattern ** means "any directory" and * means "any file"
        this.watcher = vscode.workspace.createFileSystemWatcher(
            '**/*',  // Watch all files
            false,   // Don't ignore creates
            false,   // Don't ignore changes
            false    // Don't ignore deletes
        );

        // Listen for file changes
        this.watcher.onDidChange((uri) => this.onFileChanged(uri, 'changed'));
        this.watcher.onDidCreate((uri) => this.onFileChanged(uri, 'created'));
        this.watcher.onDidDelete((uri) => this.onFileChanged(uri, 'deleted'));

        console.log(`Atlas FileWatcher started for: ${this.workspacePath}`);
    }

    /**
     * Stop watching files
     */
    public stop(): void {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }
        console.log('Atlas FileWatcher stopped.');
    }

    /**
     * Get statistics about file changes
     */
    public getStats() {
        return {
            filesChanged: this.filesChanged,
            lastChange: this.lastChangeTime
        };
    }

    /**
     * Called when a file is created, changed, or deleted
     */
    private onFileChanged(uri: vscode.Uri, eventType: 'created' | 'changed' | 'deleted'): void {
        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        const relativePath = path.relative(this.workspacePath, filePath);

        // Filter out files we don't want to track
        if (this.shouldIgnoreFile(relativePath)) {
            return;
        }

        // Update statistics
        this.filesChanged++;
        this.lastChangeTime = new Date().toLocaleTimeString();

        // Log the change
        console.log(`[Atlas] File ${eventType}: ${relativePath}`);

        // Show a subtle notification (this appears in the bottom right)
        // We'll make this less intrusive later, but for now it helps us see it's working
        vscode.window.setStatusBarMessage(
            `Atlas: ${fileName} ${eventType}`,
            3000 // Show for 3 seconds
        );

        // Create a snapshot! (Phase 2 feature)
        // Only create snapshots for file changes and creates (not deletes)
        if (eventType === 'changed' || eventType === 'created') {
            this.createSnapshotForFile(filePath, eventType);
        }
    }

    /**
     * Create a snapshot for a specific file
     */
    private async createSnapshotForFile(filePath: string, eventType: 'created' | 'changed' | 'deleted'): Promise<void> {
        // Map event type to snapshot trigger
        const trigger: SnapshotTrigger = eventType === 'created' ? 'file_create' : 'file_save';

        // Create the snapshot asynchronously
        const snapshot = await this.snapshotManager.createSnapshot(filePath, trigger);

        if (snapshot) {
            console.log(`[Atlas] Snapshot saved: ${snapshot.id}`);
        }
    }

    /**
     * Determine if a file should be ignored
     * We don't want to track node_modules, .git, build outputs, etc.
     */
    private shouldIgnoreFile(relativePath: string): boolean {
        const ignorePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'out',
            '.vscode',
            '.DS_Store',
            '.atlas',  // Our own snapshot folder (we'll create this in Phase 2)
            'package-lock.json',
            'yarn.lock'
        ];

        // Check if the path contains any of the ignore patterns
        return ignorePatterns.some(pattern => relativePath.includes(pattern));
    }
}
