import React, { useState } from 'react';
import { BackendHealth, formatRole, Role, User } from '../../types/index.js';
import {
  Building2,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Server,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onEnterDemo: (role: Role) => void;
  onOpenActivationModal: () => void;
  onOpenProfile: () => void;
  onOpenApiConfig: () => void;
  backendHealth: BackendHealth | null;
  onCheckHealth: () => void;
  isDemoMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onEnterDemo,
  onOpenActivationModal,
  onOpenProfile,
  onOpenApiConfig,
  backendHealth,
  isDemoMode = false,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#152238]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#243654] px-4 lg:px-8 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-medium shadow-premium-sm ring-1 ring-blue-700/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base sm:text-lg tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                HostelCare
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] hidden md:inline">
                ·
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] hidden md:inline font-normal">
                Complaints & maintenance
              </span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Backend Status indicator */}
          <button
            onClick={onOpenApiConfig}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
              backendHealth?.isOnline && !isDemoMode
                ? 'bg-[#ECFDF5] dark:bg-[#09291D] text-[#047857] dark:text-[#6EE7B7] border-[#A7F3D0] dark:border-[#115E41]'
                : isDemoMode
                ? 'bg-[#EFF6FF] dark:bg-[#0F2347] text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#1D3E78]'
                : 'bg-[#FEF2F2] dark:bg-[#321214] text-[#B91C1C] dark:text-[#FCA5A5] border-[#FECACA] dark:border-[#6B2127]'
            }`}
            title="Configure API connection"
          >
            <Server className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline text-[11px]">
              {backendHealth?.isOnline && !isDemoMode
                ? 'API connected'
                : isDemoMode
                ? 'Demo mode'
                : 'Backend offline'}
            </span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                backendHealth?.isOnline && !isDemoMode
                  ? 'bg-[#059669]'
                  : isDemoMode
                  ? 'bg-[#D97706]'
                  : 'bg-[#DC2626]'
              }`}
            />
          </button>

          {/* Role Preview Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#243654] transition-colors"
            >
              <span className="hidden sm:inline text-[#64748B] dark:text-[#94A3B8]">Role: </span>
              <span className="font-semibold">{user ? formatRole(user.role) : 'Preview'}</span>
              <ChevronDown className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" />
            </button>

            <AnimatePresence>
              {showRoleMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute right-0 mt-2 w-64 bg-[#FFFFFF] dark:bg-[#152238] rounded-lg shadow-lg border border-[#E2E8F0] dark:border-[#243654] p-1.5 z-50 text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <div className="px-3 py-2 border-b border-[#F1F5F9] dark:border-[#1E2E4A] mb-1">
                    <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Demo preview role</p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Switch local view to:</p>
                  </div>

                  <button
                    onClick={() => {
                      onEnterDemo('STUDENT');
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-[#F8FAFC] dark:hover:bg-[#1E2E4A] flex items-center justify-between text-xs transition-colors ${
                      user?.role === 'STUDENT' ? 'bg-[#EFF6FF] dark:bg-[#1E2E4A] font-semibold text-[#1D4ED8] dark:text-[#93C5FD]' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Alex Chen</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Room 204 · Student</p>
                    </div>
                    <span className="text-[11px] text-[#1D4ED8] dark:text-[#60A5FA]">Student</span>
                  </button>

                  <button
                    onClick={() => {
                      onEnterDemo('WARDEN');
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-[#F8FAFC] dark:hover:bg-[#1E2E4A] flex items-center justify-between text-xs transition-colors ${
                      user?.role === 'WARDEN' ? 'bg-[#EFF6FF] dark:bg-[#1E2E4A] font-semibold text-[#1D4ED8] dark:text-[#93C5FD]' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Dr. Ramesh</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Hostel Warden</p>
                    </div>
                    <span className="text-[11px] text-[#1D4ED8] dark:text-[#60A5FA]">Warden</span>
                  </button>

                  <button
                    onClick={() => {
                      onEnterDemo('WORKER');
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-[#F8FAFC] dark:hover:bg-[#1E2E4A] flex items-center justify-between text-xs transition-colors ${
                      user?.role === 'WORKER' ? 'bg-[#EFF6FF] dark:bg-[#1E2E4A] font-semibold text-[#1D4ED8] dark:text-[#93C5FD]' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Suresh Kumar</p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Electrician · Technician</p>
                    </div>
                    <span className="text-[11px] text-[#1D4ED8] dark:text-[#60A5FA]">Worker</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User profile / Logout if authenticated */}
          {user && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-[#E2E8F0] dark:border-[#243654]">
              <button
                onClick={onOpenProfile}
                className="p-2 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#243654] transition-colors"
                title="View user details"
              >
                <UserIcon className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onLogout}
                className="p-2 rounded-md bg-[#F1F5F9] dark:bg-[#1E2E4A] hover:bg-[#E2E8F0] dark:hover:bg-[#283D61] text-[#B91C1C] dark:text-[#FCA5A5] border border-[#E2E8F0] dark:border-[#243654] transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
