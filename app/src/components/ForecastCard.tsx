import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { listDetectedEvents } from '../checkins/checkinClient';
import { PERIOD_LABEL, WEATHER, forecastFor, type PeriodForecast } from '../insights/forecast';
import { useApp, useTheme } from '../state/AppContext';
import { Card, Txt } from './ui';
import { EXTRA_ICONS } from '../data/content';
import { Icon } from './Icon';

const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "Clima emocional" de amanhã, a partir do padrão das últimas 4 semanas. */
export function ForecastCard() {
  const { state } = useApp();
  const { T } = useTheme();
  const [forecast, setForecast] = useState<PeriodForecast[] | null>(null);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

  const userId = state.userId;
  useEffect(() => {
    if (!userId) return;
    listDetectedEvents(userId, Date.now() - 28 * 24 * 3600 * 1000)
      .then((rows) =>
        setForecast(
          forecastFor(
            new Date(Date.now() + 24 * 3600 * 1000),
            rows.map((r) => ({ emotion: r.emotion, at: new Date(r.created_at).getTime() }))
          )
        )
      )
      .catch(() => setForecast([]));
  }, [userId]);

  if (!forecast) return null;
  const known = forecast.filter((p) => p.weather);

  return (
    <Card radius={22} padding={16}>
      <Txt s={12} w={800} c={T.t2}>
        Clima emocional de amanhã ({WEEKDAY[tomorrow.getDay()]})
      </Txt>
      {known.length === 0 ? (
        <Txt s={12.5} lh={1.5} c={T.t3} style={{ marginTop: 6 }}>
          Ainda sem padrão suficiente. Com algumas semanas de leituras, o Mellow mostra como costumam ser suas manhãs,
          tardes e noites.
        </Txt>
      ) : (
        <View style={{ gap: 8, marginTop: 10 }}>
          {forecast.map((p) => (
            <View key={p.period} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 24, alignItems: 'center' }}>
                {p.weather ? <Icon d={EXTRA_ICONS[WEATHER[p.weather].icon]} size={20} color={T.pri} sw={1.8} /> : <Txt c={T.t3}>·</Txt>}
              </View>
              <Txt s={12.5} c={T.t2} style={{ flex: 1 }}>
                <Txt s={12.5} w={800} c={T.t1}>
                  {PERIOD_LABEL[p.period]}
                </Txt>{' '}
                {p.weather ? WEATHER[p.weather].text : 'sem dados ainda'}
              </Txt>
            </View>
          ))}
          <Txt s={10.5} c={T.t3} style={{ marginTop: 2 }}>
            É o seu padrão das últimas semanas, não um destino.
          </Txt>
        </View>
      )}
    </Card>
  );
}
