import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { UploadQueueItem, ActivityLog, ActivityType } from '../types';
import { uploadFileWithProgress, fetchFiles, parseTags } from '../services/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface UploadContextType {
  uploadQueue: UploadQueueItem[];
  activityLogs: ActivityLog[];
  uploadFiles: (files: FileList | File[]) => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  clearQueue: () => void;
  logActivity: (type: ActivityType, message: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within an UploadProvider');
  return context;
};

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const queryClient = useQueryClient();
  const activeUploads = useRef<{ [queueId: string]: () => void }>({});

  const logActivity = (type: ActivityType, message: string) => {
    const newLog: ActivityLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 150));
  };

  const cancelUpload = (id: string) => {
    if (activeUploads.current[id]) {
      activeUploads.current[id]();
      delete activeUploads.current[id];
    }
    const item = uploadQueue.find(i => i.id === id);
    setUploadQueue(prev =>
      prev.map(item => item.id === id ? { ...item, status: 'Failed' as const, error: 'Cancelled' } : item)
    );
    if (item) logActivity('upload', `Cancelled: ${item.filename}`);
  };

  const executeUpload = async (queueItem: UploadQueueItem, file: File) => {
    try {
      setUploadQueue(prev =>
        prev.map(item => item.id === queueItem.id ? { ...item, status: 'Uploading', progress: 0, error: undefined } : item)
      );
      logActivity('upload', `Uploading ${file.name}…`);

      const { promise, abort } = uploadFileWithProgress(file, (progress) => {
        setUploadQueue(prev =>
          prev.map(item => item.id === queueItem.id ? { ...item, progress } : item)
        );
      });

      activeUploads.current[queueItem.id] = abort;
      const result = await promise;
      delete activeUploads.current[queueItem.id];

      // Check if backend returned an error in the body (upload succeeds HTTP but body has error key)
      if (result?.error) {
        throw new Error(result.error);
      }

      setUploadQueue(prev =>
        prev.map(item => item.id === queueItem.id ? { ...item, status: 'Processing', progress: 100 } : item)
      );
      logActivity('upload', `Uploaded ${file.name} — AI profiling started`);
      queryClient.invalidateQueries({ queryKey: ['files'] });

    } catch (err: any) {
      delete activeUploads.current[queueItem.id];
      const errMsg = err.message || 'Upload failed';
      setUploadQueue(prev =>
        prev.map(item => item.id === queueItem.id ? { ...item, status: 'Failed', error: errMsg } : item)
      );
      toast.error(`Failed: ${file.name} — ${errMsg}`);
      logActivity('upload', `Failed: ${file.name} — ${errMsg}`);
    }
  };

  const uploadFiles = (files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      const queueItem: UploadQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        filename: file.name,
        size: file.size,
        progress: 0,
        status: 'Uploading',
        created_at: new Date().toISOString(),
      };
      setUploadQueue(prev => [queueItem, ...prev]);
      executeUpload(queueItem, file);
    });
  };

  const retryUpload = (id: string) => {
    const item = uploadQueue.find(i => i.id === id);
    if (item) toast.info(`Re-drag '${item.filename}' to retry.`);
  };

  const clearQueue = () => {
    setUploadQueue(prev => prev.filter(item => item.status === 'Uploading' || item.status === 'Processing'));
  };

  // AI Tag polling — runs while items are in Processing state
  useEffect(() => {
    const processingItems = uploadQueue.filter(item => item.status === 'Processing');
    if (processingItems.length === 0) return;

    let mounted = true;

    const poll = async () => {
      try {
        const latestFiles = await fetchFiles();
        if (!mounted) return;

        let changed = false;
        const updated = uploadQueue.map(qi => {
          if (qi.status !== 'Processing') return qi;
          const match = latestFiles.find(f => f.filename === qi.filename && f.tags !== null);
          if (!match) return qi;

          changed = true;
          const parsed = parseTags(match.tags);
          toast.success(`AI tagged: ${qi.filename}`, {
            description: parsed.slice(0, 3).join(', '),
            duration: 5000,
          });
          logActivity('ai_tagging', `AI tagged '${qi.filename}': ${parsed.join(', ')}`);
          return { ...qi, status: 'Tagged' as const, tags: parsed, dbId: match.id };
        });

        if (changed) {
          setUploadQueue(updated);
          queryClient.invalidateQueries({ queryKey: ['files'] });
        }
      } catch {
        // silent — network blip during poll
      }
    };

    const interval = setInterval(poll, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [uploadQueue, queryClient]);

  return (
    <UploadContext.Provider value={{ uploadQueue, activityLogs, uploadFiles, cancelUpload, retryUpload, clearQueue, logActivity }}>
      {children}
    </UploadContext.Provider>
  );
};
