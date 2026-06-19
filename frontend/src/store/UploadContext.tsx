import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { UploadQueueItem, ActivityLog } from '../types';
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
  logActivity: (type: ActivityLog['type'], message: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within an UploadProvider');
  return context;
};

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const queryClient = useQueryClient();
  
  // Keep track of ongoing XHR abort functions
  const activeUploads = useRef<{ [queueId: string]: () => void }>({});

  const logActivity = (type: ActivityLog['type'], message: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substring(7),
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setActivityLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const cancelUpload = (id: string) => {
    if (activeUploads.current[id]) {
      activeUploads.current[id]();
      delete activeUploads.current[id];
    }
    setUploadQueue(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: 'Failed' as const, error: 'Upload cancelled by user' } : item
      )
    );
    logActivity('upload', `Cancelled uploading ${uploadQueue.find(i => i.id === id)?.filename}`);
  };

  const executeUpload = async (queueItem: UploadQueueItem, file: File) => {
    try {
      setUploadQueue(prev =>
        prev.map(item => (item.id === queueItem.id ? { ...item, status: 'Uploading', progress: 0, error: undefined } : item))
      );
      logActivity('upload', `Starting upload for ${file.name}`);

      const { promise, abort } = uploadFileWithProgress(file, (progress) => {
        setUploadQueue(prev =>
          prev.map(item => (item.id === queueItem.id ? { ...item, progress } : item))
        );
      });

      activeUploads.current[queueItem.id] = abort;

      await promise;
      delete activeUploads.current[queueItem.id];

      // File is uploaded to R2, now waiting for background AI processing
      setUploadQueue(prev =>
        prev.map(item =>
          item.id === queueItem.id
            ? { ...item, status: 'Processing', progress: 100 }
            : item
        )
      );
      logActivity('upload', `Uploaded ${file.name} successfully. Starting AI semantic profiling...`);
      
      // Invalidate the cache to display the new file in the dashboard list immediately
      queryClient.invalidateQueries({ queryKey: ['files'] });

    } catch (err: any) {
      delete activeUploads.current[queueItem.id];
      const errMsg = err.message || 'Upload failed';
      setUploadQueue(prev =>
        prev.map(item =>
          item.id === queueItem.id ? { ...item, status: 'Failed', error: errMsg } : item
        )
      );
      toast.error(`Failed to upload ${file.name}: ${errMsg}`);
      logActivity('upload', `Failed uploading ${file.name}: ${errMsg}`);
    }
  };

  const uploadFiles = (files: FileList | File[]) => {
    const filesArray = Array.from(files);
    filesArray.forEach(file => {
      const queueItem: UploadQueueItem = {
        id: Math.random().toString(36).substring(7),
        filename: file.name,
        size: file.size,
        progress: 0,
        status: 'Uploading',
      };
      setUploadQueue(prev => [queueItem, ...prev]);
      executeUpload(queueItem, file);
    });
  };

  const retryUpload = (id: string) => {
    const item = uploadQueue.find(i => i.id === id);
    if (!item) return;
    toast.error(`File retry queued. Please re-drag/upload '${item.filename}' to trigger.`);
  };

  const clearQueue = () => {
    setUploadQueue(prev => prev.filter(item => item.status === 'Uploading' || item.status === 'Processing'));
  };

  // Asynchronous AI Tag polling mechanism
  useEffect(() => {
    const processingItems = uploadQueue.filter(item => item.status === 'Processing');
    if (processingItems.length === 0) return;

    let isSubscribed = true;

    const pollAiStatus = async () => {
      try {
        const latestFiles = await fetchFiles();
        if (!isSubscribed) return;

        let queueUpdated = false;

        const updatedQueue = uploadQueue.map(queueItem => {
          if (queueItem.status !== 'Processing') return queueItem;

          // Find this file in the DB records (match by filename, and look for tags)
          const matchingRecord = latestFiles.find(
            dbFile => dbFile.filename === queueItem.filename && dbFile.tags !== null
          );

          if (matchingRecord) {
            queueUpdated = true;
            const parsed = parseTags(matchingRecord.tags);
            
            // Trigger beautiful notification
            toast.success(`AI completed organization for ${queueItem.filename}!`, {
              description: `Generated tags: ${parsed.slice(0, 3).join(', ')}`,
              duration: 5000,
            });

            logActivity('ai_tagging', `AI profiled '${queueItem.filename}' -> Tags: ${parsed.join(', ')}`);

            return {
              ...queueItem,
              status: 'Tagged' as const,
              tags: parsed,
              dbId: matchingRecord.id
            };
          }

          return queueItem;
        });

        if (queueUpdated) {
          setUploadQueue(updatedQueue);
          // Invalidate the cache to display new tags in the dashboard list immediately
          queryClient.invalidateQueries({ queryKey: ['files'] });
        }
      } catch (err) {
        console.error('Failed to poll background AI updates:', err);
      }
    };

    const intervalId = setInterval(pollAiStatus, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [uploadQueue, queryClient]);

  return (
    <UploadContext.Provider
      value={{
        uploadQueue,
        activityLogs,
        uploadFiles,
        cancelUpload,
        retryUpload,
        clearQueue,
        logActivity,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};

