import React, { useState } from 'react';
import { Complaint, User } from '../../types/index.js';
import { StatusBadge } from '../common/StatusBadge.tsx';
import { PriorityBadge } from '../common/PriorityBadge.tsx';
import { api } from '../../services/api.js';
import {
  Search,
  Filter,
  BarChart3,
  Download,
  Eye,
  RefreshCcw,
  UserCheck,
} from 'lucide-react';

interface WardenDashboardProps {
  user: User;
  complaints: Complaint[];
  onOpenAssignModal: (complaint: Complaint) => void;
  onOpenEscalateModal: (complaint: Complaint) => void;
  onOpenDetailModal: (complaint: Complaint) => void;
  onOpenAnalytics: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const WardenDashboard: React.FC<WardenDashboardProps> = ({
  user,
  complaints,
  onOpenAssignModal,
  onOpenEscalateModal,
  onOpenDetailModal,
  onOpenAnalytics,
  onRefresh,
  isRefreshing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complaint_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.hostel_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || c.category === categoryFilter;
    const matchesPriority = priorityFilter === 'ALL' || c.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  const pendingCount = complaints.filter(c => c.status === 'PENDING').length;
  const criticalCount = complaints.filter(c => c.priority === 'CRITICAL' || c.priority === 'HIGH').length;
  const inProgressCount = complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-slate-200 dark:border-[#243654] rounded-xl p-5 shadow-premium-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              Hostel Complaints Management
            </h1>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
              {complaints.length} records
            </span>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-slate-800 dark:text-slate-200">{user.name}</span>
            <span>·</span>
            <span>{user.hostel_name || 'Hostel Operations'}</span>
            <span>·</span>
            <span>Full hostel oversight</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1E2E4A] hover:bg-slate-100 dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] font-medium text-xs border border-slate-200 dark:border-[#243654] transition-all shadow-premium-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="Refresh complaints"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onOpenAnalytics}
            className="px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#1E2E4A] hover:bg-slate-100 dark:hover:bg-[#283D61] text-blue-700 dark:text-blue-400 font-semibold text-xs border border-slate-200 dark:border-[#243654] transition-all shadow-premium-xs flex items-center gap-1.5 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => api.exportComplaintsCsv(filteredComplaints)}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-premium-xs hover:shadow-premium-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Counts Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-slate-200 dark:border-[#243654] rounded-xl p-4 shadow-premium-xs">
          <p className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Total complaints</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <p className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">{complaints.length}</p>
            <span className="text-[11px] font-medium text-slate-500">All registered</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-amber-200/80 dark:border-amber-900/40 rounded-xl p-4 shadow-premium-xs">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-400">Needs assignment</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{pendingCount}</p>
            <span className="text-[11px] font-medium text-amber-700/80">Pending queue</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-4 shadow-premium-xs">
          <p className="text-xs font-medium text-blue-800 dark:text-blue-400">In progress</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{inProgressCount}</p>
            <span className="text-[11px] font-medium text-blue-700/80">Active repairs</span>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-red-200/80 dark:border-red-900/40 rounded-xl p-4 shadow-premium-xs">
          <p className="text-xs font-medium text-red-800 dark:text-red-400">Urgent / High</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <p className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">{criticalCount}</p>
            <span className="text-[11px] font-medium text-red-700/80">Priority tickets</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] p-3 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search code, student, room..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#64748B] dark:placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
          >
            <option value="ALL">All priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
          >
            <option value="ALL">All categories</option>
            <option value="Electrical">Electrical</option>
            <option value="Plumbing">Plumbing</option>
            <option value="Wi-Fi">Wi-Fi</option>
            <option value="Furniture">Furniture</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Water">Water</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-[#0B132B] text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#243654]">
                <th className="py-2.5 px-4 font-medium">Code</th>
                <th className="py-2.5 px-4 font-medium">Student & Room</th>
                <th className="py-2.5 px-4 font-medium">Issue</th>
                <th className="py-2.5 px-4 font-medium">Priority</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Technician</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E2E4A]">
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B] dark:text-[#94A3B8]">
                    No complaints match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredComplaints.map(c => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]/80 dark:hover:bg-[#0B132B]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                      {c.complaint_code}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{c.student_name}</div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Room {c.room_number}</div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate">{c.title}</div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{c.category}</div>
                    </td>

                    <td className="py-3 px-4">
                      <PriorityBadge priority={c.priority} size="sm" />
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={c.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-[#64748B] dark:text-[#94A3B8]">
                      {c.assigned_worker_name ? (
                        <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{c.assigned_worker_name}</span>
                      ) : (
                        <span className="italic text-[#94A3B8]">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 sm:space-x-2">
                      {(c.priority === 'CRITICAL' || c.priority === 'HIGH') && (
                        <button
                          onClick={() => onOpenEscalateModal(c)}
                          className="px-2 py-1 rounded bg-[#FEF2F2] dark:bg-[#321214] hover:bg-[#FEE2E2] dark:hover:bg-[#481A1D] text-[#B91C1C] dark:text-[#FCA5A5] text-xs font-medium border border-[#FECACA] dark:border-[#6B2127] transition-colors"
                          title="Campus escalation info"
                        >
                          Escalate
                        </button>
                      )}

                      {c.status === 'PENDING' && (
                        <button
                          onClick={() => onOpenAssignModal(c)}
                          className="px-2.5 py-1 rounded bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium border border-[#E2E8F0] dark:border-[#243654] transition-colors"
                        >
                          Assign
                        </button>
                      )}

                      <button
                        onClick={() => onOpenDetailModal(c)}
                        className="px-2.5 py-1 rounded bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
