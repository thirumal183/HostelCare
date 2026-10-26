import React, { useState } from 'react';
import { Complaint, ComplaintPriority, PRIORITY_DISPLAY } from '../../types/index.js';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface WardenAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint;
  onAssignWorker: (complaintId: string, workerId: number, priority?: ComplaintPriority) => Promise<void>;
  isDemoMode?: boolean;
}

const DEMO_WORKERS = [
  { id: 1, name: 'Rajesh Kumar', specialty: 'Plumbing' },
  { id: 2, name: 'Suresh Kumar', specialty: 'Electrical' },
  { id: 3, name: 'Vikram Singh', specialty: 'WiFi & Networking' },
  { id: 4, name: 'Mohan Lal', specialty: 'Carpentry & Furniture' },
];

export const WardenAssignModal: React.FC<WardenAssignModalProps> = ({
  isOpen,
  onClose,
  complaint,
  onAssignWorker,
  isDemoMode = false,
}) => {
  const [workerIdInput, setWorkerIdInput] = useState<string>(
    complaint.assigned_worker_id ? String(complaint.assigned_worker_id) : isDemoMode ? '2' : ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = parseInt(workerIdInput.trim(), 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      setError('Worker ID must be a positive integer (e.g. 101).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAssignWorker(complaint.id, parsedId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Worker assignment failed on server.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Assign staff technician
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Complaint #{complaint.complaint_code} · {complaint.category} · Room {complaint.room_number}
          </p>
        </div>

        {/* Complaint summary */}
        <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3 mb-4 text-xs space-y-1">
          <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{complaint.title}</p>
          <p className="text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{complaint.description}</p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1">
            Resident: {complaint.student_name}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-md bg-[#FEF2F2] dark:bg-[#321214] border border-[#FECACA] dark:border-[#6B2127] text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isDemoMode ? (
            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                Select technician (Demo staff roster)
              </label>
              <div className="space-y-1.5 mb-2.5">
                {DEMO_WORKERS.map(worker => (
                  <button
                    type="button"
                    key={worker.id}
                    onClick={() => setWorkerIdInput(String(worker.id))}
                    className={`w-full text-left px-3 py-2 text-xs rounded border transition-colors flex items-center justify-between ${
                      workerIdInput === String(worker.id)
                        ? 'bg-[#EFF6FF] dark:bg-[#1E2E4A] border-[#1D4ED8] dark:border-[#60A5FA] font-medium'
                        : 'bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div>
                      <p className="text-[#0F172A] dark:text-[#F8FAFC]">{worker.name}</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{worker.specialty}</p>
                    </div>
                    <span className="text-[11px] font-mono text-[#1D4ED8] dark:text-[#60A5FA]">
                      ID: {worker.id}
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Or enter specific Worker ID:
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={workerIdInput}
                  onChange={e => setWorkerIdInput(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                Technician Worker ID (Positive integer)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={workerIdInput}
                onChange={e => setWorkerIdInput(e.target.value)}
                placeholder="e.g. 101"
                className="w-full px-3 py-2 text-xs font-mono bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
              />
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
                Enter the numeric worker ID assigned to this repair task in the hostel database.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1F5F9] dark:border-[#1E2E4A]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !workerIdInput.trim()}
              className="px-4 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Assigning...' : 'Confirm assignment'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
