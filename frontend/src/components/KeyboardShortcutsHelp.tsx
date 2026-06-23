import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Retrieve all focusable children
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

  const shortcuts = [
    { key: '/', desc: 'Focus the semantic search input' },
    { key: 'ESC', desc: 'Dismiss open sharing ticket or shortcut modals' },
    { key: 'Shift + U', desc: 'Trigger manual file picker dialog' },
    { key: 'Shift + K', desc: 'Reveal this shortcuts cheat-sheet' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
            className="relative w-full max-w-sm bg-[#0c0a13] border border-purple-900/40 rounded-2xl p-6 shadow-2xl z-10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 border-b border-purple-950/30 pb-3">
              <h3 id="shortcuts-modal-title" className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-purple-400" /> Keyboard Shortcuts
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 hover:bg-purple-950/40 rounded-full transition-colors cursor-pointer"
                aria-label="Close shortcuts modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-purple-950/20 last:border-0 text-sm">
                  <span className="text-gray-300">{shortcut.desc}</span>
                  <kbd className="px-2 py-1 rounded bg-purple-950/40 border border-purple-900/40 text-purple-300 font-mono text-xs font-semibold shadow-inner">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full bg-purple-950/40 hover:bg-purple-950/60 border border-purple-900/30 text-purple-300 font-medium py-2 rounded-xl transition-all text-xs cursor-pointer"
            >
              Close Shortcuts
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
