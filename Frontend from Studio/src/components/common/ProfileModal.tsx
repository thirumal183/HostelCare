import React from 'react';
import { formatRole, User } from '../../types/index.js';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-sm bg-[#FFFFFF] dark:bg-[#152238] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg shadow-xl border border-[#E2E8F0] dark:border-[#243654] p-5 relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-[#1E2E4A] border border-[#BFDBFE] dark:border-[#243654] flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] font-semibold text-sm">
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-sm font-semibold">{user.name}</h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{formatRole(user.role)}</p>
          </div>
        </div>

        <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3.5 space-y-2 text-xs mb-4">
          <div className="flex justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Email</span>
            <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{user.email}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">User ID</span>
            <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC]">{user.userId || user.id}</span>
          </div>

          {user.hostel_name && (
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Hostel</span>
              <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{user.hostel_name}</span>
            </div>
          )}

          {user.room_number && (
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Room</span>
              <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{user.room_number}</span>
            </div>
          )}

          {user.roll_number && (
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Roll Number</span>
              <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{user.roll_number}</span>
            </div>
          )}

          {user.category && (
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Specialty</span>
              <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{user.category}</span>
            </div>
          )}
        </div>

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
