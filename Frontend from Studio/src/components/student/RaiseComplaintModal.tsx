import React, { useState } from 'react';
import { Complaint, ComplaintCategory, User } from '../../types/index.js';
import { api } from '../../services/api.js';
import { AlertCircle, X, Send } from 'lucide-react';
import { motion } from 'motion/react';

interface RaiseComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplaintCreated: (demoComplaint?: Complaint) => void;
  user: User | null;
  isDemoMode?: boolean;
}

const CATEGORIES: ComplaintCategory[] = [
  'Electrical',
  'Plumbing',
  'Wi-Fi',
  'Furniture',
  'Cleaning',
  'Water',
  'Other',
];

export const RaiseComplaintModal: React.FC<RaiseComplaintModalProps> = ({
  isOpen,
  onClose,
  onComplaintCreated,
  user,
  isDemoMode = false,
}) => {
  const [category, setCategory] = useState<ComplaintCategory>('Electrical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreset = (
    presetTitle: string,
    presetCategory: ComplaintCategory,
    presetDesc: string
  ) => {
    setTitle(presetTitle);
    setCategory(presetCategory);
    setDescription(presetDesc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    if (category.length > 50) {
      setError('Category must be 50 characters or fewer.');
      return;
    }
    if (title.trim().length > 150) {
      setError('Title must be 150 characters or fewer.');
      return;
    }
    if (description.trim().length > 2000) {
      setError('Description must be 2,000 characters or fewer.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!isDemoMode) {
        // Real API Mode: POST /api/complaints with { category, title, description }
        await api.createComplaint({
          category,
          title: title.trim(),
          description: description.trim(),
        });

        // Trigger refresh from server
        onComplaintCreated();
      } else {
        // Demo Mode: simulate local complaint addition
        const demoCode = `HC-${Math.floor(1000 + Math.random() * 9000)}`;
        const localComplaint: Complaint = {
          id: String(Date.now()),
          complaint_code: demoCode,
          student_id: user?.id || 'demo-student',
          student_name: user?.name || 'Alex Chen',
          student_email: user?.email,
          room_number: user?.room_number || 'B-204',
          hostel_name: user?.hostel_name || 'Ganga Hostel',
          title: title.trim(),
          description: description.trim(),
          category,
          priority: 'MEDIUM',
          status: 'PENDING',
          created_at: new Date().toISOString(),
          timeline: [
            {
              id: `hist-${Date.now()}`,
              complaint_id: String(Date.now()),
              previous_status: null,
              new_status: 'PENDING',
              updated_by_role: 'Student',
              updated_by_name: user?.name || 'Alex Chen',
              notes: 'Complaint submitted by resident.',
              created_at: new Date().toISOString(),
            },
          ],
        };
        onComplaintCreated(localComplaint);
      }

      onClose();
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit complaint.');
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
        className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#152238] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg shadow-xl border border-[#E2E8F0] dark:border-[#243654] p-6 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Report a maintenance problem
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Your request will be assigned to hostel maintenance staff.
          </p>
        </div>

        {/* Quick sample issues */}
        <div className="mb-4 p-3 bg-[#F8FAFC] dark:bg-[#0B132B] rounded-md border border-[#E2E8F0] dark:border-[#243654]">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1.5">
            Quick fill common issues:
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                handlePreset(
                  'Water tap dripping constantly',
                  'Plumbing',
                  'The bathroom sink tap cannot be shut tightly and has a steady stream of water leaking onto the floor.'
                )
              }
              className="px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded hover:border-[#1D4ED8] dark:hover:border-[#60A5FA] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
            >
              Water tap leak
            </button>

            <button
              type="button"
              onClick={() =>
                handlePreset(
                  'Ceiling light flickering repeatedly',
                  'Electrical',
                  'Main tube light fixture in study corner flickers intermittently and makes buzzing noise.'
                )
              }
              className="px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded hover:border-[#1D4ED8] dark:hover:border-[#60A5FA] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
            >
              Flickering light
            </button>

            <button
              type="button"
              onClick={() =>
                handlePreset(
                  'Corridor Wi-Fi drops connection',
                  'Wi-Fi',
                  'Room receives very low signal from hallway access point with frequent disconnects during class hours.'
                )
              }
              className="px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#152238] border border-[#E2E8F0] dark:border-[#243654] rounded hover:border-[#1D4ED8] dark:hover:border-[#60A5FA] text-[#0F172A] dark:text-[#F8FAFC] transition-colors"
            >
              Wi-Fi connection
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-md bg-[#FEF2F2] dark:bg-[#321214] border border-[#FECACA] dark:border-[#6B2127] text-xs text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`p-2 text-xs rounded border text-left transition-colors ${
                    category === cat
                      ? 'bg-[#EFF6FF] dark:bg-[#1E2E4A] border-[#1D4ED8] dark:border-[#60A5FA] font-medium text-[#1D4ED8] dark:text-[#93C5FD]'
                      : 'bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Problem summary (Title)
              </label>
              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {title.length}/150
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Bathroom washbasin faucet leaking continuously"
              className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Detailed description
              </label>
              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {description.length}/2000
              </span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={2000}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue, location in the room, and when it started..."
              className="w-full px-3 py-2 text-xs bg-[#F8FAFC] dark:bg-[#0B132B] border border-[#E2E8F0] dark:border-[#243654] rounded-md text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E2E4A]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim() || !description.trim()}
              className="px-4 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isLoading ? 'Submitting...' : 'Submit complaint'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
