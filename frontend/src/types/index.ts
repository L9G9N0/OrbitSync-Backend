export interface FileRecord {
  id: number;
  filename: string;
  tags: string | string[] | null;
  created_at: string;
  storage_key?: string;
}

export type UploadStatus = 'Uploading' | 'Uploaded' | 'Processing' | 'Tagged' | 'Failed';

export interface UploadQueueItem {
  id: string;
  filename: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
  tags?: string[];
  dbId?: number;
  created_at?: string;
}

export type ActivityType =
  | 'upload'
  | 'download'
  | 'share'
  | 'delete'
  | 'ai_tagging'
  | 'copy_url'
  | 'login'
  | 'logout';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
  created_at?: string;
}
