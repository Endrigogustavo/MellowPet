import { apiDelete, apiGet, apiPost } from '../api/client';

export type CaregiverLink = {
  id: number;
  invite_code: string;
  caregiver_user_id: string;
  cared_user_id: string | null;
  cared_name: string | null;
  relationship: string | null;
  status: 'pending' | 'accepted';
  caregiver_email?: string | null;
  caregiver_display_name?: string | null;
};

export function createInvite(
  caregiverUserId: string,
  caredName: string,
  relationship: string
): Promise<CaregiverLink> {
  return apiPost<CaregiverLink>('/api/v1/care/invite', {
    caregiver_user_id: caregiverUserId,
    cared_name: caredName,
    relationship,
  });
}

export function acceptInvite(inviteCode: string, userId: string): Promise<CaregiverLink> {
  return apiPost<CaregiverLink>('/api/v1/care/accept', { invite_code: inviteCode, user_id: userId });
}

export function listLinks(userId: string, role: 'care' | 'user'): Promise<{ links: CaregiverLink[] }> {
  return apiGet<{ links: CaregiverLink[] }>('/api/v1/care/links', { user_id: userId, role });
}

export function deleteLink(linkId: number, userId: string): Promise<void> {
  return apiDelete(`/api/v1/care/links/${linkId}`, { user_id: userId });
}
