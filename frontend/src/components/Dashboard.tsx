import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadProvider, useUpload } from '../store/UploadContext';
import { useAuth } from '../store/AuthContext';
import { SearchBox } from './SearchBox';
import { UploadZone } from './UploadZone';
import { FileList } from './FileList';
import { StorageMeter } from './StorageMeter';
import { ActivityFeed } from './ActivityFeed';
import { ShareModal } from './ShareModal';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { searchVault } from '../services/api';
import {
  Brain, Cpu, ShieldCheck, Keyboard, RefreshCw,
  LogOut, User, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActivityType } from '../types';

// ─── User Profile Menu ────────────────────────────────────────────────────────
const UserMenu: React.FC = () => {
  const { user, signOut } = useAuth();
  const { logActivity } = useUpload();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setOpen(false);
    logActivity('logout', 'Signed out of vault');
    await signOut();
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0b0a12] border border-purple-950/40
          hover:border-purple-800/50 hover:bg-purple-950/20 transition-colors cursor-pointer focus:outline-none
          focus-visible:ring-1 focus-visible:ring-purple-500"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {initial}
        </div>
        <span className="text-xs text-gray-300 max-w-[120px] truncate hidden sm:block">{user?.email}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 mt-2 w-56 bg-[#0e0c18]/95 backdrop-blur-2xl border border-purple-900/40
                rounded-2xl shadow-2xl shadow-black/60 z-[9999] p-2 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-white/5 mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
                    <p className="text-[10px] text-gray-500">Vault owner</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:bg-white/5
                  hover:text-gray-200 transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" /> Account settings
              </button>

              <div className="border-t border-white/5 my-1" />

              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10
                  hover:text-rose-300 transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Dashboard Inner Content ──────────────────────────────────────────────────
export const DashboardContent: React.FC = () => {
  const { uploadQueue, activityLogs, logActivity } = useUpload();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [shareFile, setShareFile] = useState<{ id: number; name: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { data: files = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['files', searchQuery],
    queryFn: () => searchVault(searchQuery),
    staleTime: 5000,
  });

  // Log login once on mount when user is present
  useEffect(() => {
    if (user) {
      logActivity('login', `Signed in as ${user.email}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toUpperCase() === 'K') {
        e.preventDefault();
        setShowShortcuts(p => !p);
      }
      if (e.shiftKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        (document.querySelector('input[type="file"]') as HTMLInputElement)?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleShareClick = (fileId: number, filename: string) => setShareFile({ id: fileId, name: filename });

  const handleActivityLogged = (type: string, message: string) => {
    logActivity(type as ActivityType, message);
  };

  return (
    <div className="min-h-screen bg-[#030207] text-gray-200 py-8 px-4 md:px-8 relative select-none">
      {/* Ambient orbs */}
      <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-purple-900/10 rounded-full filter blur-[120px] pointer-events-none animate-event-horizon" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-pink-900/10 rounded-full filter blur-[100px] pointer-events-none animate-event-horizon" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-purple-950/30 pb-6">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-950/50 shrink-0">
              <div className="absolute inset-0.5 rounded-full bg-[#030207] flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-400 animate-cosmic-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                  Black<span className="text-purple-400">Hole</span>
                </h1>
                <span className="text-[10px] font-mono text-purple-400/80 px-2 py-0.5 rounded bg-purple-950/20 border border-purple-900/30">
                  v2.0 Beta
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Zero Friction. AI-profiled Cloud Storage.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              title="Force index refresh"
              className="p-2.5 rounded-xl bg-[#0b0a12] border border-purple-950/40 hover:border-purple-800/50
                hover:bg-purple-950/20 text-purple-400 hover:text-white transition-colors cursor-pointer
                disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="hidden sm:flex px-3 py-2.5 rounded-xl bg-[#0b0a12] border border-purple-950/40
                hover:border-purple-800/50 hover:bg-purple-950/20 text-gray-400 hover:text-white transition-colors
                text-xs font-semibold items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500"
            >
              <Keyboard className="w-4 h-4" /> Shortcuts
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0b0a12] border border-emerald-900/30 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" /> Connected
            </div>

            <UserMenu />
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main */}
          <div className="lg:col-span-3 space-y-6">
            <SearchBox onSearch={setSearchQuery} isLoading={isLoading} />
            <UploadZone />

            {/* Active upload queue */}
            {uploadQueue.some(i => i.status === 'Uploading' || i.status === 'Processing') && (
              <div className="bg-[#0b0a12]/60 border border-purple-950/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-950/20 pb-2">
                  <span className="text-xs font-semibold text-purple-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4 animate-pulse" /> Active Transfers
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {uploadQueue.filter(i => i.status === 'Uploading' || i.status === 'Processing').length} item(s)
                  </span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {uploadQueue
                    .filter(i => i.status === 'Uploading' || i.status === 'Processing')
                    .map(item => (
                      <div key={item.id} className="bg-[#12111d]/50 border border-purple-950/20 rounded-xl p-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-300 truncate">{item.filename}</p>
                          <div className="w-full bg-[#1e1c31] h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-purple-400 animate-pulse shrink-0">
                          {item.status === 'Uploading' ? `${item.progress}%` : 'AI…'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <FileList
              dbFiles={files}
              uploadQueue={uploadQueue}
              isLoading={isLoading}
              error={error as Error}
              onShareClick={handleShareClick}
              onRefreshNeeded={refetch}
              onActivityLogged={handleActivityLogged}
              searchQuery={searchQuery}
            />
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            <StorageMeter files={files} />
            <ActivityFeed logs={activityLogs} />
          </aside>
        </div>
      </div>

      <ShareModal
        isOpen={shareFile !== null}
        onClose={() => setShareFile(null)}
        fileId={shareFile?.id || 0}
        filename={shareFile?.name || ''}
        onActivityLogged={handleActivityLogged}
      />
      <KeyboardShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
};

export const Dashboard: React.FC = () => (
  <UploadProvider>
    <DashboardContent />
  </UploadProvider>
);
