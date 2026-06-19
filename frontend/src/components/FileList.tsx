import React from 'react';
import { motion } from 'framer-motion';
import { FileCard } from './FileCard';
import type { FileRecord, UploadQueueItem } from '../types';
import { Inbox, BrainCircuit } from 'lucide-react';

interface FileListProps {
  dbFiles: FileRecord[];
  uploadQueue: UploadQueueItem[];
  isLoading: boolean;
  error: Error | null;
  onShareClick: (fileId: number, filename: string) => void;
  onRefreshNeeded: () => void;
  onActivityLogged: (message: string) => void;
  searchQuery: string;
}

export const FileList: React.FC<FileListProps> = ({
  dbFiles,
  uploadQueue,
  isLoading,
  error,
  onShareClick,
  onRefreshNeeded,
  onActivityLogged,
  searchQuery: _searchQuery,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-[#0b0a12]/40 border border-purple-950/20 rounded-2xl p-5 h-[210px] flex flex-col justify-between animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/30" />
              <div className="flex-1 space-y-2 mt-1">
                <div className="h-4 bg-purple-950/30 rounded w-3/4" />
                <div className="h-3 bg-purple-950/20 rounded w-1/2" />
              </div>
            </div>
            <div className="h-10 bg-purple-950/20 rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-950/10 border border-rose-900/30 rounded-2xl p-8 text-center text-rose-400">
        <p className="font-semibold">Vault connection failed</p>
        <p className="text-xs mt-1 text-gray-400">{error.message || 'Check if FastAPI is running.'}</p>
        <button
          onClick={onRefreshNeeded}
          className="mt-4 px-4 py-2 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs hover:bg-rose-900/40 transition-all font-semibold"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Optimistic UI logic: Combine DB files and upload queue files
  // Filter out DB files that share names with files currently in progress (to avoid double items in list)
  const uploadingOrProcessingFilenames = new Set(
    uploadQueue
      .filter((q) => q.status === 'Uploading' || q.status === 'Processing')
      .map((q) => q.filename)
  );

  const visibleDbFiles = dbFiles.filter(
    (file) => !uploadingOrProcessingFilenames.has(file.filename)
  );

  // Map upload queue items into temporary FileRecord shapes for consistent card rendering
  const optimisticFiles: { file: FileRecord; statusOverride: UploadQueueItem['status'] }[] = uploadQueue
    .filter((q) => q.status === 'Uploading' || q.status === 'Processing' || q.status === 'Failed')
    .map((q) => ({
      file: {
        id: -Math.floor(Math.random() * 100000), // Negative dummy IDs
        filename: q.filename,
        tags: q.tags || null,
        created_at: new Date().toISOString(),
      },
      statusOverride: q.status,
    }));

  // Combine and sort
  // DB files are sorted by creation date (newest first). Let's make sure our combined list is sorted similarly.
  const mergedList = [
    ...optimisticFiles,
    ...visibleDbFiles.map((file) => ({ file, statusOverride: undefined as any })),
  ];

  if (mergedList.length === 0) {
    return (
      <div className="bg-[#0b0a12]/40 border border-purple-950/10 rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-4">
        <div className="p-4 rounded-full bg-purple-950/20 border border-purple-900/30 text-purple-400">
          <Inbox className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h4 className="text-gray-200 font-medium">Vault is Empty</h4>
          <p className="text-xs text-gray-500 max-w-sm">
            Drag files into the upload zone above to trigger automatic semantic classification.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* List count display */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-purple-400/80 flex items-center gap-1.5">
          <BrainCircuit className="w-4 h-4" /> Displaying {mergedList.length} indexed object(s)
        </span>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
        layout
      >
        {mergedList.map(({ file, statusOverride }) => (
          <FileCard
            key={file.id}
            file={file}
            statusOverride={statusOverride}
            onShareClick={onShareClick}
            onRefreshNeeded={onRefreshNeeded}
            onActivityLogged={onActivityLogged}
          />
        ))}
      </motion.div>
    </div>
  );
};
