import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { EMA_PROMPTS, upcomingEmaTimes } from '../checkins/ema';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'routine-reminders';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes de rotina',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await ensureChannel();
    return true;
  }
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) await ensureChannel();
  return requested.granted;
}

/** id do item de rotina -> id da notificação agendada, pra poder cancelar
 * e reagendar quando o item muda de horário. Só existe em memória — ao
 * reabrir o app, `resyncRoutineReminders` reconstrói a partir do Supabase. */
const scheduledByRoutineId = new Map<string, string>();

export async function scheduleRoutineReminder(routineId: string, time: string, name: string) {
  const existing = scheduledByRoutineId.get(routineId);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined);
  }
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Mellow',
      body: name,
      data: { routineId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
  scheduledByRoutineId.set(routineId, id);
}

export async function cancelRoutineReminder(routineId: string) {
  const existing = scheduledByRoutineId.get(routineId);
  if (!existing) return;
  await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined);
  scheduledByRoutineId.delete(routineId);
}

/** Recria os agendamentos locais a partir da lista real vinda do Supabase —
 * agendamentos não sobrevivem à reinstalação/limpeza de dados do app, então
 * isso roda toda vez que a tela de rotina carrega. */
export async function resyncRoutineReminders(items: { id: string; time: string; name: string; notify: boolean }[]) {
  // Só os de rotina: pausa de água e microcheck-ins têm vida própria.
  await cancelWhere((data) => typeof data.routineId === 'string');
  scheduledByRoutineId.clear();
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  for (const item of items) {
    if (item.notify) await scheduleRoutineReminder(item.id, item.time, item.name);
  }
}

/**
 * Lembrete único daqui a alguns minutos (pausa de água, microcheck-in).
 * Devolve o id, ou null sem permissão de notificação.
 */
export async function scheduleOnce(
  seconds: number,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<string | null> {
  if (!(await ensureNotificationPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(5, Math.round(seconds)),
      channelId: CHANNEL_ID,
    },
  });
}

/** Pausa de água: um lembrete para daqui a 30 min. */
export function scheduleWaterBreak(minutes = 30) {
  return scheduleOnce(
    minutes * 60,
    'Pausa de água',
    'Levanta, bebe um copo de água e olha para longe da tela por um minuto.',
    { kind: 'water' }
  );
}

async function cancelWhere(match: (data: Record<string, unknown>) => boolean) {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    all
      .filter((n) => match((n.content.data ?? {}) as Record<string, unknown>))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined))
  );
}

/**
 * Microcheck-ins: refaz o sorteio de hoje e amanhã a cada abertura do app.
 * Desligado, apenas cancela os pendentes. Devolve quantos ficaram agendados
 * (0 também quando falta permissão).
 */
export async function rescheduleEma(enabled: boolean, now = new Date()): Promise<number> {
  await cancelWhere((data) => data.kind === 'ema');
  if (!enabled || !(await ensureNotificationPermission())) return 0;
  const times = upcomingEmaTimes(now, 2, Math.random);
  await Promise.all(
    times.map((date, i) =>
      Notifications.scheduleNotificationAsync({
        content: { title: 'Mellow', body: EMA_PROMPTS[i % EMA_PROMPTS.length], data: { kind: 'ema' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
      })
    )
  );
  return times.length;
}
