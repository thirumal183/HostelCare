import React from 'react';
import { Complaint, PRIORITY_DISPLAY } from '../../types/index.js';
import { ArrowLeft, BarChart3 } from 'lucide-react';

interface WardenAnalyticsProps {
  complaints: Complaint[];
  onBack: () => void;
}

export const WardenAnalytics: React.FC<WardenAnalyticsProps> = ({
  complaints,
  onBack,
}) => {
  const total = complaints.length;
  const pending = complaints.filter(c => c.status === 'PENDING').length;
  const inProgress = complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
  const resolved = complaints.filter(c => c.status === 'RESOLVED').length;
  const closed = complaints.filter(c => c.status === 'CLOSED').length;
  const critical = complaints.filter(c => c.priority === 'CRITICAL').length;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  complaints.forEach(c => {
    const cat = c.category || 'General';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });
  const categoryBreakdown = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
  }));

  // Priority breakdown
  const priorityOrder: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const priorityBreakdown = priorityOrder.map(pr => ({
    priority: pr,
    label: PRIORITY_DISPLAY[pr],
    count: complaints.filter(c => c.priority === pr).length,
  }));

  const resolutionRate = total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-medium flex items-center gap-1.5 border border-[#E2E8F0] dark:border-[#243654] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to complaints
        </button>

        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Calculated from {total} active records
        </span>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded-lg p-5 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Hostel maintenance overview
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Key metrics and repair breakdowns calculated from the current complaints list.
          </p>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Total complaints</span>
            <p className="text-xl font-semibold text-[#0F172A] dark:text-[#F8FAFC] mt-1">{total}</p>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Resolution rate</span>
            <p className="text-xl font-semibold text-[#059669] dark:text-[#34D399] mt-1">{resolutionRate}%</p>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">In progress</span>
            <p className="text-xl font-semibold text-[#1D4ED8] dark:text-[#60A5FA] mt-1">{inProgress}</p>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Critical urgency</span>
            <p className="text-xl font-semibold text-[#DC2626] dark:text-[#F87171] mt-1">{critical}</p>
          </div>
        </div>

        {/* Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Categories */}
          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Complaints by category
            </h3>
            <div className="space-y-2">
              {categoryBreakdown.map(item => (
                <div key={item.category} className="text-xs">
                  <div className="flex items-center justify-between mb-1 text-[#64748B] dark:text-[#94A3B8]">
                    <span>{item.category}</span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{item.count}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] dark:bg-[#1E2E4A] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1D4ED8] dark:bg-[#60A5FA] h-full rounded-full"
                      style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Complaints by priority
            </h3>
            <div className="space-y-2">
              {priorityBreakdown.map(item => (
                <div key={item.priority} className="text-xs">
                  <div className="flex items-center justify-between mb-1 text-[#64748B] dark:text-[#94A3B8]">
                    <span>{item.label}</span>
                    <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{item.count}</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] dark:bg-[#1E2E4A] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.priority === 'CRITICAL'
                          ? 'bg-[#DC2626]'
                          : item.priority === 'HIGH'
                          ? 'bg-[#EA580C]'
                          : item.priority === 'MEDIUM'
                          ? 'bg-[#D97706]'
                          : 'bg-[#64748B]'
                      }`}
                      style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
