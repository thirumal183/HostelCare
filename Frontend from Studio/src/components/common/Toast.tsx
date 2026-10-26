import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ToastState {
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose, duration]);

  if (!toast) return null;

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />,
          bg: 'bg-[#FFFFFF] dark:bg-[#152238]',
          border: 'border-[#A7F3D0] dark:border-[#115E41]',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />,
          bg: 'bg-[#FFFFFF] dark:bg-[#152238]',
          border: 'border-[#FECACA] dark:border-[#6B2127]',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />,
          bg: 'bg-[#FFFFFF] dark:bg-[#152238]',
          border: 'border-[#BFDBFE] dark:border-[#243654]',
        };
    }
  };

  const s = getStyle();

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className={`p-3.5 rounded-lg border shadow-lg ${s.bg} ${s.border} text-[#0F172A] dark:text-[#F8FAFC] flex items-start gap-2.5`}
        >
          {s.icon}
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold leading-tight">{toast.title}</h4>
            {toast.message && (
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-normal">
                {toast.message}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] shrink-0"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
