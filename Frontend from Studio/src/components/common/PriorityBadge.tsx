import React from 'react';
import { ComplaintPriority, formatPriority, normalizePriority } from '../../types/index.js';

interface PriorityBadgeProps {
  priority: ComplaintPriority | string;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  const norm = normalizePriority(priority);
  const label = formatPriority(norm);

  // Clean, accessible priority styling for white & blue hostel theme
  const getStyles = () => {
    switch (norm) {
      case 'CRITICAL':
        return {
          dot: 'bg-[#DC2626] dark:bg-[#F87171]',
          text: 'text-[#B91C1C] dark:text-[#FCA5A5]',
          bg: 'bg-[#FEF2F2] dark:bg-[#321214]',
          border: 'border-[#FECACA] dark:border-[#6B2127]',
        };
      case 'HIGH':
        return {
          dot: 'bg-[#EA580C] dark:bg-[#FB923C]',
          text: 'text-[#C2410C] dark:text-[#FDBA74]',
          bg: 'bg-[#FFF7ED] dark:bg-[#311A0D]',
          border: 'border-[#FFEDD5] dark:border-[#6C3413]',
        };
      case 'MEDIUM':
        return {
          dot: 'bg-[#D97706] dark:bg-[#FBBF24]',
          text: 'text-[#B45309] dark:text-[#FCD34D]',
          bg: 'bg-[#FFFBEB] dark:bg-[#291E0A]',
          border: 'border-[#FDE68A] dark:border-[#5E4314]',
        };
      case 'LOW':
      default:
        return {
          dot: 'bg-[#64748B] dark:bg-[#94A3B8]',
          text: 'text-[#475569] dark:text-[#CBD5E1]',
          bg: 'bg-[#F8FAFC] dark:bg-[#152238]',
          border: 'border-[#E2E8F0] dark:border-[#243654]',
        };
    }
  };

  const s = getStyles();
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${padding} ${s.bg} ${s.text} ${s.border} transition-colors`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <span>{label}</span>
    </span>
  );
};
