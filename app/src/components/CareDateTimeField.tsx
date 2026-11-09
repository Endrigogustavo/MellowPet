import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { deviceTimeZone, withDate, withTime } from '../care/careDateTime';
import { useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';
import { Icon } from './Icon';
import { Touchable, Txt } from './ui';

const CALENDAR = 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4';
const CLOCK = 'M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z';

/**
 * Seletor de data e hora (C7): dois botões que abrem o seletor nativo — sem
 * digitar "AAAA-MM-DD HH:mm". Cada um troca só a sua parte.
 */
export function CareDateTimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  error?: string | null;
}) {
  const { T } = useTheme();
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  // Estável: o picker do Android reabre se o onChange muda a cada render.
  const latest = useRef({ onChange, value });
  latest.current = { onChange, value };
  const handle = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      const current = mode;
      setMode(null);
      if (event.type !== 'set' || !picked || !current) return;
      const { onChange: emit, value: base } = latest.current;
      emit(current === 'date' ? withDate(base, picked) : withTime(base, picked));
    },
    [mode]
  );

  const dateText = value.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const timeText = value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const button = (text: string, icon: string, a11y: string, next: 'date' | 'time') => (
    <Touchable
      onPress={() => setMode(next)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Abre o seletor"
      style={{
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: error ? 1.5 : 1,
        borderColor: error ? DANGER : T.bd,
        backgroundColor: T.surf,
      }}
    >
      <Icon d={icon} size={16} color={T.pri} />
      <Txt s={14.5} w={700} c={T.t1}>
        {text}
      </Txt>
    </Touchable>
  );

  return (
    <View style={{ marginTop: 12 }}>
      <Txt s={11.5} w={800} c={error ? DANGER : T.t2} style={{ marginBottom: 7 }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {button(dateText, CALENDAR, `${label}: dia ${dateText}, alterar`, 'date')}
        {button(timeText, CLOCK, `${label}: horário ${timeText}, alterar`, 'time')}
      </View>
      {error ? (
        <Txt s={11.5} lh={1.45} c={DANGER} style={{ marginTop: 7 }} accessibilityRole="alert">
          {error}
        </Txt>
      ) : (
        <Txt s={11.5} lh={1.5} c={T.t3} style={{ marginTop: 7 }}>
          Horário deste aparelho ({deviceTimeZone()}).
        </Txt>
      )}
      {mode ? (
        <DateTimePicker value={value} mode={mode} is24Hour display="default" onChange={handle} />
      ) : null}
    </View>
  );
}
