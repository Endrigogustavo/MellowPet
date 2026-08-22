import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  scheduledByRoutineId.clear();
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  for (const item of items) {
    if (item.notify) await scheduleRoutineReminder(item.id, item.time, item.name);
  }
}
