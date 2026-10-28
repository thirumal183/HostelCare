import React, { useState } from 'react';
import { User } from '../../types/index.js';
import { api } from '../../services/api.js';
import { Lock, Mail, ArrowRight, X, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  onOpenActivationModal: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenActivationModal,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Backend contract: POST /api/auth/login with { email, password } only
      const res = await api.login({
        email: email.trim(),
        password,
      });

      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials or server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillWarden = () => {
    setEmail('warden.bh3@hostelcare.test');
    setPassword('Warden@123');
    setError(null);
  };

  const handleFillWorker = () => {
    setEmail('worker.bh3.electrical@hostelcare.test');
    setPassword('Worker@123');
    setError(null);
  };

  const handleFillStudent = () => {
    setEmail('student.bh3.thiru@hostelcare.test');
    setPassword('Student@123');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#152238] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg shadow-xl border border-[#E2E8F0] dark:border-[#243654] p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Sign in to HostelCare
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Enter your university credentials to access your account:
          </p>
        </div>

        {/* Quick Demo Fill Buttons */}
        <div className="mb-4 p-2.5 bg-[#F8FAFC] dark:bg-[#0B132B] rounded-md border border-[#E2E8F0] dark:border-[#243654] space-y-1.5">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
            Quick fill seeded test accounts:
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleFillWarden}
              className="px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded hover:border-[#1D4ED8] dark:hover:border-[#60A5FA] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
            >
              Warden Demo
            </button>
            <button
              type="button"
              onClick={handleFillWorker}
              className="px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded hover:border-[#1D4ED8] dark:hover:border-[#60A5FA] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
            >
              Worker Demo
            </button>
            <button
              type="button"
              onClick={handleFillStudent}
              className="px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded hover:border-[#1D4ED8] dark:hover:border-[#60A5FA] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
              title="Demo student resident account (Room A-101)"
            >
              Student Demo
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-md bg-[#FEF2F2] dark:bg-[#321214] border border-[#FECACA] dark:border-[#6B2127] text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E2E4A] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          New student resident?{' '}
          <button
            type="button"
            onClick={onOpenActivationModal}
            className="text-[#1D4ED8] dark:text-[#60A5FA] font-medium hover:underline"
          >
            Activate room account
          </button>
        </div>
      </motion.div>
    </div>
  );
};
