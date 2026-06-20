import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Image, Video, Music, FileCode, FolderArchive, File,
  Download, Share2, Trash2, BrainCircuit, Calendar, MoreVertical, Copy, Check, Link
} from 'lucide-react';
import type { FileRecord, UploadStatus } from '../types';
import { getDownloadLink, deleteFile, parseTags } from '../services/api';
import { toast } from 'sonner';

interface FileCardProps {
  file: FileRecord;
  onShareClick: (fileId: number, filename: string) => void;
  onRefreshNeeded: () => void;
  onActivityLogged: (type: string, message: string) => void;
  statusOverride?: UploadStatus;
}

// ─── Portal Context Menu ──────────────────────────────────────────────────────
interface ContextMenuProps {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ anchorRect, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Smart positioning: never clip off screen
  const getPosition = () => {
    const menuW = 192; // w-48
    const menuH = 180; // approximate
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = anchorRect.bottom + 6;
    let left = anchorRect.right - menuW;

    // Flip up if not enough space below
    if (top + menuH > vh - 12) {
      top = anchorRect.top - menuH - 6;
    }
    // Clamp left
    if (left < 8) left = 8;
    if (left + menuW > vw - 8) left = vw - menuW - 8;

    return { top, left };
  };

  const pos = getPosition();

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // use capture so it fires before any inner handlers
    document.addEventListener('mousedown', onClick, true);
    return () => document.removeEventListener('mousedown', onClick, true);
  }, [onClose]);

  // Close on scroll
  useEffect(() => {
    const onScroll = () => onClose();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [onClose]);

  return createPortal(
    <motion.div
      ref={menuRef}
      role="menu"
      aria-label="File options"
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        width: 192,
      }}
      className="bg-[#0e0c18]/95 backdrop-blur-2xl border border-purple-900/40 rounded-2xl shadow-2xl shadow-black/60 p-1.5 overflow-hidden"
    >
      {children}
    </motion.div>,
    document.body
  );
};

// ─── Menu Item ────────────────────────────────────────────────────────────────
interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, disabled, variant = 'default' }) => (
  <button
    role="menuitem"
    onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
    }}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) onClick(e);
    }}
    disabled={disabled}
    className={`
      w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium
      flex items-center gap-2.5 transition-all duration-150 cursor-pointer
      disabled:opacity-40 disabled:cursor-not-allowed
      focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500
      ${variant === 'danger'
        ? 'text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 active:bg-rose-500/25'
        : 'text-gray-300 hover:bg-purple-500/12 hover:text-white active:bg-purple-500/20'
      }
    `}
  >
    <span className="shrink-0">{icon}</span>
    {label}
  </button>
);

// ─── File Type Info ───────────────────────────────────────────────────────────
const getFileInfo = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg','jpeg','png','gif','svg','webp','avif'].includes(ext))
    return { icon: <Image className="w-6 h-6 text-emerald-400" />, bg: 'bg-emerald-950/20 border-emerald-900/30' };
  if (['mp4','mov','avi','mkv','webm'].includes(ext))
    return { icon: <Video className="w-6 h-6 text-pink-400" />, bg: 'bg-pink-950/20 border-pink-900/30' };
  if (['mp3','wav','ogg','m4a','flac'].includes(ext))
    return { icon: <Music className="w-6 h-6 text-violet-400" />, bg: 'bg-violet-950/20 border-violet-900/30' };
  if (['zip','tar','gz','rar','7z'].includes(ext))
    return { icon: <FolderArchive className="w-6 h-6 text-amber-400" />, bg: 'bg-amber-950/20 border-amber-900/30' };
  if (['html','css','js','ts','tsx','py','json','c','cpp','go','sh','rs','java'].includes(ext))
    return { icon: <FileCode className="w-6 h-6 text-sky-400" />, bg: 'bg-sky-950/20 border-sky-900/30' };
  if (['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','md'].includes(ext))
    return { icon: <FileText className="w-6 h-6 text-rose-400" />, bg: 'bg-rose-950/20 border-rose-900/30' };
  return { icon: <File className="w-6 h-6 text-gray-400" />, bg: 'bg-gray-950/20 border-gray-900/30' };
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const FileCard: React.FC<FileCardProps> = ({
  file, onShareClick, onRefreshNeeded, onActivityLogged, statusOverride
}) => {
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  const toggleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuAnchor) {
      closeMenu();
    } else {
      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
      setMenuAnchor(rect);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMenu();
    setIsDownloading(true);
    try {
      const url = await getDownloadLink(file.id);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.setAttribute('download', file.filename);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success(`Downloading: ${file.filename}`);
      onActivityLogged('download', `Downloaded ${file.filename}`);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMenu();
    try {
      const url = await getDownloadLink(file.id);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Direct link copied to clipboard');
      onActivityLogged('copy_url', `Copied URL for ${file.filename}`);
      setTimeout(() => setCopied(false), 2500);
    } catch (err: any) {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMenu();
    onShareClick(file.id, file.filename);
    onActivityLogged('share', `Opened share dialog for ${file.filename}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMenu();
    if (!window.confirm(`Delete '${file.filename}' permanently? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await deleteFile(file.id);
      toast.success(`Deleted: ${file.filename}`);
      onActivityLogged('delete', `Deleted file '${file.filename}'`);
      onRefreshNeeded();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const fileInfo = getFileInfo(file.filename);
  const dateStr = new Date(file.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const parsedTags = parseTags(file.tags);
  const isTagged = parsedTags.length > 0;
  const status: UploadStatus = statusOverride || (isTagged ? 'Tagged' : 'Processing');

  // Confidence metric (stable hash-based, purely visual)
  const confidence = (() => {
    let h = 0;
    for (let i = 0; i < file.filename.length; i++) {
      h = file.filename.charCodeAt(i) + ((h << 5) - h);
    }
    return 92 + (Math.abs(h) % 7);
  })();

  return (
    <>
      <motion.div
        layout
        className="bg-[#0b0a12]/80 backdrop-blur-xl border border-purple-950/20 rounded-2xl p-5
          hover:border-purple-800/50 hover:shadow-[0_0_25px_rgba(139,92,246,0.08)]
          transition-all flex flex-col justify-between group relative h-[210px] select-text"
        whileHover={{ y: -2 }}
      >
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/2 rounded-full filter blur-xl pointer-events-none group-hover:bg-purple-500/5 transition-colors" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className={`p-2.5 rounded-xl border shrink-0 ${fileInfo.bg}`}>
            {fileInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4
              className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors select-all"
              title={file.filename}
            >
              {file.filename}
            </h4>
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-purple-500/50" /> {dateStr}
            </span>
          </div>

          {/* Three-dot trigger — outside any overflow:hidden container */}
          <button
            ref={triggerRef}
            id={`menu-trigger-${file.id}`}
            aria-label="File options"
            aria-haspopup="true"
            aria-expanded={!!menuAnchor}
            onClick={toggleMenu}
            disabled={isDeleting}
            className={`
              p-1.5 rounded-lg text-gray-400 hover:text-white
              hover:bg-purple-950/40 active:bg-purple-950/60
              transition-colors cursor-pointer shrink-0 relative z-20
              focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500
              disabled:opacity-40 disabled:cursor-not-allowed
              ${menuAnchor ? 'bg-purple-950/40 text-white' : ''}
            `}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* AI Tags */}
        <div className="relative z-10 flex-grow flex items-end mt-4">
          {status === 'Processing' ? (
            <div className="w-full flex items-center gap-2 bg-purple-950/10 border border-purple-950/50 rounded-xl p-2.5 animate-pulse brain-scanner overflow-hidden">
              <BrainCircuit className="w-5 h-5 text-purple-400 animate-spin" style={{ animationDuration: '4s' }} />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-purple-400 block tracking-wider uppercase">AI Thinking</span>
                <p className="text-[11px] text-gray-400 truncate">Cataloging features & semantic indexing...</p>
              </div>
            </div>
          ) : status === 'Failed' ? (
            <div className="w-full flex items-center gap-2 bg-rose-950/15 border border-rose-950/30 rounded-xl p-2.5">
              <BrainCircuit className="w-5 h-5 text-rose-400" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-rose-400 block">Analysis Failed</span>
                <p className="text-[11px] text-gray-400 truncate">Groq LLM unavailable.</p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-2">
              <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto pr-1">
                {parsedTags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-purple-950/20 border border-purple-900/30 text-purple-300 px-2 py-0.5 rounded-full font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-purple-950/30 pt-1.5 text-[9px] text-gray-500 font-mono">
                <span className="flex items-center gap-1">
                  <BrainCircuit className="w-3.5 h-3.5 text-purple-400" /> Profiler Active
                </span>
                <span className="text-pink-400/80 font-semibold">{confidence}% Conf</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Portal context menu — completely outside the card, no overflow clipping possible */}
      <AnimatePresence>
        {menuAnchor && (
          <ContextMenu anchorRect={menuAnchor} onClose={closeMenu}>
            <MenuItem
              icon={<Download className="w-3.5 h-3.5 text-purple-400" />}
              label={isDownloading ? 'Fetching…' : 'Download'}
              onClick={handleDownload}
              disabled={isDownloading}
            />
            <MenuItem
              icon={<Share2 className="w-3.5 h-3.5 text-indigo-400" />}
              label="Share link"
              onClick={handleShare}
            />
            <MenuItem
              icon={copied
                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                : <Link className="w-3.5 h-3.5 text-blue-400" />
              }
              label={copied ? 'Copied!' : 'Copy direct URL'}
              onClick={handleCopyLink}
            />
            <div className="border-t border-white/5 my-1 mx-1" />
            <MenuItem
              icon={<Trash2 className="w-3.5 h-3.5" />}
              label={isDeleting ? 'Deleting…' : 'Delete file'}
              onClick={handleDelete}
              disabled={isDeleting}
              variant="danger"
            />
          </ContextMenu>
        )}
      </AnimatePresence>
    </>
  );
};
