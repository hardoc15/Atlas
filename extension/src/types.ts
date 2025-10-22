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

/**
 * Represents a complete snapshot (one or more files at a point in time)
 */
export interface Snapshot {
    /** Unique identifier for this snapshot */
    id: string;

    /** When this snapshot was created */
    timestamp: Date;

    /** What triggered this snapshot (e.g., "file_save", "manual", "auto") */
    trigger: SnapshotTrigger;

    /** Files included in this snapshot */
    files: FileSnapshot[];

    /** Git commit hash if available */
    gitCommit?: string;
}

/**
 * Types of events that can trigger a snapshot
 */
export type SnapshotTrigger = 'file_save' | 'file_create' | 'file_delete' | 'manual' | 'auto';

/**
 * Stored snapshot metadata (what we save to disk)
 * This is a simplified version for JSON storage
 */
export interface StoredSnapshot {
    id: string;
    timestamp: string;  // ISO string format
    trigger: SnapshotTrigger;
    files: FileSnapshot[];
    gitCommit?: string;
}
