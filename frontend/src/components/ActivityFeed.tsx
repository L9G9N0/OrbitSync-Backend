import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Download, Share2, Trash2, Cpu, FileClock, Copy, LogIn, LogOut } from 'lucide-react';
import type { ActivityLog, ActivityType } from '../types';

interface ActivityFeedProps {
  logs: ActivityLog[];
}

const iconMap: Record<ActivityType, React.ReactNode> = {
  upload:      <FileUp className="w-3.5 h-3.5 text-emerald-400" />,
  download:    <Download className="w-3.5 h-3.5 text-sky-400" />,
  share:       <Share2 className="w-3.5 h-3.5 text-indigo-400" />,
  delete:      <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
  ai_tagging:  <Cpu className="w-3.5 h-3.5 text-purple-400" />,
  copy_url:    <Copy className="w-3.5 h-3.5 text-blue-400" />,
  login:       <LogIn className="w-3.5 h-3.5 text-emerald-400" />,
  logout:      <LogOut className="w-3.5 h-3.5 text-orange-400" />,
};

const colorMap: Record<ActivityType, string> = {
  upload:     'bg-emerald-950/20 border-emerald-900/20',
  download:   'bg-sky-950/20 border-sky-900/20',
  share:      'bg-indigo-950/20 border-indigo-900/20',
  delete:     'bg-rose-950/20 border-rose-900/20',
  ai_tagging: 'bg-purple-950/20 border-purple-900/20',
  copy_url:   'bg-blue-950/20 border-blue-900/20',
  login:      'bg-emerald-950/20 border-emerald-900/20',
  logout:     'bg-orange-950/20 border-orange-900/20',
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs }) => {
  return (
    <div className="bg-[#0b0a12]/80 backdrop-blur-xl border border-purple-950/30 rounded-2xl p-5 shadow-2xl flex flex-col min-h-[260px]">
      <div className="flex items-center justify-between gap-2 mb-4 border-b border-purple-950/30 pb-3">
        <div className="flex items-center gap-2">
          <FileClock className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-gray-200">Activity Ledger</h3>
        </div>
        {logs.length > 0 && (
          <span className="text-[10px] font-mono text-gray-600 bg-purple-950/20 px-2 py-0.5 rounded-full">
            {logs.length} event{logs.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px] pr-1">
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-10 text-center space-y-2"
            >
              <div className="p-2.5 rounded-full bg-purple-950/20 border border-purple-900/20">
                <FileClock className="w-5 h-5 text-purple-500/40" />
              </div>
              <p className="text-xs text-gray-600">No events logged yet</p>
            </motion.div>
          ) : (
            logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2.5 rounded-xl p-2.5 hover:bg-white/2 transition-colors"
              >
                <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${colorMap[log.type] ?? 'bg-gray-950/20 border-gray-900/20'}`}>
                  {iconMap[log.type] ?? <FileClock className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-300 leading-snug break-words">{log.message}</p>
                  <span className="text-[10px] text-gray-600 font-mono block mt-0.5">{log.timestamp}</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
