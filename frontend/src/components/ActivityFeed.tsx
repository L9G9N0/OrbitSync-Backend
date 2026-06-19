import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Eye, Share2, Trash2, Cpu, FileClock } from 'lucide-react';
import type { ActivityLog } from '../types';

interface ActivityFeedProps {
  logs: ActivityLog[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs }) => {
  const getIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'upload':
        return <FileUp className="w-4 h-4 text-emerald-400" />;
      case 'download':
        return <Eye className="w-4 h-4 text-blue-400" />;
      case 'share':
        return <Share2 className="w-4 h-4 text-indigo-400" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      case 'ai_tagging':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      default:
        return <FileClock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-[#0b0a12]/80 backdrop-blur-xl border border-purple-950/30 rounded-2xl p-6 shadow-2xl flex flex-col h-full min-h-[300px]">
      <div className="flex items-center gap-2 mb-4 border-b border-purple-950/30 pb-3">
        <FileClock className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-gray-200">Activity Ledger</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-[320px] pr-1.5 scrollbar-thin">
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500 italic">
              No recent events logged
            </div>
          ) : (
            logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3 bg-[#11101a]/40 border border-purple-950/20 rounded-xl p-3 hover:border-purple-900/30 transition-colors"
              >
                <div className="p-1.5 rounded-lg bg-purple-950/30 border border-purple-900/30 shrink-0">
                  {getIcon(log.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 break-words leading-relaxed font-sans">
                    {log.message}
                  </p>
                  <span className="text-[10px] text-gray-500 font-mono block mt-1">
                    {log.timestamp}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
