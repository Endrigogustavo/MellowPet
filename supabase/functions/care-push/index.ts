// Push do cuidado (Supabase Edge Function, Deno).
//
// Disparada por Database Webhooks (INSERT em care_alerts, care_requests e
// care_gestures). Manda um aviso com texto NEUTRO — nada de emoção, nome ou
// conteúdo; o detalhe só aparece dentro do app, depois de entrar.
//
// Configuração (uma vez, no painel do Supabase):
//   Database → Webhooks → Create: tabela care_alerts, evento INSERT,
//   tipo "Supabase Edge Functions", função care-push. Repita para
//   care_requests e care_gestures.
//   Secrets: WEBHOOK_SECRET (o mesmo valor no header x-webhook-secret do webhook).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Payload = { type: string; table: string; record: Record<string, unknown> };

const TEXT: Record<string, { title: string; body: string }> = {
  care_alerts: { title: 'MellowPet', body: 'Há um novo sinal para acompanhar.' },
  care_requests: { title: 'MellowPet', body: 'Alguém que você acompanha pediu contato.' },
  care_gestures: { title: 'MellowPet', body: 'Chegou um carinho para você.' },
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const payload = (await req.json()) as Payload;
  const text = TEXT[payload.table];
  if (payload.type !== 'INSERT' || !text) return new Response('ignored');

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const r = payload.record;

  // Quem recebe: alerta e pedido → cuidadores ativos (não pausados) daquela
  // pessoa; gesto → a pessoa acompanhada.
  let recipients: string[] = [];
  if (payload.table === 'care_gestures') {
    recipients = [String(r.cared_user_id)];
  } else {
    const now = new Date().toISOString();
    const { data } = await db
      .from('caregiver_links')
      .select('caregiver_user_id, paused_until')
      .eq('cared_user_id', String(r.cared_user_id))
      .eq('status', 'accepted')
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`);
    recipients = (data ?? [])
      .filter((l) => !l.paused_until || l.paused_until <= now)
      .map((l) => String(l.caregiver_user_id));
    if (payload.table === 'care_alerts' && r.caregiver_link_id) {
      const { data: link } = await db.from('caregiver_links').select('caregiver_user_id').eq('id', String(r.caregiver_link_id)).single();
      recipients = link ? recipients.filter((id) => id === String(link.caregiver_user_id)) : [];
    }
  }
  if (recipients.length === 0) return new Response('no recipients');

  const { data: tokens } = await db.from('push_tokens').select('token').in('user_id', recipients);
  const messages = (tokens ?? []).map((t) => ({
    to: t.token,
    title: text.title,
    body: text.body,
    priority: payload.table === 'care_requests' && r.urgency === 'agora' ? 'high' : 'normal',
    data: { kind: payload.table },
  }));
  if (messages.length === 0) return new Response('no tokens');

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  return new Response(`sent ${messages.length}: ${res.status}`);
});
