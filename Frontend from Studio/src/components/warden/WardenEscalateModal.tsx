import React from 'react';
import { Complaint } from '../../types/index.js';
import { X, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface WardenEscalateModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint;
}

export const WardenEscalateModal: React.FC<WardenEscalateModalProps> = ({
  isOpen,
  onClose,
  complaint,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#152238] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg shadow-xl border border-[#E2E8F0] dark:border-[#243654] p-5 relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          <h2 className="text-base font-semibold">Campus facility escalation</h2>
        </div>

        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-3">
          Complaint #{complaint.complaint_code} ({complaint.category})
        </p>

        <div className="p-3 bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded text-xs space-y-1 mb-4">
          <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{complaint.title}</p>
          <p className="text-[#64748B] dark:text-[#94A3B8]">
            Room {complaint.room_number} · Resident: {complaint.student_name}
          </p>
        </div>

        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed mb-4">
          Emergency work orders requiring campus-wide contractor dispatch can be logged directly with University Estate Management at <strong className="text-[#0F172A] dark:text-[#F8FAFC]">ext. 4401</strong>.
        </p>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[#F1F5F9] dark:bg-[#1E2E4A] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
