export type CareDistributionRow = { emotion: string; count: number };
export type CareBucket = { at: string; count: number; dominant: string | null };
export type CareSource = { source: string; count: number };

export type CareDashboardSummary = {
  events: number;
  last_event_at: string | null;
  mean_confidence: number;
  distribution: CareDistributionRow[];
  hourly: CareBucket[];
  daily: CareBucket[];
  sources: CareSource[];
};

export type CareAlertStatus = 'open' | 'acknowledged' | 'resolved';
export type CareAlert = {
  id: string;
  cared_user_id: string;
  caregiver_link_id: string | null;
  kind: string;
  severity: 'info' | 'attention' | 'urgent';
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  status: CareAlertStatus;
  occurred_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export type CareCheckin = {
  id: string;
  cared_user_id: string;
  caregiver_link_id: string | null;
  scheduled_for: string;
  prompt: string;
  status: 'scheduled' | 'completed' | 'skipped' | 'cancelled';
  response: string | null;
  completed_at: string | null;
};

export type CareAppointment = {
  id: string;
  cared_user_id: string;
  caregiver_link_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
};

export type CarePlan = {
  id: string;
  cared_user_id: string;
  title: string;
  warning_signs: string[];
  steps: string[];
  emergency_contacts: { name: string; contact: string }[];
  updated_at: string;
};

export type CareTeamMember = {
  id: string;
  cared_user_id: string;
  name: string;
  role: string;
  contact: string | null;
  can_receive_alerts: boolean;
};

export type CaregiverNote = { id: string; body: string; created_at: string };

export type CareSupportAction = {
  id: string;
  kind: string;
  detail: string | null;
  outcome: string | null;
  created_at: string;
};

/**
 * Deliberately minimal audit projection. The database records only an action
 * and an artifact ID; the app never fetches metadata so a history screen
 * cannot reveal note, check-in, alert, or plan contents.
 */
export type CareAuditEntry = {
  id: string;
  action: string;
  created_at: string;
};
