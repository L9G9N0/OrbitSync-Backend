import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Clock, ShieldAlert } from 'lucide-react';
import { getShareLink } from '../services/api';
import { toast } from 'sonner';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: number;
  filename: string;
  onActivityLogged: (type: string, message: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  fileId,
  filename,
  onActivityLogged,
}) => {
  const [expiryMinutes, setExpiryMinutes] = useState(60);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setShareUrl('');
    setCopied(false);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const data = await getShareLink(fileId, expiryMinutes);
      setShareUrl(data.share_url);
      await navigator.clipboard.writeText(data.share_url);
      setCopied(true);
      toast.success('Secure link generated and copied!', {
        description: `Expires in ${expiryMinutes} minutes.`,
      });
      onActivityLogged('share', `Shared '${filename}' — expires in ${expiryMinutes} min`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Copied to clipboard');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md bg-[#0c0a13] border border-purple-900/40 rounded-2xl p-6 shadow-2xl z-10 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-purple-500/10 rounded-full filter blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-pink-500/10 rounded-full filter blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 border-b border-purple-950/30 pb-3">
              <h3 id="share-modal-title" className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Share Secure Ticket
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white p-1.5 hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs text-purple-400 block mb-1">Target file</span>
                <p className="text-sm font-mono text-gray-200 truncate bg-purple-950/15 border border-purple-950/45 px-3 py-2 rounded-xl">
                  {filename}
                </p>
              </div>

              {!shareUrl ? (
                <>
                  <div>
                    <label className="text-xs text-purple-400 block mb-2">Expiry duration</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '5 Mins', val: 5 },
                        { label: '1 Hour', val: 60 },
                        { label: '1 Day', val: 1440 },
                        { label: '3 Days', val: 4320 },
                        { label: '7 Days', val: 10080 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setExpiryMinutes(item.val)}
                          className={`py-2 px-3 rounded-xl border text-xs font-medium font-mono transition-all cursor-pointer ${
                            expiryMinutes === item.val
                              ? 'bg-purple-950/50 border-purple-500 text-purple-300'
                              : 'bg-[#12101e]/60 border-purple-950/40 text-gray-400 hover:text-gray-200 hover:border-purple-900/50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-pink-950/10 border border-pink-950/40 rounded-xl p-3 text-xs text-pink-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Links are presigned and auto-expire. Maximum is 7 days.</span>
                  </div>

                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
                      text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-950/30
                      transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : 'Generate & Copy Link'}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-emerald-400 block mb-1">Link generated successfully</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 bg-purple-950/10 border border-purple-950/50 rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none"
                      />
                      <button
                        onClick={handleManualCopy}
                        className="bg-purple-900/40 border border-purple-800/40 hover:bg-purple-800/60 p-2.5 rounded-xl text-purple-300 hover:text-white transition-colors cursor-pointer"
                        title="Copy"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-400 px-1">
                    <span>Active for:</span>
                    <span className="font-semibold text-purple-400 font-mono">
                      {expiryMinutes >= 1440 ? `${expiryMinutes / 1440} day(s)` : `${expiryMinutes} min(s)`}
                    </span>
                  </div>

                  <button
                    onClick={() => setShareUrl('')}
                    className="w-full bg-purple-950/30 hover:bg-purple-950/50 border border-purple-900/30 text-purple-300 font-medium py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Create another link
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
