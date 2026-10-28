import React from 'react';
import { ComplaintStatus, formatStatus, normalizeStatus } from '../../types/index.js';

interface StatusBadgeProps {
  status: ComplaintStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = normalizeStatus(status);
  const label = formatStatus(norm);

  // Clean, accessible status color tokens for white & blue hostel theme
  const getStyles = () => {
    switch (norm) {
      case 'PENDING':
        return {
          dot: 'bg-[#D97706] dark:bg-[#FBBF24]',
          text: 'text-[#B45309] dark:text-[#FCD34D]',
          bg: 'bg-[#FFFBEB] dark:bg-[#291E0A]',
          border: 'border-[#FDE68A] dark:border-[#5E4314]',
        };
      case 'ASSIGNED':
        return {
          dot: 'bg-[#0284C7] dark:bg-[#38BDF8]',
          text: 'text-[#0369A1] dark:text-[#7DD3FC]',
          bg: 'bg-[#F0F9FF] dark:bg-[#0B253A]',
          border: 'border-[#BAE6FD] dark:border-[#15466A]',
        };
      case 'IN_PROGRESS':
        return {
          dot: 'bg-[#2563EB] dark:bg-[#60A5FA]',
          text: 'text-[#1D4ED8] dark:text-[#93C5FD]',
          bg: 'bg-[#EFF6FF] dark:bg-[#0F2347]',
          border: 'border-[#BFDBFE] dark:border-[#1D3E78]',
        };
      case 'RESOLVED':
        return {
          dot: 'bg-[#059669] dark:bg-[#34D399]',
          text: 'text-[#047857] dark:text-[#6EE7B7]',
          bg: 'bg-[#ECFDF5] dark:bg-[#09291D]',
          border: 'border-[#A7F3D0] dark:border-[#115E41]',
        };
      case 'CLOSED':
      default:
        return {
          dot: 'bg-[#64748B] dark:bg-[#94A3B8]',
          text: 'text-[#475569] dark:text-[#CBD5E1]',
          bg: 'bg-[#F1F5F9] dark:bg-[#152238]',
          border: 'border-[#CBD5E1] dark:border-[#243654]',
        };
    }
  };

  const s = getStyles();
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${padding} ${s.bg} ${s.text} ${s.border} shadow-premium-xs transition-colors`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <span className="tracking-tight">{label}</span>
    </span>
  );
};
