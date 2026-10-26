import React, { useState } from 'react';
import { User } from '../../types/index.js';
import { api } from '../../services/api.js';
import { KeyRound, Mail, Lock, Building2, DoorClosed, ArrowRight, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  onOpenLoginModal: () => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenLoginModal,
}) => {
  const [email, setEmail] = useState('');
  const [hostel, setHostel] = useState('');
  const [room, setRoom] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !hostel.trim() || !room.trim() || !activationKey.trim() || !password) {
      setError('Please provide your university email, hostel name, room number, activation key, and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Backend contract: POST /api/auth/activate with { email, hostel, room, activationKey, password }
      const res = await api.activateStudent({
        email: email.trim(),
        hostel: hostel.trim(),
        room: room.trim(),
        activationKey: activationKey.trim(),
        password,
      });

      if (res.token && res.user) {
        // Valid token returned, safely log user in
        onLoginSuccess(res.user);
        onClose();
      } else {
        // Successful activation without automatic session token: invite to sign in
        setSuccessMessage(res.message || 'Account activated successfully. Please sign in with your email and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Account activation failed. Please check your activation details or server connection.');
    } finally {
      setIsLoading(false);
    }
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
            Activate room account
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Registered residents can set their password using their room details and activation key.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-md bg-[#FEF2F2] dark:bg-[#321214] border border-[#FECACA] dark:border-[#6B2127] text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-[#ECFDF5] dark:bg-[#09291D] border border-[#A7F3D0] dark:border-[#115E41] text-xs text-[#047857] dark:text-[#6EE7B7] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Activation complete</p>
                <p className="mt-0.5 leading-relaxed">{successMessage}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLoginModal();
              }}
              className="w-full py-2 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              Sign in now
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                University email
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. student.bh3.thiru@hostelcare.test"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Hostel name
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={hostel}
                    onChange={e => setHostel(e.target.value)}
                    placeholder="e.g. BH-3"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Room number
                </label>
                <div className="relative">
                  <DoorClosed className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    placeholder="e.g. A-101"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                Activation key
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={activationKey}
                  onChange={e => setActivationKey(e.target.value)}
                  placeholder="Enter activation key"
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                Create password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? 'Activating account...' : 'Activate account'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#1E2E4A] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          Already activated?{' '}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLoginModal();
            }}
            className="text-[#1D4ED8] dark:text-[#60A5FA] font-medium hover:underline"
          >
            Sign in
          </button>
        </div>
      </motion.div>
    </div>
  );
};
