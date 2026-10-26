import React, { useState, useEffect } from 'react';
import { Complaint, ComplaintHistoryItem } from '../../types/index.js';
import { StatusBadge } from './StatusBadge.tsx';
import { api } from '../../services/api.js';
import { Clock, ArrowRight, RefreshCw } from 'lucide-react';

interface ComplaintTimelineProps {
  history?: ComplaintHistoryItem[];
  complaintId?: string;
  complaint?: Complaint;
}

export const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({
  history: propHistory,
  complaintId,
  complaint,
}) => {
  const [history, setHistory] = useState<ComplaintHistoryItem[]>(
    propHistory || complaint?.timeline || []
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (propHistory && propHistory.length > 0) {
      setHistory(propHistory);
      return;
    }

    if (complaint?.timeline && complaint.timeline.length > 0) {
      setHistory(complaint.timeline);
      return;
    }

    const targetId = complaintId || complaint?.id;
    if (targetId) {
      let isMounted = true;
      setIsLoading(true);

      api.getComplaintDetails(targetId)
        .then(details => {
          if (isMounted && details.timeline) {
            setHistory(details.timeline);
          }
        })
        .catch(() => {
          // Keep current state
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [propHistory, complaintId, complaint]);

  if (isLoading) {
    return (
      <div className="p-3 flex items-center justify-center text-xs text-[#64748B] dark:text-[#94A3B8] gap-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1D4ED8] dark:text-[#60A5FA]" />
        Loading history...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-[#64748B] dark:text-[#94A3B8] bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md">
        No status transitions recorded yet. Complaint is pending review.
      </div>
    );
  }

  return (
    <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0] dark:before:bg-[#243654]">
      {history.map((item, idx) => (
        <div key={item.id || idx} className="relative group">
          {/* Timeline node */}
          <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-[#FFFFFF] dark:bg-[#152238] border-2 border-[#1D4ED8] dark:border-[#60A5FA] flex items-center justify-center z-10" />

          <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5">
                {item.previous_status && (
                  <div className="flex items-center gap-1 opacity-70">
                    <StatusBadge status={item.previous_status} size="sm" />
                    <ArrowRight className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" />
                  </div>
                )}
                <StatusBadge status={item.new_status} size="sm" />
              </div>

              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {new Date(item.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <p className="text-[#0F172A] dark:text-[#F8FAFC] mt-1">{item.notes}</p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              By: {item.updated_by_name} ({item.updated_by_role})
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
