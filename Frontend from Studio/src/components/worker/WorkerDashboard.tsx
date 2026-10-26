import React, { useState } from 'react';
import { Complaint, User } from '../../types/index.js';
import { StatusBadge } from '../common/StatusBadge.tsx';
import { PriorityBadge } from '../common/PriorityBadge.tsx';
import { api } from '../../services/api.js';
import {
  Wrench,
  CheckCircle2,
  Play,
  Search,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCcw,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkerDashboardProps {
  user: User;
  complaints: Complaint[];
  onUpdateStatus: (
    complaintId: string,
    status: 'IN_PROGRESS' | 'RESOLVED',
    note?: string
  ) => Promise<void>;
  isDemoMode?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  user,
  complaints,
  onUpdateStatus,
  isDemoMode = false,
  onRefresh,
  isRefreshing,
}) => {
  // Ticket ID manual lookup (works for both modes, essential in real API mode)
  const [lookupTicketId, setLookupTicketId] = useState('');
  const [lookedUpComplaint, setLookedUpComplaint] = useState<Complaint | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Status update modal
  const [targetJob, setTargetJob] = useState<Complaint | null>(null);
  const [statusType, setStatusType] = useState<'IN_PROGRESS' | 'RESOLVED'>('IN_PROGRESS');
  const [workerNote, setWorkerNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Demo jobs: filter relevant complaints for current technician
  const demoTickets = complaints.filter(c => {
    if (c.assigned_worker_name && user.name && c.assigned_worker_name.toLowerCase().includes(user.name.toLowerCase().split(' ')[0])) {
      return true;
    }
    if (user.category && c.category.toLowerCase() === user.category.toLowerCase()) {
      return true;
    }
    return true; // show sample jobs in demo mode
  });

  const activeTickets = isDemoMode ? demoTickets : complaints;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupTicketId.trim()) return;

    setIsLookingUp(true);
    setLookupError(null);
    setLookedUpComplaint(null);

    try {
      const cleanId = lookupTicketId.trim().replace(/^HC-0*/i, '').replace(/^#/, '');
      // First check within the loaded complaints list
      const matched = complaints.find(
        c => c.id === cleanId || c.complaint_code.toLowerCase() === lookupTicketId.trim().toLowerCase()
      );
      if (matched) {
        setLookedUpComplaint(matched);
        return;
      }

      if (!isDemoMode) {
        // In real API mode, workers only have permission to view their assigned complaints
        throw new Error(`Ticket #${lookupTicketId.trim()} is not in your assigned queue. Workers can only inspect tasks assigned to them.`);
      }

      const result = await api.getComplaintDetails(cleanId || lookupTicketId.trim());
      setLookedUpComplaint(result);
    } catch (err: any) {
      setLookupError(
        err.message ||
          `No complaint found with ID "${lookupTicketId}". Ensure the complaint exists in your assigned queue.`
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetJob) return;

    setIsSubmitting(true);
    setActionError(null);

    try {
      await onUpdateStatus(targetJob.id, statusType, workerNote.trim() || undefined);
      if (lookedUpComplaint && lookedUpComplaint.id === targetJob.id) {
        setLookedUpComplaint(prev =>
          prev ? { ...prev, status: statusType, resolution_notes: workerNote.trim() } : null
        );
      }
      setTargetJob(null);
      setWorkerNote('');
    } catch (err: any) {
      setActionError(err.message || 'Status update failed on server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Assigned work
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            <span>{user.name}</span>
            <span className="mx-1.5">·</span>
            <span>{user.category || 'Maintenance Technician'}</span>
            <span className="mx-1.5">·</span>
            <span>Worker ID: {user.userId || user.id}</span>
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] font-medium text-xs border border-[#E2E8F0] dark:border-[#243654] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh assigned jobs"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Ticket Lookup Box */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-4 shadow-sm">
        <h2 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
          Look up complaint by ticket ID
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-3">
          Enter ticket ID or number (e.g. 1 or HC-0001) to view complaint details and update status:
        </p>

        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              type="text"
              required
              value={lookupTicketId}
              onChange={e => setLookupTicketId(e.target.value)}
              placeholder="e.g. 1 or HC-0001"
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
            />
          </div>

          <button
            type="submit"
            disabled={isLookingUp || !lookupTicketId.trim()}
            className="w-full sm:w-auto px-4 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isLookingUp ? 'Searching...' : 'Find complaint'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {lookupError && (
          <div className="mt-3 p-2.5 rounded-md bg-[#FEF2F2] dark:bg-[#321214] border border-[#FECACA] dark:border-[#6B2127] text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{lookupError}</span>
          </div>
        )}

        {/* Found Ticket Card */}
        {lookedUpComplaint && (
          <div className="mt-4 p-4 rounded-md bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] dark:border-[#1E2E4A] pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                    #{lookedUpComplaint.complaint_code}
                  </span>
                  <StatusBadge status={lookedUpComplaint.status} size="sm" />
                  <PriorityBadge priority={lookedUpComplaint.priority} size="sm" />
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] mt-1">
                  {lookedUpComplaint.title}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {lookedUpComplaint.status !== 'IN_PROGRESS' && lookedUpComplaint.status !== 'RESOLVED' && lookedUpComplaint.status !== 'CLOSED' && (
                  <button
                    onClick={() => {
                      setTargetJob(lookedUpComplaint);
                      setStatusType('IN_PROGRESS');
                      setWorkerNote('');
                    }}
                    className="px-3 py-1.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium border border-[#E2E8F0] dark:border-[#243654] transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 text-[#1D4ED8] dark:text-[#60A5FA]" />
                    Start work
                  </button>
                )}

                {lookedUpComplaint.status !== 'RESOLVED' && lookedUpComplaint.status !== 'CLOSED' && (
                  <button
                    onClick={() => {
                      setTargetJob(lookedUpComplaint);
                      setStatusType('RESOLVED');
                      setWorkerNote('');
                    }}
                    className="px-3 py-1.5 rounded-md bg-[#059669] hover:bg-[#047857] text-white text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Mark resolved
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              {lookedUpComplaint.description}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Resident: <strong className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{lookedUpComplaint.student_name}</strong></span>
              <span>Room: <strong className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{lookedUpComplaint.room_number}</strong></span>
              <span>Hostel: <strong className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{lookedUpComplaint.hostel_name}</strong></span>
              <span>Category: <strong className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{lookedUpComplaint.category}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Assigned Work Roster (Live & Demo) */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9] dark:border-[#1E2E4A]">
          <div>
            <h2 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              {isDemoMode ? 'Sample Assigned Jobs (Demo Preview)' : 'My Assigned Complaints'}
            </h2>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {isDemoMode
                ? 'Interactive queue of mock work orders to evaluate technician workflows:'
                : 'Active maintenance tasks assigned to you by the hostel office:'}
            </p>
          </div>
          <span className="text-xs font-mono text-[#1D4ED8] dark:text-[#60A5FA]">
            {activeTickets.length} tasks
          </span>
        </div>

        {activeTickets.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-[#059669] opacity-70" />
            <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">No assigned complaints</p>
            <p className="mt-0.5">
              {isDemoMode
                ? 'No mock complaints matching this technician.'
                : 'You currently have no tasks assigned to you in the database.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E2E4A]">
            {activeTickets.map(ticket => (
              <div key={ticket.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                      #{ticket.complaint_code}
                    </span>
                    <StatusBadge status={ticket.status} size="sm" />
                    <PriorityBadge priority={ticket.priority} size="sm" />
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Room {ticket.room_number} {ticket.hostel_name ? `(${ticket.hostel_name})` : ''}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {ticket.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-1">
                    {ticket.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ticket.status !== 'IN_PROGRESS' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                    <button
                      onClick={() => {
                        setTargetJob(ticket);
                        setStatusType('IN_PROGRESS');
                        setWorkerNote('');
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#243654] transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 text-[#1D4ED8] dark:text-[#60A5FA]" />
                      Start
                    </button>
                  )}

                  {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                    <button
                      onClick={() => {
                        setTargetJob(ticket);
                        setStatusType('RESOLVED');
                        setWorkerNote('');
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-[#059669] hover:bg-[#047857] text-white transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Update Modal */}
      <AnimatePresence>
        {targetJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#152238] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg shadow-xl border border-[#E2E8F0] dark:border-[#243654] p-5 relative"
            >
              <button
                onClick={() => setTargetJob(null)}
                className="absolute right-4 top-4 p-1 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Update maintenance ticket
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  #{targetJob.complaint_code} · {targetJob.title}
                </p>
              </div>

              {actionError && (
                <div className="mb-4 p-2.5 rounded-md bg-[#FEF2F2] dark:bg-[#321214] border border-[#FECACA] dark:border-[#6B2127] text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <form onSubmit={handleStatusSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                    New status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusType('IN_PROGRESS')}
                      className={`py-2 px-3 text-xs rounded border text-center transition-colors flex items-center justify-center gap-1.5 ${
                        statusType === 'IN_PROGRESS'
                          ? 'bg-[#EFF6FF] dark:bg-[#1E2E4A] border-[#1D4ED8] dark:border-[#60A5FA] font-semibold text-[#1D4ED8] dark:text-[#60A5FA]'
                          : 'bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                      In Progress
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusType('RESOLVED')}
                      className={`py-2 px-3 text-xs rounded border text-center transition-colors flex items-center justify-center gap-1.5 ${
                        statusType === 'RESOLVED'
                          ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/30 border-[#059669] dark:border-[#34D399] font-semibold text-[#059669] dark:text-[#34D399]'
                          : 'bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                      Resolved
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                    Work notes / Explanation (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={workerNote}
                    onChange={e => setWorkerNote(e.target.value)}
                    placeholder={
                      statusType === 'RESOLVED'
                        ? 'Describe repair completed (e.g. Replaced washer valve in bathroom sink).'
                        : 'Describe current status (e.g. Parts acquired, replacing breaker now).'
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1F5F9] dark:border-[#1E2E4A]">
                  <button
                    type="button"
                    onClick={() => setTargetJob(null)}
                    className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Save status'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
