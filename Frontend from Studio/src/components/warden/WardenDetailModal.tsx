import React, { useState, useEffect } from 'react';
import { Complaint, ComplaintPriority, PRIORITY_DISPLAY } from '../../types/index.js';
import { StatusBadge } from '../common/StatusBadge.tsx';
import { PriorityBadge } from '../common/PriorityBadge.tsx';
import { ComplaintTimeline } from '../common/ComplaintTimeline.tsx';
import { api } from '../../services/api.js';
import { X, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface WardenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint;
  onUpdatePriority: (complaintId: string, priority: ComplaintPriority) => Promise<void>;
  onOpenAssignModal: (complaint: Complaint) => void;
}

const PRIORITIES: ComplaintPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const WardenDetailModal: React.FC<WardenDetailModalProps> = ({
  isOpen,
  onClose,
  complaint: initialComplaint,
  onUpdatePriority,
  onOpenAssignModal,
}) => {
  const [complaint, setComplaint] = useState<Complaint>(initialComplaint);
  const [selectedPriority, setSelectedPriority] = useState<ComplaintPriority>(initialComplaint.priority);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setComplaint(initialComplaint);
    setSelectedPriority(initialComplaint.priority);
    setStatusMessage(null);

    if (isOpen && initialComplaint.id) {
      api.getWardenComplaintDetails(initialComplaint.id)
        .then(fresh => {
          setComplaint(fresh);
          setSelectedPriority(fresh.priority);
        })
        .catch(() => {
          // Keep local preview
        });
    }
  }, [isOpen, initialComplaint]);

  if (!isOpen) return null;

  const handlePriorityChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPriority === complaint.priority) return;

    setIsUpdatingPriority(true);
    setStatusMessage(null);
    try {
      await onUpdatePriority(complaint.id, selectedPriority);
      setComplaint(prev => ({ ...prev, priority: selectedPriority }));
      setStatusMessage(`Priority updated to ${PRIORITY_DISPLAY[selectedPriority]}.`);
    } catch (err: any) {
      setStatusMessage(`Failed to update priority: ${err.message}`);
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-xl bg-[#FFFFFF] dark:bg-[#152238] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg shadow-xl border border-[#E2E8F0] dark:border-[#243654] p-5 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start justify-between border-b border-[#F1F5F9] dark:border-[#1E2E4A] pb-3 mb-4 pr-6">
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                {complaint.complaint_code}
              </span>
              <span>·</span>
              <span>{complaint.category}</span>
            </div>
            <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{complaint.title}</h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityBadge priority={complaint.priority} size="sm" />
            <StatusBadge status={complaint.status} size="sm" />
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] dark:bg-[#0B132B] p-3 rounded border border-[#E2E8F0] dark:border-[#243654]">
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">Resident</p>
              <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{complaint.student_name}</p>
            </div>
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">Room & Hostel</p>
              <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                Room {complaint.room_number} ({complaint.hostel_name})
              </p>
            </div>
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">Assigned Technician</p>
              <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                {complaint.assigned_worker_name || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">Submitted on</p>
              <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                {new Date(complaint.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Description</p>
            <div className="bg-[#F8FAFC] dark:bg-[#0B132B] p-3 rounded border border-[#E2E8F0] dark:border-[#243654] leading-relaxed">
              {complaint.description}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#F1F5F9] dark:bg-[#1E2E4A] rounded border border-[#E2E8F0] dark:border-[#243654]">
            <form onSubmit={handlePriorityChange} className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Priority:</span>
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value as ComplaintPriority)}
                className="px-2 py-1 text-xs bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {PRIORITY_DISPLAY[p]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isUpdatingPriority || selectedPriority === complaint.priority}
                className="px-2.5 py-1 text-xs font-medium rounded bg-[#1D4ED8] hover:bg-[#1E40AF] text-white disabled:opacity-40 transition-colors"
              >
                {isUpdatingPriority ? 'Updating...' : 'Update'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAssignModal(complaint);
              }}
              className="px-3 py-1.5 rounded bg-[#FFFFFF] dark:bg-[#152238] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2E4A] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium border border-[#E2E8F0] dark:border-[#243654] transition-colors"
            >
              Assign technician
            </button>
          </div>

          {statusMessage && (
            <p className="text-xs text-[#059669] dark:text-[#34D399]">{statusMessage}</p>
          )}

          {/* Timeline */}
          <div>
            <p className="font-medium text-[#64748B] dark:text-[#94A3B8] mb-2">Activity history</p>
            <ComplaintTimeline complaint={complaint} />
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-[#F1F5F9] dark:border-[#1E2E4A]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#F1F5F9] dark:bg-[#1E2E4A] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
