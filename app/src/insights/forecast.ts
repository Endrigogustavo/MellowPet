/**
 * Previsão do "clima emocional": como costumam ser as manhãs, tardes e noites
 * do mesmo dia da semana, nas últimas semanas.
 *
 * Não é previsão do futuro — é o padrão da própria pessoa, dito de um jeito
 * leve ("terças à tarde costumam nublar"). Sem amostra suficiente, não diz
 * nada: um palpite com três leituras seria pior que silêncio.
 */
export type DayPeriod = 'manha' | 'tarde' | 'noite';
export type Weather = 'ensolarado' | 'nublado' | 'chuvoso' | 'tempestade';

export type MoodEvent = { emotion: string; at: number };

export type PeriodForecast = { period: DayPeriod; weather: Weather | null; samples: number };

export const PERIOD_LABEL: Record<DayPeriod, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

/** `icon` é a chave do ícone em EXTRA_ICONS (data/content). */
export const WEATHER: Record<Weather, { icon: 'sun' | 'cloudSun' | 'rain' | 'storm'; text: string }> = {
  ensolarado: { icon: 'sun', text: 'costuma ser leve' },
  nublado: { icon: 'cloudSun', text: 'às vezes pesa um pouco' },
  chuvoso: { icon: 'rain', text: 'costuma ser mais difícil' },
  tempestade: { icon: 'storm', text: 'costuma vir com tensão' },
};

/** Mínimo de leituras no mesmo dia da semana; abaixo disso usa todos os dias. */
const MIN_SAME_WEEKDAY = 6;
const MIN_ANY_DAY = 10;
const NEGATIVE = new Set(['sad', 'fearful', 'angry', 'disgusted']);
const TENSE = new Set(['angry', 'fearful']);

export function periodOf(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return 'manha';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
}

function weatherOf(events: MoodEvent[]): Weather {
  const n = events.length;
  const neg = events.filter((e) => NEGATIVE.has(e.emotion)).length / n;
  const tense = events.filter((e) => TENSE.has(e.emotion)).length / n;
  if (neg >= 0.45) return tense >= 0.3 ? 'tempestade' : 'chuvoso';
  if (neg >= 0.25) return 'nublado';
  return 'ensolarado';
}

export function forecastFor(target: Date, events: MoodEvent[]): PeriodForecast[] {
  const weekday = target.getDay();
  const known = events.filter((e) => e.emotion !== 'unknown');
  return (['manha', 'tarde', 'noite'] as DayPeriod[]).map((period) => {
    const inPeriod = known.filter((e) => periodOf(new Date(e.at).getHours()) === period);
    const sameDay = inPeriod.filter((e) => new Date(e.at).getDay() === weekday);
    const pool =
      sameDay.length >= MIN_SAME_WEEKDAY ? sameDay : inPeriod.length >= MIN_ANY_DAY ? inPeriod : null;
    return { period, weather: pool ? weatherOf(pool) : null, samples: pool?.length ?? 0 };
  });
}
