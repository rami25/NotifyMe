export type ActionStatus = 'in_progress' | 'finished' | 'cancelled' | 'postponed';

export type ActionPriority = 'high' | 'medium' | 'low';

export interface ActionStatusHistoryEntry {
  status: ActionStatus;
  changedAt: string;       // ISO date
  changedBy: string;       // email, or 'system' for the automatic overdue job
}

export interface FieldAction {
  id: string;
  title: string;
  description: string;
  customerName: string;      // patient/customer record this action is tied to
  customerRef: string;       // e.g. Navision reference
  address: string;
  assignedToEmail: string;
  priority: ActionPriority;
  status: ActionStatus;
  deadline: string;          // ISO date
  createdAt: string;
  statusHistory: ActionStatusHistoryEntry[];
  distanceKm?: number;       // optional, populated when device location is available
}

export interface CancelActionPayload {
  reason?: string;
}
