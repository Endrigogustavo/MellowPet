type UploadError = { code?: string } | null;

export type BatchResult = { acknowledged: Set<string>; rejected: string[] };

// Erros de dados/constraints podem ser isolados por item. Erros de rede,
// autenticação e permissão devem manter o lote inteiro para retry com backoff.
function isRowError(error: UploadError): boolean {
  return typeof error?.code === 'string' && /^(22|23)[0-9A-Z]{3}$/.test(error.code);
}

export async function uploadQueueBatch<T extends { id: string }>(
  items: T[],
  upload: (batch: T[]) => Promise<UploadError>
): Promise<BatchResult> {
  if (items.length === 0) return { acknowledged: new Set(), rejected: [] };
  const error = await upload(items);
  if (!error) return { acknowledged: new Set(items.map((item) => item.id)), rejected: [] };
  if (!isRowError(error)) throw error;
  if (items.length === 1) return { acknowledged: new Set(), rejected: [items[0].id] };

  const midpoint = Math.floor(items.length / 2);
  const left = await uploadQueueBatch(items.slice(0, midpoint), upload);
  const right = await uploadQueueBatch(items.slice(midpoint), upload);
  return {
    acknowledged: new Set([...left.acknowledged, ...right.acknowledged]),
    rejected: [...left.rejected, ...right.rejected],
  };
}
