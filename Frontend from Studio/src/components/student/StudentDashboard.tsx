import React, { useState } from 'react';
import { Complaint, formatPriority, formatStatus, User } from '../../types/index.js';
import { StatusBadge } from '../common/StatusBadge.tsx';
import { PriorityBadge } from '../common/PriorityBadge.tsx';
import { ComplaintTimeline } from '../common/ComplaintTimeline.tsx';
import {
  Plus,
  Search,
  RefreshCcw,
  Clock,
  ArrowRight,
  CheckCircle2,
  X,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentDashboardProps {
  user: User;
  complaints: Complaint[];
  onOpenRaiseModal: () => void;
  onCloseComplaint: (complaintId: string, reason?: string) => Promise<void>;
  onReopenComplaint: (complaintId: string, reason: string) => Promise<void>;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  complaints,
  onOpenRaiseModal,
  onCloseComplaint,
  onReopenComplaint,
  onRefresh,
  isRefreshing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Close complaint dialog
  const [closeTarget, setCloseTarget] = useState<Complaint | null>(null);
  const [closeReason, setCloseReason] = useState<string>('');
  const [isClosing, setIsClosing] = useState<boolean>(false);

  // Re-open complaint dialog
  const [reopenTarget, setReopenTarget] = useState<Complaint | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [isReopening, setIsReopening] = useState<boolean>(false);

  // Filter complaints
  const filteredComplaints = complaints.filter(c => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complaint_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = complaints.filter(c => c.status === 'PENDING').length;
  const inProgressCount = complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
  const resolvedCount = complaints.filter(c => c.status === 'RESOLVED').length;

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeTarget) return;
    setIsClosing(true);
    try {
      await onCloseComplaint(closeTarget.id, closeReason || undefined);
      setCloseTarget(null);
      setCloseReason('');
      if (selectedComplaint?.id === closeTarget.id) {
        setSelectedComplaint(prev => (prev ? { ...prev, status: 'CLOSED' } : null));
      }
    } finally {
      setIsClosing(false);
    }
  };

  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTarget || !reopenReason.trim()) return;
    setIsReopening(true);
    try {
      await onReopenComplaint(reopenTarget.id, reopenReason.trim());
      setReopenTarget(null);
      setReopenReason('');
      if (selectedComplaint?.id === reopenTarget.id) {
        setSelectedComplaint(prev => (prev ? { ...prev, status: 'PENDING' } : null));
      }
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Welcome & Action Header */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            My complaints
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            <span>{user.name}</span>
            <span className="mx-1.5">·</span>
            <span>{user.hostel_name || 'Hostel'}</span>
            <span className="mx-1.5">·</span>
            <span>Room {user.room_number || 'Room N/A'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] font-medium text-xs border border-[#E2E8F0] dark:border-[#243654] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh complaints"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={onOpenRaiseModal}
            className="px-4 py-2 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-medium text-xs shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Report problem
          </button>
        </div>
      </div>

      {/* Filter Toolbar (Segmented Buttons & Search) */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-3 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Interactive Segmented Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[#F8FAFC] dark:bg-[#0B132B] p-1 rounded-md border border-[#E2E8F0] dark:border-[#243654]">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-[#FFFFFF] dark:bg-[#152238] text-[#1D4ED8] dark:text-[#60A5FA] shadow-xs font-semibold'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            All ({complaints.length})
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              statusFilter === 'PENDING'
                ? 'bg-[#FFFFFF] dark:bg-[#152238] text-[#1D4ED8] dark:text-[#60A5FA] shadow-xs font-semibold'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            Pending ({pendingCount})
          </button>

          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-[#FFFFFF] dark:bg-[#152238] text-[#1D4ED8] dark:text-[#60A5FA] shadow-xs font-semibold'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            In progress ({inProgressCount})
          </button>

          <button
            onClick={() => setStatusFilter('RESOLVED')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              statusFilter === 'RESOLVED'
                ? 'bg-[#FFFFFF] dark:bg-[#152238] text-[#1D4ED8] dark:text-[#60A5FA] shadow-xs font-semibold'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search complaints..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
          />
        </div>
      </div>

      {/* Complaints List */}
      {filteredComplaints.length === 0 ? (
        <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-12 text-center">
          <Clock className="w-8 h-8 text-[#64748B] dark:text-[#94A3B8] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            No complaints found
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or filter criteria.'
              : 'You have not submitted any complaints yet. Click "Report problem" to request maintenance.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map(complaint => (
            <div
              key={complaint.id}
              className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] hover:border-[#CBD5E1] dark:hover:border-[#334155] rounded-lg p-4 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  {/* Unboxed metadata line with subtle bullets (Anti-pill discipline) */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    <span className="font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {complaint.complaint_code}
                    </span>
                    <span>·</span>
                    <span>{complaint.category}</span>
                    <span>·</span>
                    <span>Room {complaint.room_number}</span>
                    <span>·</span>
                    <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {complaint.title}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2 leading-relaxed">
                    {complaint.description}
                  </p>

                  {/* Technician note if present */}
                  {complaint.assigned_worker_name && (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1">
                      Assigned technician: <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">{complaint.assigned_worker_name}</span>
                    </p>
                  )}
                  {complaint.resolution_notes && (
                    <p className="text-[11px] text-[#059669] dark:text-[#34D399] pt-0.5">
                      Technician note: {complaint.resolution_notes}
                    </p>
                  )}
                </div>

                {/* Status & Actions Column */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F1F5F9] dark:border-[#1E2E4A]">
                  <div className="flex items-center gap-1.5">
                    <PriorityBadge priority={complaint.priority} size="sm" />
                    <StatusBadge status={complaint.status} size="sm" />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setSelectedComplaint(complaint)}
                      className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline"
                    >
                      View details
                    </button>

                    {complaint.status === 'RESOLVED' && (
                      <button
                        onClick={() => setCloseTarget(complaint)}
                        className="text-xs font-medium text-[#059669] dark:text-[#34D399] hover:underline"
                      >
                        Confirm fix
                      </button>
                    )}

                    {complaint.status === 'CLOSED' && (
                      <button
                        onClick={() => setReopenTarget(complaint)}
                        className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Complaint Detail Modal */}
      <AnimatePresence>
        {selectedComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col text-[#0F172A] dark:text-[#F8FAFC]"
            >
              <div className="p-4 border-b border-[#F1F5F9] dark:border-[#1E2E4A] flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {selectedComplaint.complaint_code}
                  </span>
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {selectedComplaint.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="p-1 rounded text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 text-xs">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedComplaint.status} size="sm" />
                  <PriorityBadge priority={selectedComplaint.priority} size="sm" />
                </div>

                <div>
                  <p className="font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">Description</p>
                  <p className="text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed bg-[#F8FAFC] dark:bg-[#0B132B] p-3 rounded border border-[#E2E8F0] dark:border-[#243654]">
                    {selectedComplaint.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] p-3 rounded border border-[#E2E8F0] dark:border-[#243654]">
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Category: </span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{selectedComplaint.category}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Room: </span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{selectedComplaint.room_number}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Technician: </span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {selectedComplaint.assigned_worker_name || 'Not yet assigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Submitted: </span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {new Date(selectedComplaint.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="font-medium text-[#64748B] dark:text-[#94A3B8] mb-2">History & updates</p>
                  <ComplaintTimeline complaint={selectedComplaint} />
                </div>
              </div>

              <div className="p-3 border-t border-[#F1F5F9] dark:border-[#1E2E4A] flex items-center justify-end gap-2">
                {selectedComplaint.status === 'RESOLVED' && (
                  <button
                    onClick={() => {
                      setCloseTarget(selectedComplaint);
                      setSelectedComplaint(null);
                    }}
                    className="px-3 py-1.5 rounded-md bg-[#059669] text-white text-xs font-medium hover:bg-[#047857] transition-colors"
                  >
                    Confirm fix & close
                  </button>
                )}
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="px-3 py-1.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Close Modal */}
      <AnimatePresence>
        {closeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg shadow-xl max-w-sm w-full p-5 text-[#0F172A] dark:text-[#F8FAFC]"
            >
              <h3 className="text-sm font-semibold mb-1">Confirm issue resolved</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-4">
                Has the issue in Room {closeTarget.room_number} been satisfactorily resolved?
              </p>

              <form onSubmit={handleConfirmClose} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                    Optional notes or feedback
                  </label>
                  <textarea
                    rows={2}
                    value={closeReason}
                    onChange={e => setCloseReason(e.target.value)}
                    placeholder="e.g. Verified tap is no longer leaking. Thanks!"
                    className="w-full p-2 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCloseTarget(null)}
                    className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isClosing}
                    className="px-3 py-1.5 rounded-md bg-[#059669] text-white text-xs font-medium hover:bg-[#047857] transition-colors"
                  >
                    {isClosing ? 'Closing...' : 'Confirm & close'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reopen Modal */}
      <AnimatePresence>
        {reopenTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg shadow-xl max-w-sm w-full p-5 text-[#0F172A] dark:text-[#F8FAFC]"
            >
              <h3 className="text-sm font-semibold mb-1">Reopen complaint</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-4">
                Please explain why this issue needs further attention:
              </p>

              <form onSubmit={handleConfirmReopen} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                    Reason for reopening *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                    placeholder="e.g. Pipe started leaking again this morning."
                    className="w-full p-2 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReopenTarget(null)}
                    className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isReopening || !reopenReason.trim()}
                    className="px-3 py-1.5 rounded-md bg-[#1D4ED8] text-white text-xs font-medium hover:bg-[#1E40AF] transition-colors disabled:opacity-50"
                  >
                    {isReopening ? 'Submitting...' : 'Reopen complaint'}
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
