import React, { useState } from 'react';
import { Linking } from 'react-native';

import { nfcStatus, tapEncounter } from '../pet/encounters';
import { useApp, useTheme } from '../state/AppContext';
import { Touchable, Txt } from './ui';

/**
 * Encontro por NFC (link discreto em Ajustes). Aparece só com encontros
 * ligados e em aparelho com NFC; o outro celular só precisa estar na Home.
 */
export function NfcTapButton() {
  const { state } = useApp();
  const { T } = useTheme();
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'done' | 'missed'>('idle');
  const status = nfcStatus();
  if (!state.encountersEnabled || status === 'none') return null;

  const tap = () => {
    if (status === 'disabled') {
      Linking.sendIntent('android.settings.NFC_SETTINGS').catch(() => undefined);
      return;
    }
    setPhase('waiting');
    tapEncounter()
      .then((ok) => setPhase(ok ? 'done' : 'missed'))
      .catch(() => setPhase('missed'));
  };

  const label =
    status === 'disabled'
      ? 'Ligar o NFC para encostar celulares'
      : phase === 'waiting'
        ? 'Encoste as costas dos celulares…'
        : phase === 'done'
          ? 'Encontro feito! Encostar de novo'
          : phase === 'missed'
            ? 'Não pegou. Tentar de novo'
            : 'Encontro por NFC';

  return (
    <Touchable
      onPress={tap}
      disabled={phase === 'waiting'}
      accessibilityLabel="Encontro por NFC"
      style={{ marginTop: 12 }}
    >
      <Txt s={12.5} w={800} c={T.pri}>
        {phase === 'idle' ? 'Encontro por NFC' : label}
      </Txt>
      {phase === 'waiting' ? (
        <Txt s={11} c={T.t3} style={{ marginTop: 2 }}>
          O outro celular precisa estar com o MellowPet aberto na tela inicial.
        </Txt>
      ) : null}
    </Touchable>
  );
}
