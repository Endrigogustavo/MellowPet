import React from 'react';
import { View } from 'react-native';

import { Icon } from '../components/Icon';
import { ScreenScroll, Section } from '../components/ScreenScroll';
import { Card, ScreenTitle, Touchable, Txt } from '../components/ui';
import { ICONS } from '../data/content';
import { useApp, useTheme, type Screen } from '../state/AppContext';

const STEPS: Array<[string, string, Screen, string]> = [
  ['Confirme a conexão', 'Depois que o convite é aceito, o cuidador tem acesso integral ao módulo de cuidado enquanto o vínculo estiver ativo.', 'settings', ICONS.shield],
  ['Use padrões, não conclusões', 'Os painéis mostram leituras agregadas. Eles não são diagnóstico e não explicam a causa de uma emoção.', 'dashboard', ICONS.book],
  ['Prefira um check-in respeitoso', 'Diante de um alerta ou mudança, pergunte como a pessoa está e combine o próximo passo.', 'agenda', ICONS.heart],
  ['Registre o plano combinado', 'Guarde sinais de atenção, ações e contatos que foram acordados em conjunto.', 'careplan', ICONS.heart],
];

export function CareGuideScreen() {
  const { actions } = useApp();
  const { T } = useTheme();

  return (
    <ScreenScroll>
      <ScreenTitle label="GUIA" title={'Cuidar com\nrespeito'} />

      <Section top={0}>
        <Card radius={22} padding={17} style={{ backgroundColor: T.priL }}>
          <Txt s={14.5} w={800} c={T.t1}>O cuidado é combinado, não vigiado.</Txt>
          <Txt s={12.5} lh={1.55} c={T.t2} style={{ marginTop: 7 }}>
            Use as informações para apoiar, nunca para diagnosticar ou substituir ajuda profissional. Em risco imediato, acione os serviços de emergência locais.
          </Txt>
        </Card>
      </Section>

      <Section top={12} gap={9}>
        {STEPS.map(([title, detail, target, icon], index) => (
          <Touchable
            key={title}
            onPress={() => actions.go(target)}
            style={{ borderRadius: 20, padding: 15, backgroundColor: T.surf, borderWidth: 1, borderColor: T.bd, flexDirection: 'row', gap: 12 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: T.priL, alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={icon} size={18} color={T.pri} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt s={11} w={800} c={T.pri}>PASSO {index + 1}</Txt>
              <Txt s={14} w={800} c={T.t1} style={{ marginTop: 2 }}>{title}</Txt>
              <Txt s={12} lh={1.5} c={T.t3} style={{ marginTop: 4 }}>{detail}</Txt>
            </View>
          </Touchable>
        ))}
      </Section>
    </ScreenScroll>
  );
}
