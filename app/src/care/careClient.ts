import * as Crypto from 'expo-crypto';

import { supabase } from '../supabase/client';

export type CaregiverLink = {
  id: string;
  invite_code: string;
  caregiver_user_id: string;
  cared_user_id: string | null;
  cared_name: string | null;
  relationship: string | null;
  status: 'pending' | 'accepted';
  caregiver_email?: string | null;
  caregiver_display_name?: string | null;
};

// Sem 0/O/1/I — evita confusão ao digitar o código à mão.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateInviteCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(6);
  const suffix = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `MEL-${suffix}`;
}

export async function createInvite(
  caregiverUserId: string,
  caredName: string,
  relationship: string
): Promise<CaregiverLink> {
  // Colisão de código é praticamente impossível (33^6 combinações), mas
  // ainda assim tratada com uma nova tentativa, como o backend antigo fazia.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invite_code = await generateInviteCode();
    const { data, error } = await supabase
      .from('caregiver_links')
      .insert({ invite_code, caregiver_user_id: caregiverUserId, cared_name: caredName || null, relationship: relationship || null })
      .select('*')
      .single();
    if (!error) return data as CaregiverLink;
    if (error.code !== '23505') throw new Error('Não foi possível criar o convite.');
  }
  throw new Error('Não foi possível gerar um código único. Tente novamente.');
}

/** Reaproveita um convite pendente já existente do cuidador, se houver, em
 * vez de gerar um novo toda vez que a tela é aberta. */
export async function getOrCreatePendingInvite(caregiverUserId: string): Promise<CaregiverLink> {
  const { data: existing } = await supabase
    .from('caregiver_links')
    .select('*')
    .eq('caregiver_user_id', caregiverUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as CaregiverLink;
  return createInvite(caregiverUserId, '', '');
}

export async function acceptInvite(inviteCode: string, _userId: string): Promise<CaregiverLink> {
  const { data, error } = await supabase.rpc('accept_invite', { code: inviteCode });
  if (error) {
    if (error.code === 'P0002') throw new Error('Código de convite não encontrado.');
    if (error.code === '23505') throw new Error('Este convite já foi aceito.');
    if (error.code === '22023') throw new Error('Você não pode aceitar seu próprio convite.');
    throw new Error('Não foi possível aceitar o convite.');
  }
  return data as CaregiverLink;
}

export async function listLinks(userId: string, role: 'care' | 'user'): Promise<{ links: CaregiverLink[] }> {
  const column = role === 'care' ? 'caregiver_user_id' : 'cared_user_id';
  const { data, error } = await supabase
    .from('caregiver_links')
    .select('*')
    .eq(column, userId)
    .eq('status', 'accepted');
  if (error || !data) return { links: [] };
  if (role !== 'user' || data.length === 0) return { links: data as CaregiverLink[] };

  const caregiverIds = [...new Set(data.map((link) => link.caregiver_user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, email, display_name').in('id', caregiverIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    links: data.map((link) => ({
      ...link,
      caregiver_email: byId.get(link.caregiver_user_id)?.email ?? null,
      caregiver_display_name: byId.get(link.caregiver_user_id)?.display_name ?? null,
    })) as CaregiverLink[],
  };
}

export async function deleteLink(linkId: string, _userId: string): Promise<void> {
  await supabase.from('caregiver_links').delete().eq('id', linkId);
}
