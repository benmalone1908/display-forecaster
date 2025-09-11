import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  headerContent?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, headerContent }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-7xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header - styled to match campaign-trends */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 rounded-t-2xl flex items-center justify-between border-b border-gray-200">
          {title && (
            <h2 className="text-2xl font-bold text-white">{title}</h2>
          )}
          <div className="flex items-center gap-6">
            {headerContent && (
              <div className="flex items-center gap-6">
                {headerContent}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};