// Push do cuidado (Supabase Edge Function, Deno).
//
// Disparada por Database Webhooks (INSERT em care_alerts, care_requests e
// care_gestures). Manda um aviso com texto NEUTRO — nada de emoção, nome ou
// conteúdo; o detalhe só aparece dentro do app, depois de entrar. O `data`
// leva só o tipo e o cared_user_id, para o app abrir a pessoa certa.
//
// Preferências do cuidador (tabela care_notification_prefs, por vínculo):
//   - push_alerts / push_requests desligam cada tipo;
//   - silêncio noturno (quiet_start..quiet_end, hora de America/Sao_Paulo)
//     segura alertas e pedidos; pedido "agora" fura o silêncio.
//   Sem linha de preferência valem os padrões do app
//   (DEFAULT_NOTIFICATION_PREFS em app/src/care/careUxTypes.ts).
//
// Pausa: esconde dados, não a voz da pessoa. Pedidos "preciso de você"
// chegam também aos cuidadores de vínculo pausado; alertas não (nem são
// gerados durante a pausa).
//
// Configuração (uma vez, no painel do Supabase):
//   Database → Webhooks → Create: tabela care_alerts, evento INSERT,
//   tipo "Supabase Edge Functions", função care-push. Repita para
//   care_requests e care_gestures.
//   Secrets: WEBHOOK_SECRET (o mesmo valor no header x-webhook-secret do webhook).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Table = 'care_alerts' | 'care_requests' | 'care_gestures';
type Payload = { type: string; table: string; record: Record<string, unknown> };
type LinkRow = { id: string; caregiver_user_id: string; paused_until: string | null };
type PrefsRow = {
  caregiver_link_id: string;
  push_alerts: boolean;
  push_requests: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
};
type TokenRow = { token: string };

const TEXT: Record<Table, { title: string; body: string }> = {
  care_alerts: { title: 'MellowPet', body: 'Há um novo sinal para acompanhar.' },
  care_requests: { title: 'MellowPet', body: 'Alguém que você acompanha pediu contato.' },
  care_gestures: { title: 'MellowPet', body: 'Chegou um carinho para você.' },
};

const DEFAULT_PREFS: Omit<PrefsRow, 'caregiver_link_id'> = {
  push_alerts: true,
  push_requests: true,
  quiet_start: '22:00',
  quiet_end: '07:00',
};

const TZ = 'America/Sao_Paulo';

function isTable(t: string): t is Table {
  return t === 'care_alerts' || t === 'care_requests' || t === 'care_gestures';
}

/** "22:00" ou "22:00:00" (Postgres time) → minutos desde meia-noite. */
function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function localMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** Silêncio que pode cruzar a meia-noite (22:00 → 07:00). Início = fim: sem silêncio. */
export function inQuietHours(start: string | null, end: string | null, now: Date): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return false;
  const t = localMinutes(now);
  return s < e ? t >= s && t < e : t >= s || t < e;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const payload = (await req.json()) as Payload;
  if (payload.type !== 'INSERT' || !isTable(payload.table)) return new Response('ignored');
  const table = payload.table;
  const text = TEXT[table];

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const r = payload.record;
  const caredUserId = String(r.cared_user_id ?? '');
  if (!caredUserId) return new Response('ignored');
  const now = new Date();
  const nowIso = now.toISOString();

  // Quem recebe: alerta → o cuidador daquele vínculo (ativo, não pausado);
  // pedido → todos os cuidadores de vínculo aceito, inclusive pausados;
  // gesto → a pessoa acompanhada.
  let recipients: string[] = [];
  if (table === 'care_gestures') {
    recipients = [caredUserId];
  } else {
    const { data } = await db
      .from('caregiver_links')
      .select('id, caregiver_user_id, paused_until')
      .eq('cared_user_id', caredUserId)
      .eq('status', 'accepted')
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    let links = (data ?? []) as LinkRow[];
    if (table === 'care_alerts') {
      const alertLink = String(r.caregiver_link_id ?? '');
      links = links.filter((l) => l.id === alertLink && (!l.paused_until || l.paused_until <= nowIso));
    }

    const { data: prefsData } = links.length
      ? await db
          .from('care_notification_prefs')
          .select('caregiver_link_id, push_alerts, push_requests, quiet_start, quiet_end')
          .in('caregiver_link_id', links.map((l) => l.id))
      : { data: [] };
    const prefsByLink = new Map(((prefsData ?? []) as PrefsRow[]).map((p) => [p.caregiver_link_id, p]));
    const urgentNow = table === 'care_requests' && r.urgency === 'agora';

    recipients = links
      .filter((l) => {
        const prefs = prefsByLink.get(l.id) ?? { caregiver_link_id: l.id, ...DEFAULT_PREFS };
        if (table === 'care_alerts' && !prefs.push_alerts) return false;
        if (table === 'care_requests' && !prefs.push_requests) return false;
        if (!urgentNow && inQuietHours(prefs.quiet_start, prefs.quiet_end, now)) return false;
        return true;
      })
      .map((l) => String(l.caregiver_user_id));
  }
  recipients = [...new Set(recipients)];
  if (recipients.length === 0) return new Response('no recipients');

  const { data: tokens } = await db.from('push_tokens').select('token').in('user_id', recipients);
  const messages = ((tokens ?? []) as TokenRow[]).map((t) => ({
    to: t.token,
    title: text.title,
    body: text.body,
    priority: table === 'care_requests' && r.urgency === 'agora' ? 'high' : 'normal',
    data: { kind: table, cared_user_id: caredUserId },
  }));
  if (messages.length === 0) return new Response('no tokens');

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  return new Response(`sent ${messages.length}: ${res.status}`);
});
