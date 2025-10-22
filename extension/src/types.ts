/**
 * Type definitions for Atlas
 * This file defines the shape of our data structures
 */

/**
 * Represents a single file snapshot
 */
export interface FileSnapshot {
    /** Relative path from workspace root (e.g., "src/app.ts") */
    path: string;

    /** Full content of the file at the time of snapshot */
    content: string;

    /** File size in bytes */
    size: number;
}


export interface Snapshot {
    id: string;

    timestamp: Date;

    trigger: SnapshotTrigger;

    files: FileSnapshot[];

    gitCommit?: string;
}

export type SnapshotTrigger = 'file_save' | 'file_create' | 'file_delete' | 'manual' | 'auto';

export interface StoredSnapshot {
    id: string;
    timestamp: string;  // ISO string format
    trigger: SnapshotTrigger;
    files: FileSnapshot[];
    gitCommit?: string;
}
