import { useCallback, useEffect, useRef, useState } from 'react';

import { listLinks, type CaregiverLink } from './careClient';

type CareRole = 'care' | 'user';

/**
 * Carrega vínculos mantendo separados os estados "não há vínculos" e
 * "não foi possível consultá-los". Isso impede que uma oscilação de rede
 * pareça uma desconexão real.
 */
export function useCareLinks(userId: string | null, role: CareRole, refreshEveryMs?: number) {
  const [links, setLinks] = useState<CaregiverLink[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    if (!userId) {
      setLinks([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listLinks(userId, role);
      if (id !== requestId.current) return;
      setLinks(result.links);
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason instanceof Error ? reason : new Error('Não foi possível carregar as conexões de cuidado.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    refresh();
    if (!refreshEveryMs) return undefined;
    const interval = setInterval(refresh, refreshEveryMs);
    return () => clearInterval(interval);
  }, [refresh, refreshEveryMs]);

  return { links, loading, error, refresh };
}
