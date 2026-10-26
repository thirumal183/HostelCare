import React, { useState } from 'react';
import { BackendHealth } from '../../types/index.js';
import { api } from '../../services/api.js';
import { Server, CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { motion } from 'motion/react';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendHealth: BackendHealth | null;
  onHealthUpdated: () => void;
  onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  isOpen,
  onClose,
  backendHealth,
  onHealthUpdated,
  onShowToast,
}) => {
  const [apiUrl, setApiUrl] = useState(api.getBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<BackendHealth | null>(backendHealth);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl.trim()) return;

    api.setBaseUrl(apiUrl.trim());
    onHealthUpdated();
    if (onShowToast) {
      onShowToast('Target URL Saved', `Configured API endpoint: ${apiUrl.trim()}`, 'success');
    }
    onClose();
  };

  const handleReset = () => {
    api.resetBaseUrl();
    const defaultUrl = api.getBaseUrl();
    setApiUrl(defaultUrl);
    onHealthUpdated();
    if (onShowToast) {
      onShowToast('URL Reset', `Reverted to default: ${defaultUrl}`, 'info');
    }
  };

  const handleTestNow = async () => {
    setIsTesting(true);
    try {
      const res = await api.checkHealth();
      setTestResult(res);
      if (onShowToast) {
        if (res.isOnline) {
          onShowToast('Connection verified', 'Backend server responded to health check.', 'success');
        } else {
          onShowToast('Connection failed', 'Server did not respond.', 'error');
        }
      }
    } finally {
      setIsTesting(false);
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

        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
          <h2 className="text-base font-semibold">Backend connection settings</h2>
        </div>

        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-4 leading-relaxed">
          HostelCare connects directly to your separate Node.js + Express + MySQL server.
        </p>

        {/* Current status display */}
        <div className="bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md p-3.5 mb-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Server status (/api/health)</span>
            <span
              className={`font-medium flex items-center gap-1 ${
                testResult?.isOnline
                  ? 'text-[#059669] dark:text-[#34D399]'
                  : 'text-[#DC2626] dark:text-[#F87171]'
              }`}
            >
              {testResult?.isOnline ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Online
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Offline / Unreachable
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Database (/api/health/db)</span>
            <span
              className={`font-medium flex items-center gap-1 ${
                testResult?.dbConnected
                  ? 'text-[#059669] dark:text-[#34D399]'
                  : 'text-[#DC2626] dark:text-[#F87171]'
              }`}
            >
              {testResult?.dbConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected (MySQL)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Disconnected
                </>
              )}
            </span>
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E2E4A] flex items-center justify-between">
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {testResult?.isOnline ? 'Active backend connection' : 'Local demo preview active'}
            </span>
            <button
              type="button"
              onClick={handleTestNow}
              disabled={isTesting}
              className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA] hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
              Test connection
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
              Backend API Base URL
            </label>
            <input
              type="url"
              required
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="http://localhost:5000/api"
              className="w-full px-3 py-1.5 text-xs font-mono bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
            />
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              Default: <code className="font-mono">http://localhost:5000/api</code>
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] dark:border-[#1E2E4A]">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              Reset to default
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors"
              >
                Save URL
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
