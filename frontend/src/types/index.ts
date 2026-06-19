export interface FileRecord {
  id: number;
  filename: string;
  tags: string | string[] | null;
  created_at: string;
}

export type UploadStatus = 'Uploading' | 'Uploaded' | 'Processing' | 'Tagged' | 'Failed';

export interface UploadQueueItem {
  id: string; // unique uuid/id for UI queue management
  filename: string;
  size: number;
  progress: number; // 0 to 100
  status: UploadStatus;
  error?: string;
  tags?: string[];
  dbId?: number; // DB row id when available
}

export interface ActivityLog {
  id: string;
  type: 'upload' | 'download' | 'share' | 'delete' | 'ai_tagging';
  message: string;
  timestamp: string;
}
