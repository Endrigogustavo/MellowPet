import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';

import { listCheckins } from '../checkins/checkinClient';
import { reportHtml } from '../reports/therapistReport';
import { useApp, useTheme } from '../state/AppContext';
import { DANGER } from '../theme/palette';
import { Card, PrimaryButton, ToggleRow, Txt } from './ui';

const DAYS = 30;

/** PDF dos últimos 30 dias para levar à terapia. Gerado e compartilhado do aparelho. */
export function ReportCard() {
  const { state } = useApp();
  const { T } = useTheme();
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!state.userId) return;
    setBusy(true);
    setError(null);
    try {
      const checkins = await listCheckins(state.userId, Date.now() - DAYS * 24 * 3600 * 1000);
      const html = reportHtml({
        name: state.petName ? `Tutor(a) de ${state.petName}` : 'MellowPet',
        days: DAYS,
        checkins,
        includeNotes: notes,
        generatedAt: new Date(),
      });
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Relatório para a terapia' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card radius={22} padding={16}>
      <Txt s={12} w={800} c={T.t2}>
        Relatório para a terapia
      </Txt>
      <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>
        PDF com seus check-ins dos últimos 30 dias: emoções, contextos e sono. Você escolhe com quem compartilhar.
      </Txt>
      <ToggleRow
        label="Incluir minhas anotações"
        sub="Os textos que você escreveu nos check-ins."
        on={notes}
        onPress={() => setNotes((v) => !v)}
      />
      <PrimaryButton label={busy ? 'Gerando…' : 'Gerar PDF'} disabled={busy} onPress={() => generate().catch(() => undefined)} style={{ marginTop: 8 }} />
      {error ? (
        <Txt s={12} c={DANGER} style={{ marginTop: 8 }}>
          {error}
        </Txt>
      ) : null}
    </Card>
  );
}
