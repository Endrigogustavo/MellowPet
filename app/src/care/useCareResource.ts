import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carrega um dado da pessoa acompanhada sem misturar pessoas.
 *
 * - `key` identifica o que está sendo pedido (pessoa + período). Ao mudar,
 *   o dado anterior some na hora — nada da pessoa A fica na tela de B.
 * - Resposta atrasada de um pedido antigo é descartada (contador de pedido).
 * - `key` null = nada a buscar (sem pessoa selecionada).
 */
export function useCareResource<T>(key: string | null, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(key));
  const request = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    const id = ++request.current;
    if (!key) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === request.current) setData(result);
    } catch (reason) {
      if (id === request.current) {
        setError(reason instanceof Error ? reason : new Error('Não foi possível carregar.'));
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    setData(null);
    refresh().catch(() => undefined);
  }, [refresh]);

  return { data, error, loading, refresh, setData };
}
