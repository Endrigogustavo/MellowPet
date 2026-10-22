import * as Calendar from 'expo-calendar';
import React, { useCallback, useEffect, useState } from 'react';

import { nextBreak } from '../insights/integrations';
import { scheduleOnce } from '../notifications/notifications';
import { useTheme } from '../state/AppContext';
import { Card, PrimaryButton, Txt } from './ui';

/**
 * Agenda do dia (expo-calendar, só leitura): quantos compromissos e qual a
 * próxima folga depois de um bloco deles — onde uma pausa curta rende mais.
 * O Mellow agenda o lembrete se a pessoa quiser.
 */
export function AgendaCard() {
  const { T } = useTheme();
  const [phase, setPhase] = useState<'idle' | 'ask' | 'ready'>('idle');
  const [count, setCount] = useState(0);
  const [pause, setPause] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 3600 * 1000);
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const events = await Calendar.getEventsAsync(
      calendars.map((c) => c.id),
      start,
      end
    );
    const timed = events.filter((e) => !e.allDay);
    setCount(timed.length);
    const busy = timed.map((e) => ({ start: new Date(e.startDate).getTime(), end: new Date(e.endDate).getTime() }));
    const dayEnd = new Date(start.getTime() + 20 * 3600 * 1000).getTime();
    setPause(nextBreak(busy, Date.now(), dayEnd));
    setPhase('ready');
  }, []);

  useEffect(() => {
    Calendar.getCalendarPermissionsAsync()
      .then((p) => (p.granted ? load() : setPhase('ask')))
      .catch(() => setPhase('ask'));
  }, [load]);

  if (phase === 'idle') return null;

  const time = pause ? new Date(pause).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Card radius={22} padding={16}>
      <Txt s={12} w={800} c={T.t2}>
        Agenda de hoje
      </Txt>
      {phase === 'ask' ? (
        <>
          <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
            Deixe o Mellow olhar (só olhar) sua agenda para sugerir pausas nos intervalos entre compromissos.
          </Txt>
          <PrimaryButton
            label="Permitir agenda"
            onPress={() => {
              Calendar.requestCalendarPermissionsAsync()
                .then((p) => (p.granted ? load() : undefined))
                .catch(() => undefined);
            }}
            style={{ marginTop: 12 }}
          />
        </>
      ) : (
        <>
          <Txt s={12.5} lh={1.5} c={T.t2} style={{ marginTop: 6 }}>
            {count === 0
              ? 'Nenhum compromisso com horário hoje.'
              : `${count} ${count === 1 ? 'compromisso' : 'compromissos'} hoje.`}
            {time ? ` Primeira folga depois de um bloco: ${time}.` : ''}
          </Txt>
          {time && !scheduled ? (
            <PrimaryButton
              label={`Lembrar de respirar às ${time}`}
              onPress={() => {
                scheduleOnce(
                  Math.max(5, (pause! - Date.now()) / 1000),
                  'Pausa entre compromissos 🌿',
                  'Dois minutos: ombros para baixo, respira fundo, água.',
                  { kind: 'water' }
                )
                  .then((id) => setScheduled(Boolean(id)))
                  .catch(() => undefined);
              }}
              style={{ marginTop: 12 }}
            />
          ) : scheduled ? (
            <Txt s={12} c={T.t3} style={{ marginTop: 8 }}>
              Lembrete marcado ✓
            </Txt>
          ) : null}
        </>
      )}
    </Card>
  );
}
