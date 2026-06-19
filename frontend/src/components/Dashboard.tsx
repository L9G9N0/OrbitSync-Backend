import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadProvider, useUpload } from '../store/UploadContext';
import { SearchBox } from './SearchBox';
import { UploadZone } from './UploadZone';
import { FileList } from './FileList';
import { StorageMeter } from './StorageMeter';
import { ActivityFeed } from './ActivityFeed';
import { ShareModal } from './ShareModal';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { searchVault } from '../services/api';
import { Brain, Cpu, ShieldCheck, Keyboard, RefreshCw } from 'lucide-react';

export const DashboardContent: React.FC = () => {
  const { uploadQueue, activityLogs, logActivity } = useUpload();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals visibility
  const [shareFile, setShareFile] = useState<{ id: number; name: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // TanStack Query for files list + search queries
  const {
    data: files = [],
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['files', searchQuery],
    queryFn: () => searchVault(searchQuery),
    staleTime: 5000,
  });

  // Listen for keyboard shortcuts: Shift + U to upload, Shift + K for help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toUpperCase() === 'K') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if (e.shiftKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        // Trigger manual input select
        const uploadZoneInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        uploadZoneInput?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleShareClick = (fileId: number, filename: string) => {
    setShareFile({ id: fileId, name: filename });
  };

  const handleActivityLogged = (message: string) => {
    logActivity('share', message);
  };

  return (
    <div className="min-h-screen bg-[#030207] text-gray-200 py-10 px-4 md:px-8 relative select-none">
      {/* Dynamic Event Horizon Orb Background */}
      <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-purple-900/10 rounded-full filter blur-[120px] pointer-events-none animate-event-horizon" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-pink-900/10 rounded-full filter blur-[100px] pointer-events-none animate-event-horizon" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Top Header Navigation */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-purple-950/30 pb-6">
          <div className="flex items-center gap-3">
            {/* Spinning event horizon circle logo */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-950/50 group select-none">
              <div className="absolute inset-0.5 rounded-full bg-[#030207] flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-400 animate-cosmic-pulse group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white m-0 uppercase font-sans">
                  Black<span className="text-purple-400">Hole</span>
                </h1>
                <span className="text-[10px] font-mono text-purple-400/80 px-2 py-0.5 rounded bg-purple-950/20 border border-purple-900/30">
                  v2.0 Beta
                </span>
              </div>
              <p className="text-xs text-gray-400 font-sans leading-none mt-1">
                Zero Friction. AI-profiled Cloud Storage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="p-2.5 rounded-xl bg-[#0b0a12] border border-purple-950/40 hover:border-purple-800/50 hover:bg-purple-950/20 text-purple-400 hover:text-white transition-colors cursor-pointer"
              title="Force index refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="px-4 py-2.5 rounded-xl bg-[#0b0a12] border border-purple-950/40 hover:border-purple-800/50 hover:bg-purple-950/20 text-gray-300 hover:text-white transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Keyboard className="w-4 h-4" /> Keyboard Shortcuts
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b0a12] border border-purple-950/30 text-xs text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" /> Connected
            </div>
          </div>
        </header>

        {/* Dashboard Grid System */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Content Area (FileList & SearchBox) */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Search Component */}
            <section className="aria-label-search">
              <SearchBox onSearch={setSearchQuery} isLoading={isLoading} />
            </section>

            {/* Drag and Drop Zone */}
            <section className="aria-label-upload-zone">
              <UploadZone />
            </section>

            {/* Upload Queue Progress Monitor */}
            {uploadQueue.some(item => item.status === 'Uploading' || item.status === 'Processing') && (
              <section className="bg-[#0b0a12]/60 border border-purple-950/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-950/20 pb-2">
                  <span className="text-xs font-semibold text-purple-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4 animate-pulse" /> Active Upload Operations
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {uploadQueue.filter(i => i.status === 'Uploading' || i.status === 'Processing').length} item(s) processing
                  </span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {uploadQueue
                    .filter(item => item.status === 'Uploading' || item.status === 'Processing')
                    .map(item => (
                      <div key={item.id} className="bg-[#12111d]/50 border border-purple-950/20 rounded-xl p-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-gray-300 truncate">{item.filename}</p>
                          {/* Progress bar */}
                          <div className="w-full bg-[#1e1c31] h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                          <span className="text-[10px] font-semibold text-purple-400 animate-pulse">
                            {item.status === 'Uploading' ? `${item.progress}%` : 'AI Indexing...'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* File List Grid */}
            <section className="aria-label-file-list">
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
            </section>
          </div>

          {/* Sidebar Widgets */}
          <aside className="lg:col-span-1 space-y-8 h-fit">
            <section className="aria-label-storage">
              <StorageMeter files={files} />
            </section>

            <section className="aria-label-activity">
              <ActivityFeed logs={activityLogs} />
            </section>
          </aside>
        </div>

        {/* Modal Modals */}
        <ShareModal
          isOpen={shareFile !== null}
          onClose={() => setShareFile(null)}
          fileId={shareFile?.id || 0}
          filename={shareFile?.name || ''}
          onActivityLogged={handleActivityLogged}
        />

        <KeyboardShortcutsHelp
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
        />

      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  return (
    <UploadProvider>
      <DashboardContent />
    </UploadProvider>
  );
};

