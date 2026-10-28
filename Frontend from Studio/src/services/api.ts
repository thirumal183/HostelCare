import {
  AuthResponse,
  BackendHealth,
  Complaint,
  ComplaintHistoryItem,
  ComplaintPriority,
  ComplaintStatus,
  normalizePriority,
  normalizeRole,
  normalizeStatus,
  Role,
  User,
} from '../types/index.js';

// Base URL resolution: Environment variable > LocalStorage override > Localhost default
const DEFAULT_API_BASE = 'http://localhost:5000/api';
const DEFAULT_PROD_API_BASE = 'https://hostelcare-0xtu.onrender.com/api';

function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('hostelcare_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // When running in a deployed web environment outside local loopback, default to the production Render backend
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return DEFAULT_PROD_API_BASE;
  }
  return DEFAULT_API_BASE;
}

// Session expiration listener
type AuthErrorListener = (message: string) => void;
const authErrorListeners: Set<AuthErrorListener> = new Set();

export function onAuthError(listener: AuthErrorListener): () => void {
  authErrorListeners.add(listener);
  return () => authErrorListeners.delete(listener);
}

function notifyAuthError(message: string) {
  authErrorListeners.forEach(listener => listener(message));
}

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('hostelcare_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Handles HTTP responses: unboxes JSON, handles HTTP error codes,
 * and clears session automatically on 401 Unauthorized / 403 Forbidden.
 */
async function handleResponse<T>(res: Response, endpoint: string): Promise<T> {
  let data: any = null;
  const contentType = res.headers.get('content-type');

  if (contentType && contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await res.text();
      data = text ? { message: text } : {};
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hostelcare_token');
      }
      const msg = data?.message || data?.error || 'Your authentication session has expired. Please sign in again.';
      notifyAuthError(msg);
      throw new Error(msg);
    }

    if (res.status === 403) {
      const msg = data?.message || data?.error || 'Access denied. You do not have permissions for this action.';
      throw new Error(msg);
    }

    const errorMessage =
      data?.error ||
      data?.message ||
      data?.details ||
      `Request to ${endpoint} failed with HTTP status ${res.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

/**
 * Normalizes raw User response from backend into a consistent structure.
 * Contract: user object containing userId and role (minimum required by GET /api/auth/me).
 * Preserves optional name, email, hostel, room if present.
 */
export function normalizeUser(raw: any): User {
  if (!raw) {
    throw new Error('Received empty user profile from server.');
  }

  const userId = String(raw.userId || raw.id || raw.student_id || raw.warden_id || raw.worker_id || '');
  const role = normalizeRole(raw.role);
  
  // Gracefully handle missing optional fields without inventing fake identities
  const defaultName = role === 'STUDENT' ? 'Student Resident' : role === 'WARDEN' ? 'Hostel Warden' : 'Staff Technician';
  const name = String(raw.name || raw.fullName || raw.username || defaultName);
  const email = String(raw.email || '');

  return {
    id: userId,
    userId,
    name,
    email,
    role,
    hostel_id: raw.hostel_id || raw.hostelId || undefined,
    hostel_name: raw.hostel_name || raw.hostelName || undefined,
    room_number: raw.room_number || raw.roomNumber || undefined,
    roll_number: raw.roll_number || raw.rollNumber || undefined,
    phone: raw.phone || raw.phoneNumber || undefined,
    block: raw.block || undefined,
    category: raw.category || raw.department || undefined,
    is_available: raw.is_available ?? raw.isAvailable ?? true,
  };
}

/**
 * Normalizes raw Complaint record from MySQL into the frontend interface.
 * Uses complaintId as supported source for normalized complaint identifier.
 * Does not fabricate missing student, hostel, room, or worker details.
 */
export function normalizeComplaint(raw: any): Complaint {
  if (!raw) {
    throw new Error('Received malformed complaint record.');
  }

  const id = String(raw.complaintId || raw.id || raw.complaint_id || '');
  const complaintCode =
    raw.complaint_code ||
    raw.complaintCode ||
    raw.code ||
    (id ? `HC-${id.padStart(4, '0')}` : 'HC-TICKET');

  const status = normalizeStatus(raw.status);
  const priority = normalizePriority(raw.priority);

  // Normalize history entries if present: { historyId, oldStatus, newStatus, note, changedAt }
  let timeline: ComplaintHistoryItem[] | undefined;
  const rawTimeline = raw.timeline || raw.history || raw.status_history;
  if (Array.isArray(rawTimeline)) {
    timeline = rawTimeline.map((item: any, idx: number) => ({
      id: String(item.historyId || item.history_id || item.id || idx),
      complaint_id: String(item.complaintId || item.complaint_id || id),
      previous_status: item.oldStatus
        ? normalizeStatus(item.oldStatus)
        : item.previous_status
        ? normalizeStatus(item.previous_status)
        : null,
      new_status: normalizeStatus(item.newStatus || item.new_status || item.status),
      updated_by_role: String(item.updated_by_role || item.role || 'Staff'),
      updated_by_name: String(item.updated_by_name || item.name || 'System'),
      notes: String(item.note || item.notes || item.remarks || item.comment || ''),
      created_at: item.changedAt || item.created_at || item.createdAt || new Date().toISOString(),
    }));
  }

  return {
    id,
    complaint_code: complaintCode,
    student_id: raw.student_id || raw.studentId ? String(raw.student_id || raw.studentId) : undefined,
    student_name: raw.student_name || raw.studentName || raw.student?.name || (raw.student_id ? `Student #${raw.student_id}` : 'Student'),
    student_email: raw.student_email || raw.studentEmail || raw.student?.email,
    student_phone: raw.student_phone || raw.studentPhone || raw.student?.phone,
    hostel_id: raw.hostel_id || raw.hostelId,
    hostel_name: raw.hostel_name || raw.hostelName || 'Hostel',
    room_number: raw.room_number || raw.roomNumber || 'Room N/A',
    category: String(raw.category || 'General Maintenance'),
    priority,
    status,
    title: String(raw.title || raw.subject || 'Complaint Ticket'),
    description: String(raw.description || raw.details || ''),
    assigned_worker_id:
      raw.assigned_worker_id || raw.assignedWorkerId || raw.worker_id || raw.workerId
        ? String(raw.assigned_worker_id || raw.assignedWorkerId || raw.worker_id || raw.workerId)
        : undefined,
    assigned_worker_name: raw.assigned_worker_name || raw.assignedWorkerName || raw.worker?.name,
    assigned_worker_phone: raw.assigned_worker_phone || raw.assignedWorkerPhone || raw.worker?.phone,
    scheduled_time: raw.scheduled_time || raw.scheduledTime,
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    updated_at: raw.updated_at || raw.updatedAt,
    is_reopened: Boolean(raw.is_reopened ?? raw.isReopened ?? (status === 'PENDING' && raw.reopen_reason)),
    reopen_reason: raw.reopen_reason || raw.reopenReason || raw.note,
    resolution_notes: raw.resolution_notes || raw.resolutionNotes || raw.remarks || raw.note,
    timeline,
  };
}

/**
 * Centralized API Service for HostelCare.
 * Matches exact backend contract for Node.js + Express + MySQL.
 * Strictly separates real API communication from local demo operations.
 */
export const api = {
  // Config & Base URL
  getBaseUrl(): string {
    return resolveApiBase();
  },

  setBaseUrl(newUrl: string): void {
    if (typeof window !== 'undefined') {
      const clean = newUrl.trim().replace(/\/+$/, '');
      localStorage.setItem('hostelcare_api_url', clean);
    }
  },

  resetBaseUrl(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hostelcare_api_url');
    }
  },

  // Token Management
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('hostelcare_token');
  },

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hostelcare_token', token);
    }
  },

  clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hostelcare_token');
    }
  },

  // Health Checks: GET /api/health and GET /api/health/db
  async checkHealth(targetUrl?: string): Promise<BackendHealth> {
    const base = targetUrl ? targetUrl.trim().replace(/\/+$/, '') : this.getBaseUrl();
    let isOnline = false;
    let dbConnected = false;
    let errorDetails: string | undefined;

    try {
      const healthRes = await fetch(`${base}/health`, { method: 'GET' });
      isOnline = healthRes.ok;
    } catch (err: any) {
      isOnline = false;
      errorDetails = `Cannot reach ${base}/health: ${err.message || 'Server offline'}`;
    }

    if (isOnline) {
      try {
        const dbRes = await fetch(`${base}/health/db`, { method: 'GET' });
        dbConnected = dbRes.ok;
      } catch {
        dbConnected = false;
      }
    }

    return {
      isOnline,
      dbConnected,
      apiUrl: base,
      lastChecked: new Date().toISOString(),
      error: errorDetails,
    };
  },

  /**
   * Authentication: POST /api/auth/login
   * Body must contain only: { email, password }
   * Response envelope: { success: true, message: "...", data: { token: "...", user: { ... } } }
   */
  async login(payload: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.password,
      }),
    });

    const response = await handleResponse<any>(res, '/api/auth/login');
    const envelope = response?.data || response;
    const token = envelope?.token || response?.token;

    if (!token) {
      throw new Error('Authentication response did not contain a valid JWT token.');
    }

    const rawUser = envelope?.user || response?.user;
    if (!rawUser) {
      throw new Error('Authentication response did not contain user data.');
    }

    const user = normalizeUser(rawUser);
    this.setToken(token);
    return { token, user };
  },

  /**
   * Authentication: POST /api/auth/activate
   * Body: { email, hostel, room, activationKey, password }
   */
  async activateStudent(payload: {
    email: string;
    hostel: string;
    room: string;
    activationKey: string;
    password: string;
  }): Promise<{ token?: string; user?: User; message: string }> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/auth/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: payload.email.trim(),
        hostel: payload.hostel.trim(),
        room: payload.room.trim(),
        activationKey: payload.activationKey,
        password: payload.password,
      }),
    });

    const response = await handleResponse<any>(res, '/api/auth/activate');
    const envelope = response?.data || response;
    const token = envelope?.token || response?.token;
    const rawUser = envelope?.user || response?.user;

    let user: User | undefined;
    if (token && rawUser) {
      this.setToken(token);
      user = normalizeUser(rawUser);
    }

    return {
      token,
      user,
      message: response?.message || envelope?.message || 'Student account activated successfully.',
    };
  },

  /**
   * Current session: GET /api/auth/me
   * Backend returns { userId, role } inside response or response.data
   */
  async getMe(): Promise<User> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const response = await handleResponse<any>(res, '/api/auth/me');
    const rawUser = response?.data?.user || response?.data || response?.user || response;
    return normalizeUser(rawUser);
  },

  /**
   * Student: POST /api/complaints
   * Body: { category, title, description }
   * Category <= 50 chars, title <= 150 chars, description <= 2000 chars.
   * Returns compact result: { complaintId, status, priority, ... }
   */
  async createComplaint(payload: {
    category: string;
    title: string;
    description: string;
  }): Promise<{ complaintId: string | number; status: string; priority: string }> {
    if (payload.category.length > 50) {
      throw new Error('Category must be 50 characters or fewer.');
    }
    if (payload.title.trim().length > 150) {
      throw new Error('Title must be 150 characters or fewer.');
    }
    if (payload.description.trim().length > 2000) {
      throw new Error('Description must be 2,000 characters or fewer.');
    }

    const base = this.getBaseUrl();
    const res = await fetch(`${base}/complaints`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        category: payload.category.trim(),
        title: payload.title.trim(),
        description: payload.description.trim(),
      }),
    });

    const response = await handleResponse<any>(res, '/api/complaints');
    const data = response?.data || response;
    return {
      complaintId: data.complaintId || data.id || data.complaint_id,
      status: data.status || 'PENDING',
      priority: data.priority || 'MEDIUM',
    };
  },

  /**
   * Student: GET /api/complaints
   * List unwrapped from data.complaints or data
   */
  async getStudentComplaints(): Promise<Complaint[]> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/complaints`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const response = await handleResponse<any>(res, '/api/complaints');
    const envelope = response?.data || response;
    const rawList = Array.isArray(envelope?.complaints)
      ? envelope.complaints
      : Array.isArray(envelope)
      ? envelope
      : Array.isArray(response?.complaints)
      ? response.complaints
      : [];

    return rawList.map(normalizeComplaint);
  },

  /**
   * Complaint Details & History: GET /api/complaints/:id
   */
  async getComplaintDetails(id: string): Promise<Complaint> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/complaints/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const response = await handleResponse<any>(res, `/api/complaints/${id}`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    const normalized = normalizeComplaint(rawComplaint);

    // Parse separate history array if returned
    const rawHistory = envelope?.history || response?.history;
    if (Array.isArray(rawHistory)) {
      normalized.timeline = rawHistory.map((item: any, idx: number) => ({
        id: String(item.historyId || item.history_id || item.id || idx),
        complaint_id: String(id),
        previous_status: item.oldStatus
          ? normalizeStatus(item.oldStatus)
          : item.previous_status
          ? normalizeStatus(item.previous_status)
          : null,
        new_status: normalizeStatus(item.newStatus || item.new_status || item.status),
        updated_by_role: String(item.updated_by_role || item.role || 'Staff'),
        updated_by_name: String(item.updated_by_name || item.name || 'System'),
        notes: String(item.note || item.notes || item.remarks || ''),
        created_at: item.changedAt || item.created_at || item.createdAt || new Date().toISOString(),
      }));
    }

    return normalized;
  },

  /**
   * Student: PATCH /api/student/complaints/:id/close
   * Body: { note?: string }
   */
  async closeStudentComplaint(id: string, note?: string): Promise<Complaint> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/student/complaints/${encodeURIComponent(id)}/close`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(note ? { note: note.trim() } : {}),
    });

    const response = await handleResponse<any>(res, `/api/student/complaints/${id}/close`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    return normalizeComplaint(rawComplaint);
  },

  /**
   * Student: PATCH /api/student/complaints/:id/reopen
   * Body: { note: string }
   */
  async reopenStudentComplaint(id: string, note: string): Promise<Complaint> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/student/complaints/${encodeURIComponent(id)}/reopen`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note: note.trim() }),
    });

    const response = await handleResponse<any>(res, `/api/student/complaints/${id}/reopen`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    return normalizeComplaint(rawComplaint);
  },

  /**
   * Warden: GET /api/warden/complaints
   * List unwrapped from data.complaints or data
   */
  async getWardenComplaints(): Promise<Complaint[]> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/warden/complaints`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const response = await handleResponse<any>(res, '/api/warden/complaints');
    const envelope = response?.data || response;
    const rawList = Array.isArray(envelope?.complaints)
      ? envelope.complaints
      : Array.isArray(envelope)
      ? envelope
      : Array.isArray(response?.complaints)
      ? response.complaints
      : [];

    return rawList.map(normalizeComplaint);
  },

  /**
   * Warden: GET /api/warden/complaints/:id
   */
  async getWardenComplaintDetails(id: string): Promise<Complaint> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/warden/complaints/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const response = await handleResponse<any>(res, `/api/warden/complaints/${id}`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    const normalized = normalizeComplaint(rawComplaint);

    const rawHistory = envelope?.history || response?.history;
    if (Array.isArray(rawHistory)) {
      normalized.timeline = rawHistory.map((item: any, idx: number) => ({
        id: String(item.historyId || item.history_id || item.id || idx),
        complaint_id: String(id),
        previous_status: item.oldStatus
          ? normalizeStatus(item.oldStatus)
          : item.previous_status
          ? normalizeStatus(item.previous_status)
          : null,
        new_status: normalizeStatus(item.newStatus || item.new_status || item.status),
        updated_by_role: String(item.updated_by_role || item.role || 'Staff'),
        updated_by_name: String(item.updated_by_name || item.name || 'System'),
        notes: String(item.note || item.notes || item.remarks || ''),
        created_at: item.changedAt || item.created_at || item.createdAt || new Date().toISOString(),
      }));
    }

    return normalized;
  },

  /**
   * Warden: PATCH /api/warden/complaints/:id/priority
   * Body: { priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }
   */
  async updatePriority(complaintId: string, priority: ComplaintPriority): Promise<Complaint> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/warden/complaints/${encodeURIComponent(complaintId)}/priority`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ priority }),
    });

    const response = await handleResponse<any>(res, `/api/warden/complaints/${complaintId}/priority`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    return normalizeComplaint(rawComplaint);
  },

  /**
   * Warden: POST /api/warden/complaints/:id/assign
   * Body: { workerId: number } (positive integer)
   */
  async assignWorker(complaintId: string, workerId: number): Promise<Complaint> {
    if (!Number.isInteger(workerId) || workerId <= 0) {
      throw new Error('Worker ID must be a positive integer.');
    }

    const base = this.getBaseUrl();
    const res = await fetch(`${base}/warden/complaints/${encodeURIComponent(complaintId)}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ workerId }),
    });

    const response = await handleResponse<any>(res, `/api/warden/complaints/${complaintId}/assign`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    return normalizeComplaint(rawComplaint);
  },

  /**
   * Worker: GET /api/worker/complaints
   * Fetches complaints actively assigned to the authenticated worker
   */
  async getWorkerComplaints(): Promise<Complaint[]> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/worker/complaints`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const response = await handleResponse<any>(res, '/api/worker/complaints');
    const envelope = response?.data || response;
    const rawList = Array.isArray(envelope?.complaints)
      ? envelope.complaints
      : Array.isArray(envelope)
      ? envelope
      : Array.isArray(response?.complaints)
      ? response.complaints
      : [];

    return rawList.map(normalizeComplaint);
  },

  /**
   * Worker: PATCH /api/worker/complaints/:id/status
   * Body: { status: "IN_PROGRESS" | "RESOLVED", note?: string }
   */
  async updateWorkerStatus(
    complaintId: string,
    status: 'IN_PROGRESS' | 'RESOLVED',
    note?: string
  ): Promise<Complaint> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/worker/complaints/${encodeURIComponent(complaintId)}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        status,
        ...(note ? { note: note.trim() } : {}),
      }),
    });

    const response = await handleResponse<any>(res, `/api/worker/complaints/${complaintId}/status`);
    const envelope = response?.data || response;
    const rawComplaint = envelope?.complaint || envelope;
    return normalizeComplaint(rawComplaint);
  },

  // CSV Export Utility
  exportComplaintsCsv(complaints: Complaint[]) {
    const headers = ['Complaint ID', 'Student Name', 'Room', 'Hostel', 'Category', 'Priority', 'Status', 'Assigned Worker', 'Created At'];
    const rows = complaints.map(c => [
      c.complaint_code,
      `"${c.student_name.replace(/"/g, '""')}"`,
      `"${c.room_number}"`,
      `"${c.hostel_name}"`,
      `"${c.category}"`,
      c.priority,
      c.status,
      `"${(c.assigned_worker_name || 'Unassigned').replace(/"/g, '""')}"`,
      new Date(c.created_at).toLocaleString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HostelCare_Complaints_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
