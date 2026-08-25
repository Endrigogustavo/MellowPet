import React, {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';

/**
 * Quanto espaço o mini-player ocupa sobre o conteúdo.
 *
 * O dock é `position: absolute` acima de tudo, então ele engole os toques do
 * que estiver embaixo — era por isso que clicar numa faixa no fim da lista
 * abria o player em vez de tocar a faixa. As telas roláveis precisam saber a
 * altura dele para reservar o espaço.
 *
 * Fica num contexto próprio, e não no `AppContext`, de propósito: o dock
 * re-renderiza várias vezes por segundo (a posição do áudio anda sozinha),
 * mas esta altura só muda quando ele aparece ou some. Separar mantém as telas
 * fora desse ciclo.
 */

type DockInsetValue = {
  /** Altura do card, ou 0 quando não há nada tocando. */
  height: number;
  /** Aceita a forma funcional para o dock ignorar medidas repetidas. */
  setHeight: Dispatch<SetStateAction<number>>;
};

const DockInsetContext = createContext<DockInsetValue>({ height: 0, setHeight: () => {} });

export function DockInsetProvider({ children }: { children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  const value = useMemo(() => ({ height, setHeight }), [height]);
  // `children` chega como um elemento estável, então a troca de altura só
  // re-renderiza quem de fato lê o contexto.
  return <DockInsetContext.Provider value={value}>{children}</DockInsetContext.Provider>;
}

export function useDockInset() {
  return useContext(DockInsetContext);
}
