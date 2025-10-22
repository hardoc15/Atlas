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
        this.atlasDir = path.join(workspacePath, '.atlas');
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
            console.log(`[Atlas] Created directory: ${this.atlasDir}`);
        }

        if (!fs.existsSync(this.snapshotsDir)) {
            fs.mkdirSync(this.snapshotsDir, { recursive: true });
            console.log(`[Atlas] Created directory: ${this.snapshotsDir}`);
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

            console.log(`[Atlas] Created snapshot: ${id} for ${relativePath}`);
            return snapshot;

        } catch (error) {
            console.error(`[Atlas] Error creating snapshot:`, error);
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
            console.error(`[Atlas] Error loading snapshot ${id}:`, error);
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
            console.error(`[Atlas] Error reading snapshots:`, error);
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
            console.log(`[Atlas] Deleted snapshot: ${id}`);
            return true;
        } catch (error) {
            console.error(`[Atlas] Error deleting snapshot ${id}:`, error);
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
