/**
 * HostelCare Enterprise Type Definitions
 * Aligned with the real Node.js + Express + MySQL Backend Contract.
 */

// 1. Roles: The real backend strictly uses uppercase role identifiers
export type Role = 'STUDENT' | 'WARDEN' | 'WORKER';

// 2. Complaint Statuses: The real backend statuses
export type ComplaintStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

// 3. Complaint Priorities: The real backend priorities
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// 4. Categories (Common maintenance domain classifications)
export type ComplaintCategory =
  | 'Electrical'
  | 'Plumbing'
  | 'Wi-Fi'
  | 'Furniture'
  | 'Cleaning'
  | 'Water'
  | 'Other';

export type Category = ComplaintCategory;

// Friendly Display Mappings
export const STATUS_DISPLAY: Record<ComplaintStatus, string> = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_DISPLAY: Record<ComplaintPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const ROLE_DISPLAY: Record<Role, string> = {
  STUDENT: 'Student',
  WARDEN: 'Warden',
  WORKER: 'Worker',
};

// Normalization Helpers
export function normalizeRole(raw?: string): Role {
  if (!raw) return 'STUDENT';
  const upper = raw.toUpperCase();
  if (upper === 'WARDEN') return 'WARDEN';
  if (upper === 'WORKER') return 'WORKER';
  return 'STUDENT';
}

export function normalizeStatus(raw?: string): ComplaintStatus {
  if (!raw) return 'PENDING';
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  if (upper === 'ASSIGNED') return 'ASSIGNED';
  if (upper === 'IN_PROGRESS' || upper === 'INPROGRESS') return 'IN_PROGRESS';
  if (upper === 'RESOLVED') return 'RESOLVED';
  if (upper === 'CLOSED') return 'CLOSED';
  return 'PENDING';
}

export function normalizePriority(raw?: string): ComplaintPriority {
  if (!raw) return 'MEDIUM';
  const upper = raw.toUpperCase();
  if (upper === 'LOW') return 'LOW';
  if (upper === 'HIGH') return 'HIGH';
  if (upper === 'CRITICAL') return 'CRITICAL';
  return 'MEDIUM';
}

export function formatRole(role?: string): string {
  if (!role) return 'User';
  const norm = normalizeRole(role);
  return ROLE_DISPLAY[norm] || role;
}

export function formatStatus(status?: string): string {
  if (!status) return 'Pending';
  const norm = normalizeStatus(status);
  return STATUS_DISPLAY[norm] || status;
}

export function formatPriority(priority?: string): string {
  if (!priority) return 'Medium';
  const norm = normalizePriority(priority);
  return PRIORITY_DISPLAY[norm] || priority;
}

// User object returned by POST /api/auth/login and GET /api/auth/me
// Contract: userId, name, email, role (STUDENT | WARDEN | WORKER)
export interface User {
  id: string; // client alias mapped from userId
  userId: string;
  name: string;
  email: string;
  role: Role;
  hostel_id?: string;
  hostel_name?: string;
  room_number?: string;
  roll_number?: string;
  phone?: string;
  block?: string;
  category?: string; // for workers
  is_available?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export interface Complaint {
  id: string;
  complaint_code: string;
  student_id?: string;
  student_name: string;
  student_email?: string;
  student_phone?: string;
  hostel_id?: string;
  hostel_name: string;
  room_number: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  title: string;
  description: string;
  assigned_worker_id?: string;
  assigned_worker_name?: string;
  assigned_worker_phone?: string;
  scheduled_time?: string;
  created_at: string;
  updated_at?: string;
  is_reopened?: boolean;
  reopen_reason?: string;
  resolution_notes?: string;
  timeline?: ComplaintHistoryItem[];
}

export interface ComplaintHistoryItem {
  id: string;
  complaint_id: string;
  previous_status: ComplaintStatus | string | null;
  new_status: ComplaintStatus | string;
  updated_by_role: string;
  updated_by_name: string;
  notes: string;
  created_at: string;
}

// Health check response
export interface BackendHealth {
  isOnline: boolean;
  dbConnected: boolean;
  apiUrl: string;
  lastChecked?: string;
  error?: string;
}

// Frontend-calculated metrics from real complaints list
export interface CalculatedStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
  categoryBreakdown: { category: string; count: number }[];
  priorityBreakdown: { priority: string; count: number }[];
}

// Notification structure (handled cleanly in UI for upcoming real-time stream)
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: 'info' | 'success' | 'warning' | 'alert';
  created_at: string;
}

// Legacy alias for StatsOverview to prevent type breakages
export type StatsOverview = CalculatedStats;
export type WardenAnalytics = CalculatedStats;
