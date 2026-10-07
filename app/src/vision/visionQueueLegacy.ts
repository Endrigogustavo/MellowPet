import type { VisionEventEnvelope, VisionFeedback } from './eventContracts';

export type LegacyQueueItem =
  | { id: string; createdAtMs: number; type: 'event'; payload: VisionEventEnvelope }
  | { id: string; createdAtMs: number; type: 'feedback'; payload: VisionFeedback };

export function parseLegacyIndex(encoded: string | null): { id: string; createdAtMs: number }[] {
  if (!encoded) return [];
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { id: string; createdAtMs: number } =>
        typeof item?.id === 'string' &&
        typeof item?.createdAtMs === 'number' &&
        Number.isFinite(item.createdAtMs)
    );
  } catch {
    return [];
  }
}

export function parseLegacyItem(encoded: string): LegacyQueueItem | null {
  try {
    const item = JSON.parse(encoded) as Partial<LegacyQueueItem>;
    if (
      typeof item.id !== 'string' ||
      typeof item.createdAtMs !== 'number' ||
      !Number.isFinite(item.createdAtMs) ||
      (item.type !== 'event' && item.type !== 'feedback') ||
      !item.payload
    ) return null;
    if (item.type === 'event' && typeof (item.payload as VisionEventEnvelope).event?.event_id !== 'string') return null;
    if (item.type === 'feedback' && typeof (item.payload as VisionFeedback).event_id !== 'string') return null;
    return item as LegacyQueueItem;
  } catch {
    return null;
  }
}
