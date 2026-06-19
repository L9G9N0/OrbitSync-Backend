import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { useUpload } from '../store/UploadContext';

export const UploadZone: React.FC = () => {
  const { uploadFiles, uploadQueue } = useUpload();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Check if there are active uploads to show a subtle scanning state in the border
  const hasActiveUpload = uploadQueue.some(
    (item) => item.status === 'Uploading' || item.status === 'Processing'
  );

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 select-none group min-height-[220px] ${
        isDragActive
          ? 'border-purple-500 bg-purple-950/10 shadow-[0_0_30px_rgba(139,92,246,0.15)]Scale(1.01)'
          : hasActiveUpload
          ? 'border-indigo-500/60 bg-indigo-950/5 animate-[pulse_2s_infinite]'
          : 'border-purple-950/40 bg-[#0b0a12]/60 hover:border-purple-800/80 hover:bg-purple-950/5'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Decorative center orb */}
      <div className="absolute w-40 h-40 bg-purple-500/5 rounded-full filter blur-xl group-hover:bg-purple-500/10 transition-colors pointer-events-none" />

      <div className="relative space-y-4 flex flex-col items-center">
        <div className={`p-4 rounded-full bg-purple-950/30 border border-purple-900/40 group-hover:scale-110 transition-transform ${
          hasActiveUpload ? 'text-indigo-400 animate-bounce' : 'text-purple-400'
        }`}>
          <UploadCloud className="w-10 h-10" />
        </div>
        
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-200">
            Drag & Drop files here, or <span className="text-purple-400 hover:text-purple-300 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400">
            Supports documents, media, archives, or code files. Size up to 2GB.
          </p>
        </div>

        {isDragActive && (
          <div className="absolute inset-0 bg-purple-950/20 backdrop-blur-xs rounded-2xl flex items-center justify-center border-2 border-purple-500">
            <span className="text-lg font-semibold text-purple-300 animate-pulse flex items-center gap-2">
              <File className="w-6 h-6 animate-bounce" /> Release files to upload
            </span>
          </div>
        )}
      </div>
      
      {/* Optional upload hint */}
      <div className="absolute bottom-2 text-[10px] text-gray-500/80 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" /> Secure direct upload over SSL.
      </div>
    </div>
  );
};
