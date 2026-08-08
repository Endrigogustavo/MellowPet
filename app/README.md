# 🐾 MellowPet — App Expo

Aplicativo mobile para detecção de emoções em tempo real com o **Mellow**, o
bichinho virtual da MellowPet.

## Pré-requisitos

- Node.js >= 18
- Expo CLI via `npx`
- Android Studio (para Android) ou um dispositivo com Expo Go
- JDK 17

## Quickstart

```bash
cd app
npm install

# Aponte para a API local (veja "Configuração" abaixo)
cp .env.example .env.local

npm start          # Expo
npm run android    # Android
npm run ios        # iOS (macOS)
```

## Configuração

O app lê variáveis `EXPO_PUBLIC_*` no momento do build. Em desenvolvimento,
coloque-as num `.env.local` (já ignorado pelo git):

```bash
# Deixe em branco para autodetectar o IP do host do Metro — funciona na maioria
# dos casos com dispositivo físico na mesma rede.
EXPO_PUBLIC_API_URL=http://192.168.0.10:8000

# Precisa bater com API_KEY no api/.env
EXPO_PUBLIC_API_KEY=cole-a-chave-aqui
```

Emulador Android: `http://10.0.2.2:8000`.

> A chave em `EXPO_PUBLIC_API_KEY` é embutida no bundle e pode ser extraída de
> um APK. Ela serve para barrar uso da API por terceiros, não é autenticação de
> usuário — veja a nota em `api/README.md`.

## Builds

`app.config.js` é a fonte da verdade da configuração nativa — **não existe
`app.json`**. Ele varia por perfil de build:

| Perfil | applicationId | Nome | HTTP puro |
|--------|---------------|------|-----------|
| `development` | `com.mellowpet.app.dev` | MellowPet (Dev) | permitido |
| `preview` | `com.mellowpet.app.preview` | MellowPet (Preview) | permitido |
| `production` | `com.mellowpet.app` | MellowPet | **bloqueado** |

Os três IDs são distintos de propósito: dá para ter dev, preview e produção
instalados no mesmo aparelho.

```bash
npx eas init                  # uma vez, para gerar o projectId
npm run build:preview         # APK interno
npm run build:production      # AAB + IPA para as lojas
```

O build de produção **falha de propósito** se `EXPO_PUBLIC_API_URL` não estiver
definida ou não for `https://` — sem isso o app subiria para a loja apontando
para `localhost`. Configure as chaves como segredos do EAS:

```bash
npx eas secret:create --name EXPO_PUBLIC_API_KEY --value "<a-chave>"
```

### Pastas nativas

`android/` e `ios/` são geradas por `expo prebuild` e **não são versionadas** —
o EAS as regenera a partir do `app.config.js`. Se você já tem uma `android/`
local de antes do rebranding, ela ainda tem o applicationId antigo:

```bash
npx expo prebuild --clean
```

## Marca

Os assets em `assets/` são gerados, não editados à mão. A geometria do Mellow
vive em `brand/mellow_mark.py`; para regerar tudo:

```bash
python brand/generate_assets.py
```

| Arquivo | Uso |
|---------|-----|
| `assets/icon.png` | ícone do app — selo claro sobre `#4A3550` |
| `assets/adaptive-icon.png` | foreground do adaptive icon (Android) |
| `assets/splash-icon.png` | splash sobre `#4A3550` |
| `assets/notification-icon.png` | silhueta da barra de status (Android) |
| `src/components/MellowMark.tsx` | marca monocromática **dentro** do app |

## Permissões

**Android**: `CAMERA`, `RECORD_AUDIO`, `INTERNET`, `VIBRATE`
**iOS**: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`

Ambas declaradas em `app.config.js`.

## Arquitetura

```
app/
├── app.config.js                    # Config nativa por perfil de build
├── App.tsx                          # Entry point
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx           # 🐾 Tela principal com o Mellow
│   │   ├── DashboardScreen.tsx      # 📊 Dashboard + insights IA
│   │   ├── ToolsScreen.tsx          # 🧰 Ferramentas de bem-estar
│   │   ├── ChatScreen.tsx           # 💬 Chat empático
│   │   └── SettingsScreen.tsx       # ⚙️ Configurações
│   ├── components/
│   │   ├── VirtualPet.tsx           # Pet SVG animado
│   │   ├── MellowMark.tsx           # Marca monocromática in-app
│   │   ├── HomeEmotionPanel.tsx     # Painel de emoção da home
│   │   └── EmotionBadge.tsx         # Badge com emoção + confiança
│   ├── hooks/
│   │   ├── useStore.ts              # Estado global (Zustand)
│   │   └── useEmotionDetection.ts   # Loop de captura + análise
│   ├── services/
│   │   └── api.ts                   # Cliente HTTP (envia X-API-Key)
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Stack + tabs
│   └── theme/
│       └── index.ts                 # Design tokens
```

## Fluxo de funcionamento

1. App abre → solicita permissão de câmera
2. Câmera frontal ativa em background (invisível para o usuário)
3. A cada ~700ms → captura snapshot → envia para a API
4. API retorna emoção → o Mellow reage com animação
5. Badge exibe emoção + confiança + mensagem empática
6. Se emoção negativa prolongada → dispara alerta para contatos
7. Se sem rosto por X min → alerta no-face
