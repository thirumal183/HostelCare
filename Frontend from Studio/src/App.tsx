import React, { useState, useEffect, useCallback } from 'react';
import { BackendHealth, Complaint, ComplaintPriority, Role, User } from './types/index.js';
import { api, onAuthError } from './services/api.js';
import { Header } from './components/common/Header.tsx';
import { StudentDashboard } from './components/student/StudentDashboard.tsx';
import { WardenDashboard } from './components/warden/WardenDashboard.tsx';
import { WorkerDashboard } from './components/worker/WorkerDashboard.tsx';
import { RaiseComplaintModal } from './components/student/RaiseComplaintModal.tsx';
import { WardenAssignModal } from './components/warden/WardenAssignModal.tsx';
import { WardenDetailModal } from './components/warden/WardenDetailModal.tsx';
import { WardenEscalateModal } from './components/warden/WardenEscalateModal.tsx';
import { WardenAnalytics } from './components/warden/WardenAnalytics.tsx';
import { LoginModal } from './components/auth/LoginModal.tsx';
import { ActivationModal } from './components/auth/ActivationModal.tsx';
import { ProfileModal } from './components/common/ProfileModal.tsx';
import { BackendConfigModal } from './components/common/BackendConfigModal.tsx';
import { Toast, ToastState } from './components/common/Toast.tsx';
import { ArrowRight, RefreshCw, Server, User as UserIcon, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';

// Realistic sample complaints for local demo preview only
const INITIAL_DEMO_COMPLAINTS: Complaint[] = [
  {
    id: '1',
    complaint_code: 'HC-1001',
    student_id: 'alex-chen-01',
    student_name: 'Alex Chen',
    student_email: 'alex.chen@student.edu',
    student_phone: '+91 98765 43210',
    hostel_id: 'hostel-ganga',
    hostel_name: 'Ganga Hostel',
    room_number: 'B-204',
    category: 'Plumbing',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    title: 'Water tap leaking continuously in bathroom',
    description: 'The bathroom washbasin cold water tap has been leaking heavily since yesterday evening, flooding the floor tile drain area.',
    assigned_worker_id: '1',
    assigned_worker_name: 'Rajesh Kumar (Plumbing)',
    created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    timeline: [
      {
        id: 'hist-1',
        complaint_id: '1',
        previous_status: null,
        new_status: 'PENDING',
        updated_by_role: 'Student',
        updated_by_name: 'Alex Chen',
        notes: 'Complaint submitted by resident via portal.',
        created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
      },
      {
        id: 'hist-2',
        complaint_id: '1',
        previous_status: 'PENDING',
        new_status: 'ASSIGNED',
        updated_by_role: 'Warden',
        updated_by_name: 'Dr. Ramesh Kumar',
        notes: 'Assigned to plumbing technician Rajesh Kumar with High urgency.',
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      },
      {
        id: 'hist-3',
        complaint_id: '1',
        previous_status: 'ASSIGNED',
        new_status: 'IN_PROGRESS',
        updated_by_role: 'Worker',
        updated_by_name: 'Rajesh Kumar',
        notes: 'Inspected washer valve; fetching replacement seal from store.',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
    ],
  },
  {
    id: '2',
    complaint_code: 'HC-1002',
    student_id: 'alex-chen-01',
    student_name: 'Alex Chen',
    student_email: 'alex.chen@student.edu',
    student_phone: '+91 98765 43210',
    hostel_id: 'hostel-ganga',
    hostel_name: 'Ganga Hostel',
    room_number: 'B-204',
    category: 'Electrical',
    priority: 'CRITICAL',
    status: 'ASSIGNED',
    title: 'Power socket sparking when plugging laptop adapter',
    description: 'The desk power socket emits visible spark and buzzing hum whenever any charger is plugged in. Potential fire safety hazard.',
    assigned_worker_id: '2',
    assigned_worker_name: 'Suresh Kumar (Electrical)',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    timeline: [
      {
        id: 'hist-4',
        complaint_id: '2',
        previous_status: null,
        new_status: 'PENDING',
        updated_by_role: 'Student',
        updated_by_name: 'Alex Chen',
        notes: 'Flagged as high-urgency electrical hazard.',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'hist-5',
        complaint_id: '2',
        previous_status: 'PENDING',
        new_status: 'ASSIGNED',
        updated_by_role: 'Warden',
        updated_by_name: 'Dr. Ramesh Kumar',
        notes: 'Priority elevated to Critical. Assigned electrician Suresh Kumar.',
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      },
    ],
  },
  {
    id: '3',
    complaint_code: 'HC-1003',
    student_id: 'alex-chen-01',
    student_name: 'Alex Chen',
    student_email: 'alex.chen@student.edu',
    student_phone: '+91 98765 43210',
    hostel_id: 'hostel-ganga',
    hostel_name: 'Ganga Hostel',
    room_number: 'B-204',
    category: 'Wi-Fi',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    title: 'Wi-Fi access point in corridor drops connection frequently',
    description: 'Wi-Fi SSID Hostel_WiFi_B2 keeps disconnecting every 10-15 minutes, affecting video conferences and lecture access.',
    assigned_worker_id: '3',
    assigned_worker_name: 'Vikram Singh (Wi-Fi)',
    resolution_notes: 'Rebooted Cisco AP switch port and re-terminated patch cable. Speedtest verified 85 Mbps.',
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    timeline: [
      {
        id: 'hist-6',
        complaint_id: '3',
        previous_status: null,
        new_status: 'PENDING',
        updated_by_role: 'Student',
        updated_by_name: 'Alex Chen',
        notes: 'Ticket raised for network instability.',
        created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      },
      {
        id: 'hist-7',
        complaint_id: '3',
        previous_status: 'PENDING',
        new_status: 'RESOLVED',
        updated_by_role: 'Worker',
        updated_by_name: 'Vikram Singh',
        notes: 'AP port reconnected. Latency and signal test passed.',
        created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      },
    ],
  },
  {
    id: '4',
    complaint_code: 'HC-1004',
    student_id: 'student-priya-04',
    student_name: 'Priya Sharma',
    student_email: 'priya.sharma@student.edu',
    student_phone: '+91 98765 88990',
    hostel_id: 'hostel-ganga',
    hostel_name: 'Ganga Hostel',
    room_number: 'A-108',
    category: 'Furniture',
    priority: 'LOW',
    status: 'PENDING',
    title: 'Wardrobe door hinge loose and slipping off alignment',
    description: 'The right side cupboard door hinge has lost two screws and remains slightly ajar.',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    timeline: [
      {
        id: 'hist-8',
        complaint_id: '4',
        previous_status: null,
        new_status: 'PENDING',
        updated_by_role: 'Student',
        updated_by_name: 'Priya Sharma',
        notes: 'Ticket registered by resident.',
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      },
    ],
  },
];

const DEMO_USERS: Record<Role, User> = {
  STUDENT: {
    id: 'alex-chen-01',
    userId: 'alex-chen-01',
    name: 'Alex Chen',
    email: 'alex.chen@student.edu',
    role: 'STUDENT',
    hostel_name: 'Ganga Hostel',
    room_number: 'B-204',
    roll_number: '2023CS0142',
    phone: '+91 98765 43210',
  },
  WARDEN: {
    id: 'dr-ramesh-01',
    userId: 'dr-ramesh-01',
    name: 'Dr. Ramesh Kumar',
    email: 'dr.ramesh@hostelcare.edu',
    role: 'WARDEN',
    hostel_name: 'Hostel Operations Campus',
    phone: '+91 98765 00001',
  },
  WORKER: {
    id: '2',
    userId: '2',
    name: 'Suresh Kumar',
    email: 'suresh.electric@hostelcare.edu',
    role: 'WORKER',
    category: 'Electrical',
    phone: '+91 98765 00002',
    is_available: true,
  },
};

export const App: React.FC = () => {
  // Session & Demo state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  // Loading & refresh states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Modals state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);
  const [showRaiseModal, setShowRaiseModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showApiConfigModal, setShowApiConfigModal] = useState<boolean>(false);
  const [selectedComplaintForAssign, setSelectedComplaintForAssign] = useState<Complaint | null>(null);
  const [selectedComplaintForDetail, setSelectedComplaintForDetail] = useState<Complaint | null>(null);
  const [selectedComplaintForEscalate, setSelectedComplaintForEscalate] = useState<Complaint | null>(null);
  const [showAnalyticsView, setShowAnalyticsView] = useState<boolean>(false);

  // Helper toast notification
  const showToast = (title: string, message?: string, type: ToastState['type'] = 'info') => {
    setToast({ title, message, type });
  };

  // Enforce permanent clean light theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('hostelcare_theme', 'light');
  }, []);

  // Health verification
  const verifyHealth = useCallback(async () => {
    try {
      const health = await api.checkHealth();
      setBackendHealth(health);
    } catch {
      setBackendHealth({
        isOnline: false,
        dbConnected: false,
        apiUrl: api.getBaseUrl(),
        lastChecked: new Date().toISOString(),
      });
    }
  }, []);

  // Listen for 401 session expiration
  useEffect(() => {
    const unsubscribe = onAuthError(msg => {
      if (!isDemoMode) {
        // Only show the 'Session Expired' toast when the user WAS
        // already logged in. A 401 from a fresh login attempt is
        // shown inline inside LoginModal — the global toast is
        // misleading ("Session Expired") when no session existed.
        if (currentUser) {
          setCurrentUser(null);
          showToast('Session Expired', 'Your session has expired. Please sign in again.', 'error');
        }
      }
    });
    return unsubscribe;
  }, [isDemoMode, currentUser]);

  // Initial authentication & health check on startup
  useEffect(() => {
    verifyHealth();

    const token = api.getToken();
    if (token) {
      setIsLoading(true);
      api
        .getMe()
        .then(user => {
          setCurrentUser(user);
          setIsDemoMode(false);
          loadUserData(user);
        })
        .catch(() => {
          api.clearToken();
          setCurrentUser(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [verifyHealth]);

  // Fetch real complaints from backend in API mode
  const loadUserData = async (user: User) => {
    setIsRefreshing(true);
    try {
      if (user.role === 'STUDENT') {
        const studentComplaints = await api.getStudentComplaints();
        setComplaints(studentComplaints);
      } else if (user.role === 'WARDEN') {
        const wardenComplaints = await api.getWardenComplaints();
        setComplaints(wardenComplaints);
      } else {
        const workerComplaints = await api.getWorkerComplaints();
        setComplaints(workerComplaints);
      }
    } catch (err: any) {
      // In real API mode: show real error and do NOT load demo data
      showToast('Error', err.message || 'Failed to load complaints from backend server.', 'error');
      setComplaints([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real Login success handler
  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setShowLoginModal(false);
    setIsDemoMode(false);
    showToast('Signed in', `Welcome back, ${user.name}`, 'success');
    await loadUserData(user);
    verifyHealth();
  };

  // Explicit Demo Mode exploration handler (Never attempts real login, stays in local preview)
  const handleEnterDemo = (role: Role) => {
    setIsDemoMode(true);
    const demoUser = DEMO_USERS[role];
    setCurrentUser(demoUser);
    setComplaints(INITIAL_DEMO_COMPLAINTS);
    showToast(
      'Demo preview active',
      `Exploring interface as ${demoUser.name} (${role}). Changes are saved in local session only.`,
      'info'
    );
  };

  const handleLogout = () => {
    api.clearToken();
    setCurrentUser(null);
    setIsDemoMode(false);
    setComplaints([]);
    setShowAnalyticsView(false);
    showToast('Signed out', 'Session cleared.', 'info');
  };

  // Student Complaint Creation handler
  const handleComplaintCreated = async (demoComplaint?: Complaint) => {
    if (isDemoMode && demoComplaint) {
      setComplaints(prev => [demoComplaint, ...prev]);
      showToast('Complaint submitted', `Complaint #${demoComplaint.complaint_code} added (Demo preview).`, 'success');
      return;
    }

    if (!isDemoMode && currentUser) {
      // In real API mode: reload authentic complaints from server
      await loadUserData(currentUser);
      showToast('Complaint submitted', 'Your complaint was registered with the hostel office.', 'success');
    }
  };

  // Student Close Complaint
  const handleCloseStudentComplaint = async (complaintId: string, note?: string) => {
    if (!isDemoMode) {
      try {
        const updated = await api.closeStudentComplaint(complaintId, note);
        setComplaints(prev => prev.map(c => (c.id === complaintId ? updated : c)));
        showToast('Complaint closed', `Complaint #${updated.complaint_code} marked as closed.`, 'success');
        return;
      } catch (err: any) {
        showToast('Error', err.message, 'error');
        throw err;
      }
    }

    // Demo Mode: local update
    setComplaints(prev =>
      prev.map(c =>
        c.id === complaintId
          ? {
              ...c,
              status: 'CLOSED',
              timeline: [
                ...(c.timeline || []),
                {
                  id: `hist-${Date.now()}`,
                  complaint_id: complaintId,
                  previous_status: c.status,
                  new_status: 'CLOSED',
                  updated_by_role: 'Student',
                  updated_by_name: currentUser?.name || 'Alex Chen',
                  notes: note || 'Resident confirmed issue resolution.',
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );
    showToast('Complaint closed', 'Complaint marked as closed (Demo preview).', 'success');
  };

  // Student Reopen Complaint
  const handleReopenStudentComplaint = async (complaintId: string, note: string) => {
    if (!isDemoMode) {
      try {
        const updated = await api.reopenStudentComplaint(complaintId, note);
        setComplaints(prev => prev.map(c => (c.id === complaintId ? updated : c)));
        showToast('Complaint reopened', `Complaint #${updated.complaint_code} reopened for staff review.`, 'info');
        return;
      } catch (err: any) {
        showToast('Error', err.message, 'error');
        throw err;
      }
    }

    // Demo Mode: local update
    setComplaints(prev =>
      prev.map(c =>
        c.id === complaintId
          ? {
              ...c,
              status: 'PENDING',
              is_reopened: true,
              reopen_reason: note,
              timeline: [
                ...(c.timeline || []),
                {
                  id: `hist-${Date.now()}`,
                  complaint_id: complaintId,
                  previous_status: c.status,
                  new_status: 'PENDING',
                  updated_by_role: 'Student',
                  updated_by_name: currentUser?.name || 'Alex Chen',
                  notes: `Reopened by resident: ${note}`,
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );
    showToast('Complaint reopened', 'Complaint reopened for staff review (Demo preview).', 'info');
  };

  // Warden Assignment
  const handleAssignWorker = async (complaintId: string, workerId: number, priority?: ComplaintPriority) => {
    if (!isDemoMode) {
      try {
        const updated = await api.assignWorker(complaintId, workerId);
        if (priority && priority !== updated.priority) {
          await api.updatePriority(complaintId, priority);
        }
        if (currentUser) {
          await loadUserData(currentUser);
        }
        setSelectedComplaintForAssign(null);
        showToast('Technician assigned', `Assigned worker #${workerId} to complaint.`, 'success');
        return;
      } catch (err: any) {
        showToast('Error', err.message, 'error');
        throw err;
      }
    }

    // Demo Mode: local update
    setComplaints(prev =>
      prev.map(c =>
        c.id === complaintId
          ? {
              ...c,
              assigned_worker_name: `Technician #${workerId}`,
              assigned_worker_id: String(workerId),
              status: c.status === 'PENDING' ? 'ASSIGNED' : c.status,
              priority: priority || c.priority,
              timeline: [
                ...(c.timeline || []),
                {
                  id: `hist-${Date.now()}`,
                  complaint_id: complaintId,
                  previous_status: c.status,
                  new_status: 'ASSIGNED',
                  updated_by_role: 'Warden',
                  updated_by_name: currentUser?.name || 'Dr. Ramesh Kumar',
                  notes: `Assigned to technician #${workerId} (Demo preview).`,
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );
    setSelectedComplaintForAssign(null);
    showToast('Technician assigned', `Assigned technician #${workerId} (Demo preview).`, 'success');
  };

  // Warden Priority Update
  const handleUpdatePriority = async (complaintId: string, priority: ComplaintPriority) => {
    if (!isDemoMode) {
      try {
        const updated = await api.updatePriority(complaintId, priority);
        setComplaints(prev => prev.map(c => (c.id === complaintId ? updated : c)));
        showToast('Priority updated', `Priority set to ${priority}.`, 'success');
        return;
      } catch (err: any) {
        showToast('Error', err.message, 'error');
        throw err;
      }
    }

    // Demo Mode: local update
    setComplaints(prev =>
      prev.map(c => (c.id === complaintId ? { ...c, priority } : c))
    );
    showToast('Priority updated', `Priority changed to ${priority} (Demo preview).`, 'success');
  };

  // Worker Status Update
  const handleUpdateWorkerStatus = async (
    complaintId: string,
    status: 'IN_PROGRESS' | 'RESOLVED',
    note?: string
  ) => {
    if (!isDemoMode) {
      try {
        const updated = await api.updateWorkerStatus(complaintId, status, note);
        setComplaints(prev =>
          prev.map(c =>
            c.id === complaintId
              ? { ...c, status, resolution_notes: note || c.resolution_notes }
              : c
          )
        );
        if (currentUser) {
          await loadUserData(currentUser);
        }
        showToast('Status updated', `Complaint marked as ${status}.`, 'success');
        return;
      } catch (err: any) {
        showToast('Error', err.message, 'error');
        throw err;
      }
    }

    // Demo Mode: local update
    setComplaints(prev =>
      prev.map(c =>
        c.id === complaintId
          ? {
              ...c,
              status,
              resolution_notes: note || c.resolution_notes,
              timeline: [
                ...(c.timeline || []),
                {
                  id: `hist-${Date.now()}`,
                  complaint_id: complaintId,
                  previous_status: c.status,
                  new_status: status,
                  updated_by_role: 'Worker',
                  updated_by_name: currentUser?.name || 'Suresh Kumar',
                  notes: note || `Marked as ${status} by technician.`,
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : c
      )
    );
    showToast(
      'Status updated',
      `Marked as ${status === 'IN_PROGRESS' ? 'In Progress' : 'Resolved'} (Demo preview).`,
      'success'
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B132B] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col font-sans transition-colors duration-150">
      {/* Slim, Refined Header */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onEnterDemo={handleEnterDemo}
        onOpenActivationModal={() => setShowActivationModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenApiConfig={() => setShowApiConfigModal(true)}
        backendHealth={backendHealth}
        onCheckHealth={verifyHealth}
        isDemoMode={isDemoMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#64748B] dark:text-[#94A3B8]">
            <RefreshCw className="w-5 h-5 animate-spin text-[#1D4ED8] dark:text-[#60A5FA] mb-2.5" />
            <p className="text-xs">Loading HostelCare...</p>
          </div>
        ) : !currentUser ? (
          /* Visibly Spacious, Polished Editorial Landing Page */
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
            {/* Editorial Heading Section */}
            <div className="space-y-3.5 max-w-3xl">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#1D4ED8]">
                Hostel Operations & Maintenance
              </span>

              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0F172A] leading-tight">
                Your hostel, taken care of.
              </h1>

              <p className="text-sm sm:text-base text-[#64748B] max-w-2xl leading-relaxed">
                Report maintenance problems, follow their progress, and help keep your hostel running smoothly.
              </p>

              {/* Close-to-heading primary actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-5 py-2.5 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-medium text-xs transition-colors shadow-xs"
                >
                  Sign in
                </button>

                <button
                  onClick={() => setShowActivationModal(true)}
                  className="px-5 py-2.5 rounded-md bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#0F172A] font-medium text-xs border border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors"
                >
                  Activate room account
                </button>
              </div>
            </div>

            {/* Role Selector (Spacious, integrated panels with one clear action each) */}
            <div className="space-y-3.5 pt-1">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">
                  Explore role previews
                </h2>
                <span className="text-xs text-[#64748B]">
                  Interactive preview with local sample data
                </span>
              </div>

              {/* Balanced 3-column CSS Grid with generous, consistent card heights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
                {/* Student View */}
                <div className="h-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1D4ED8]">
                        Student resident
                      </span>
                      <span className="text-[11px] font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        Alex Chen
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-2.5 leading-relaxed">
                      Submit complaints, track room repair progress, and confirm resolution.
                    </p>
                  </div>

                  <button
                    onClick={() => handleEnterDemo('STUDENT')}
                    className="w-full py-2 px-3.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] text-xs font-medium text-[#0F172A] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors flex items-center justify-between"
                  >
                    <span>Preview student</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  </button>
                </div>

                {/* Warden View */}
                <div className="h-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1D4ED8]">
                        Hostel warden
                      </span>
                      <span className="text-[11px] font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        Dr. Ramesh
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-2.5 leading-relaxed">
                      Review incoming requests, triage urgency levels, and assign technicians.
                    </p>
                  </div>

                  <button
                    onClick={() => handleEnterDemo('WARDEN')}
                    className="w-full py-2 px-3.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] text-xs font-medium text-[#0F172A] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors flex items-center justify-between"
                  >
                    <span>Preview warden</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  </button>
                </div>

                {/* Worker View */}
                <div className="h-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-4 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1D4ED8]">
                        Maintenance worker
                      </span>
                      <span className="text-[11px] font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        Suresh Kumar
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-2.5 leading-relaxed">
                      Look up tickets by ID, record work notes, and mark repairs resolved.
                    </p>
                  </div>

                  <button
                    onClick={() => handleEnterDemo('WORKER')}
                    className="w-full py-2 px-3.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] text-xs font-medium text-[#0F172A] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-colors flex items-center justify-between"
                  >
                    <span>Preview worker</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  </button>
                </div>
              </div>
            </div>

            {/* How Maintenance Operates (Aligned 3-column layout) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 pt-1 text-xs">
              <div className="p-4 sm:p-5 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs space-y-1.5">
                <span className="font-semibold text-[#1D4ED8] text-xs">1. Report</span>
                <p className="text-[#64748B] leading-relaxed">
                  Students file issues with category, title, and room location.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs space-y-1.5">
                <span className="font-semibold text-[#1D4ED8] text-xs">2. Assign</span>
                <p className="text-[#64748B] leading-relaxed">
                  Wardens review queue, set urgency, and assign technicians.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs space-y-1.5">
                <span className="font-semibold text-[#1D4ED8] text-xs">3. Resolve</span>
                <p className="text-[#64748B] leading-relaxed">
                  Workers update progress and residents verify resolution.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboards */
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-4">
            {/* Clear Mode Banner */}
            {isDemoMode && (
              <div className="p-3 rounded-md bg-[#EFF6FF] dark:bg-[#1E2E4A] border border-[#BFDBFE] dark:border-[#2563EB]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-[#1D4ED8] dark:text-[#60A5FA]">
                  <span className="w-2 h-2 rounded-full bg-[#1D4ED8] dark:bg-[#60A5FA]" />
                  <span className="font-medium">Demo Mode active:</span>
                  <span className="text-[#64748B] dark:text-[#94A3B8]">
                    Simulating local actions. Changes are not written to the external MySQL database.
                  </span>
                </div>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline shrink-0 text-left"
                >
                  Sign in with real backend account →
                </button>
              </div>
            )}

            {/* Student View */}
            {currentUser.role === 'STUDENT' && (
              <StudentDashboard
                user={currentUser}
                complaints={complaints}
                onOpenRaiseModal={() => setShowRaiseModal(true)}
                onCloseComplaint={handleCloseStudentComplaint}
                onReopenComplaint={handleReopenStudentComplaint}
                onRefresh={() => (isDemoMode ? null : loadUserData(currentUser))}
                isRefreshing={isRefreshing}
              />
            )}

            {/* Warden View */}
            {currentUser.role === 'WARDEN' && !showAnalyticsView && (
              <WardenDashboard
                user={currentUser}
                complaints={complaints}
                onOpenAssignModal={c => setSelectedComplaintForAssign(c)}
                onOpenDetailModal={c => setSelectedComplaintForDetail(c)}
                onOpenEscalateModal={c => setSelectedComplaintForEscalate(c)}
                onOpenAnalytics={() => setShowAnalyticsView(true)}
                onRefresh={() => (isDemoMode ? null : loadUserData(currentUser))}
                isRefreshing={isRefreshing}
              />
            )}

            {/* Warden Analytics Sub-view */}
            {currentUser.role === 'WARDEN' && showAnalyticsView && (
              <WardenAnalytics
                complaints={complaints}
                onBack={() => setShowAnalyticsView(false)}
              />
            )}

            {/* Worker View */}
            {currentUser.role === 'WORKER' && (
              <WorkerDashboard
                user={currentUser}
                complaints={complaints}
                onUpdateStatus={handleUpdateWorkerStatus}
                isDemoMode={isDemoMode}
                onRefresh={() => (isDemoMode ? null : loadUserData(currentUser))}
                isRefreshing={isRefreshing}
              />
            )}
          </div>
        )}
      </main>

      {/* Raise Complaint Modal */}
      <RaiseComplaintModal
        isOpen={showRaiseModal}
        onClose={() => setShowRaiseModal(false)}
        onComplaintCreated={handleComplaintCreated}
        user={currentUser}
        isDemoMode={isDemoMode}
      />

      {/* Warden Assign Modal */}
      {selectedComplaintForAssign && (
        <WardenAssignModal
          isOpen={Boolean(selectedComplaintForAssign)}
          onClose={() => setSelectedComplaintForAssign(null)}
          complaint={selectedComplaintForAssign}
          onAssignWorker={handleAssignWorker}
          isDemoMode={isDemoMode}
        />
      )}

      {/* Warden Detail Modal */}
      {selectedComplaintForDetail && (
        <WardenDetailModal
          isOpen={Boolean(selectedComplaintForDetail)}
          onClose={() => setSelectedComplaintForDetail(null)}
          complaint={selectedComplaintForDetail}
          onUpdatePriority={handleUpdatePriority}
          onOpenAssignModal={c => {
            setSelectedComplaintForDetail(null);
            setSelectedComplaintForAssign(c);
          }}
        />
      )}

      {/* Warden Escalate Modal */}
      {selectedComplaintForEscalate && (
        <WardenEscalateModal
          isOpen={Boolean(selectedComplaintForEscalate)}
          onClose={() => setSelectedComplaintForEscalate(null)}
          complaint={selectedComplaintForEscalate}
        />
      )}

      {/* Real Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenActivationModal={() => {
          setShowLoginModal(false);
          setShowActivationModal(true);
        }}
      />

      {/* Real Activation Modal */}
      <ActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenLoginModal={() => {
          setShowActivationModal(false);
          setShowLoginModal(true);
        }}
      />

      {/* User Profile Modal */}
      {currentUser && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={currentUser}
        />
      )}

      {/* Backend API Configuration Modal */}
      <BackendConfigModal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        backendHealth={backendHealth}
        onHealthUpdated={verifyHealth}
        onShowToast={showToast}
      />

      {/* Toast Feedback Notification */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
