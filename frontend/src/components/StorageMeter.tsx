import React from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Shield } from 'lucide-react';
import type { FileRecord } from '../types';

interface StorageMeterProps {
  files: FileRecord[];
}

export const StorageMeter: React.FC<StorageMeterProps> = ({ files }) => {
  const maxCapacityBytes = 10 * 1024 * 1024 * 1024; // 10 GB limit
  
  // Estimate sizes for UI display based on random/deterministic factors or extensions
  // because backend database records only save filenames
  const estimateFileSize = (filename: string): number => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'zip': case 'tar': case 'gz': return 15.4 * 1024 * 1024;
      case 'pdf': return 2.1 * 1024 * 1024;
      case 'png': case 'jpg': case 'jpeg': return 1.8 * 1024 * 1024;
      case 'mp4': case 'mov': return 45 * 1024 * 1024;
      case 'mp3': case 'wav': return 4.5 * 1024 * 1024;
      case 'js': case 'ts': case 'tsx': case 'py': case 'json': return 24 * 1024;
      default: return 120 * 1024; // 120 KB fallback
    }
  };

  const totalUsedBytes = files.reduce((acc, file) => acc + estimateFileSize(file.filename), 0);
  const totalUsedMB = (totalUsedBytes / (1024 * 1024)).toFixed(1);
  const totalUsedGB = (totalUsedBytes / (1024 * 1024 * 1024)).toFixed(3);
  const percentage = Math.min((totalUsedBytes / maxCapacityBytes) * 100, 100);

  return (
    <div className="bg-[#0b0a12]/80 backdrop-blur-xl border border-purple-950/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl shadow-purple-950/10">
      {/* Background radial gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-2xl pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-gray-200">Vault Footprint</h3>
        </div>
        <span className="text-xs font-mono text-purple-400/80 px-2 py-0.5 rounded-full bg-purple-950/20 border border-purple-900/30">
          MinIO / Cloudflare R2
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Ring indicator */}
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#13111f"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Progress ring */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              stroke="url(#purpleGradient)"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={251.2}
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * percentage) / 100 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-base font-bold text-gray-100">{percentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Footprint statistics */}
        <div className="flex-1 space-y-2">
          <div>
            <div className="flex items-baseline gap-1 text-2xl font-bold text-gray-100">
              {Number(totalUsedGB) > 0.1 ? `${totalUsedGB} GB` : `${totalUsedMB} MB`}
              <span className="text-xs font-normal text-gray-400">/ 10 GB</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#12111d]/50 border border-purple-950/20 rounded p-1.5 flex flex-col">
              <span className="text-gray-400">File Count</span>
              <span className="font-bold text-purple-300 font-mono text-sm">{files.length}</span>
            </div>
            <div className="bg-[#12111d]/50 border border-purple-950/20 rounded p-1.5 flex flex-col">
              <span className="text-gray-400">Security</span>
              <span className="font-bold text-pink-300 text-sm flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> TLS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
