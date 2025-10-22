import * as fs from 'fs';
import * as path from 'path';
import { Snapshot, StoredSnapshot, FileSnapshot, SnapshotTrigger } from './types';

/**
 * SnapshotManager handles creating, saving, and loading snapshots
 * This is the core of our time-travel functionality
 */
export class SnapshotManager {
    private workspacePath: string;
    private atlasDir: string;
    private snapshotsDir: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.atlasDir = path.join(workspacePath, '.hindsight');
        this.snapshotsDir = path.join(this.atlasDir, 'snapshots');

        // Create the directories if they don't exist
        this.ensureDirectoriesExist();
    }

    /**
     * Create the .atlas folder structure if it doesn't exist
     */
    private ensureDirectoriesExist(): void {
        // fs.existsSync checks if a path exists
        // fs.mkdirSync creates a directory
        // { recursive: true } creates parent directories too (like mkdir -p)

        if (!fs.existsSync(this.atlasDir)) {
            fs.mkdirSync(this.atlasDir, { recursive: true });
            console.log(`[Hindsight] Created directory: ${this.atlasDir}`);
        }

        if (!fs.existsSync(this.snapshotsDir)) {
            fs.mkdirSync(this.snapshotsDir, { recursive: true });
            console.log(`[Hindsight] Created directory: ${this.snapshotsDir}`);
        }
    }

    /**
     * Create a snapshot of a single file
     */
    public async createSnapshot(
        filePath: string,
        trigger: SnapshotTrigger
    ): Promise<Snapshot | null> {
        try {
            // Read the file content
            const content = await fs.promises.readFile(filePath, 'utf8');

            // Get file stats (size, etc.)
            const stats = await fs.promises.stat(filePath);

            // Calculate relative path from workspace
            const relativePath = path.relative(this.workspacePath, filePath);

            // Create the file snapshot
            const fileSnapshot: FileSnapshot = {
                path: relativePath,
                content: content,
                size: stats.size
            };

            // Generate a unique ID using timestamp + random string
            const id = this.generateSnapshotId();

            // Create the full snapshot object
            const snapshot: Snapshot = {
                id: id,
                timestamp: new Date(),
                trigger: trigger,
                files: [fileSnapshot]
            };

            // Save to disk
            await this.saveSnapshot(snapshot);

            console.log(`[Hindsight] Created snapshot: ${id} for ${relativePath}`);
            return snapshot;

        } catch (error) {
            console.error(`[Hindsight] Error creating snapshot:`, error);
            return null;
        }
    }

    /**
     * Save a snapshot to disk as JSON
     */
    private async saveSnapshot(snapshot: Snapshot): Promise<void> {
        // Convert to storable format (Date → string)
        const storedSnapshot: StoredSnapshot = {
            id: snapshot.id,
            timestamp: snapshot.timestamp.toISOString(),
            trigger: snapshot.trigger,
            files: snapshot.files,
            gitCommit: snapshot.gitCommit
        };

        // Create filename: snapshot_20231021_143025_abc123.json
        const filename = `${snapshot.id}.json`;
        const filepath = path.join(this.snapshotsDir, filename);

        // Write to file with pretty printing (2 spaces indent)
        await fs.promises.writeFile(
            filepath,
            JSON.stringify(storedSnapshot, null, 2),
            'utf8'
        );
    }

    /**
     * Load a snapshot from disk by ID
     */
    public async loadSnapshot(id: string): Promise<Snapshot | null> {
        try {
            const filepath = path.join(this.snapshotsDir, `${id}.json`);
            const content = await fs.promises.readFile(filepath, 'utf8');
            const stored: StoredSnapshot = JSON.parse(content);

            // Convert back to Snapshot (string → Date)
            const snapshot: Snapshot = {
                id: stored.id,
                timestamp: new Date(stored.timestamp),
                trigger: stored.trigger,
                files: stored.files,
                gitCommit: stored.gitCommit
            };

            return snapshot;
        } catch (error) {
            console.error(`[Hindsight] Error loading snapshot ${id}:`, error);
            return null;
        }
    }

    /**
     * Get all snapshot IDs, sorted by timestamp (newest first)
     */
    public async getAllSnapshotIds(): Promise<string[]> {
        try {
            // Read all files in snapshots directory
            const files = await fs.promises.readdir(this.snapshotsDir);

            // Filter for .json files and remove the extension
            const snapshotIds = files
                .filter(f => f.endsWith('.json'))
                .map(f => f.replace('.json', ''));

            // Sort by ID (which includes timestamp) - newest first
            return snapshotIds.sort().reverse();
        } catch (error) {
            console.error(`[Hindsight] Error reading snapshots:`, error);
            return [];
        }
    }

    /**
     * Get all snapshots with full data
     */
    public async getAllSnapshots(): Promise<Snapshot[]> {
        const ids = await this.getAllSnapshotIds();
        const snapshots: Snapshot[] = [];

        for (const id of ids) {
            const snapshot = await this.loadSnapshot(id);
            if (snapshot) {
                snapshots.push(snapshot);
            }
        }

        return snapshots;
    }

    /**
     * Delete a snapshot by ID
     */
    public async deleteSnapshot(id: string): Promise<boolean> {
        try {
            const filepath = path.join(this.snapshotsDir, `${id}.json`);
            await fs.promises.unlink(filepath);
            console.log(`[Hindsight] Deleted snapshot: ${id}`);
            return true;
        } catch (error) {
            console.error(`[Hindsight] Error deleting snapshot ${id}:`, error);
            return false;
        }
    }

    /**
     * Get count of all snapshots
     */
    public async getSnapshotCount(): Promise<number> {
        const ids = await this.getAllSnapshotIds();
        return ids.length;
    }

    /**
     * Restore files from a snapshot
     * This writes the snapshot's file contents back to the workspace
     * IMPORTANT: Creates a backup snapshot before restoring!
     */
    public async restoreSnapshot(snapshotId: string): Promise<{ success: boolean; backupId?: string; error?: string }> {
        try {
            // Load the snapshot to restore
            const snapshot = await this.loadSnapshot(snapshotId);
            if (!snapshot) {
                return { success: false, error: 'Snapshot not found' };
            }

            // Create a backup of current state before restoring
            const backupId = await this.createBackupBeforeRestore();
            console.log(`[Hindsight] Created backup snapshot before restore: ${backupId}`);

            // Restore each file from the snapshot
            for (const file of snapshot.files) {
                const filePath = path.join(this.workspacePath, file.path);

                // Ensure the directory exists
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Write the file content
                await fs.promises.writeFile(filePath, file.content, 'utf8');
                console.log(`[Hindsight] Restored file: ${file.path}`);
            }

            console.log(`[Hindsight] Successfully restored snapshot: ${snapshotId}`);
            return { success: true, backupId: backupId };

        } catch (error) {
            console.error(`[Hindsight] Error restoring snapshot ${snapshotId}:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Create a backup snapshot of all files before restoring
     * This allows undoing a restore if something goes wrong
     */
    private async createBackupBeforeRestore(): Promise<string> {
        const backupId = `backup_${this.generateSnapshotId()}`;

        // Get all files in workspace (excluding ignored patterns)
        const allFiles = await this.getAllWorkspaceFiles();

        const fileSnapshots = [];
        for (const filePath of allFiles) {
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const stats = await fs.promises.stat(filePath);
                const relativePath = path.relative(this.workspacePath, filePath);

                fileSnapshots.push({
                    path: relativePath,
                    content: content,
                    size: stats.size
                });
            } catch (error) {
                // Skip files that can't be read
                console.warn(`[Hindsight] Could not backup file: ${filePath}`);
            }
        }

        const backupSnapshot: Snapshot = {
            id: backupId,
            timestamp: new Date(),
            trigger: 'manual', // Backup snapshots are manual
            files: fileSnapshots
        };

        await this.saveSnapshot(backupSnapshot);
        return backupId;
    }

    /**
     * Get all files in the workspace (recursively)
     * Excludes ignored patterns
     */
    private async getAllWorkspaceFiles(): Promise<string[]> {
        const files: string[] = [];
        const ignorePatterns = ['node_modules', '.git', 'dist', 'build', 'out', '.vscode', '.hindsight'];

        const walkDir = async (dir: string) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(this.workspacePath, fullPath);

                // Skip ignored patterns
                if (ignorePatterns.some(pattern => relativePath.includes(pattern))) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await walkDir(fullPath);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        };

        await walkDir(this.workspacePath);
        return files;
    }

    /**
     * Generate a unique snapshot ID
     * Format: snapshot_YYYYMMDD_HHMMSS_randomhex
     */
    private generateSnapshotId(): string {
        const now = new Date();

        // Format: 20231021
        const date = now.toISOString().slice(0, 10).replace(/-/g, '');

        // Format: 143025
        const time = now.toTimeString().slice(0, 8).replace(/:/g, '');

        // Random 6-character hex string
        const random = Math.random().toString(16).slice(2, 8);

        return `snapshot_${date}_${time}_${random}`;
    }
}
