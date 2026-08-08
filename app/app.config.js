/**
 * Configuracao do app MellowPet.
 *
 * E um .js (e nao app.json) porque o build de producao precisa diferir do de
 * desenvolvimento em dois pontos que importam para seguranca e para a loja:
 *
 *   1. Trafego HTTP puro (cleartext) so e permitido em dev, onde a API roda
 *      em `http://<ip-local>:8000`. Em producao a app fala apenas HTTPS.
 *   2. Builds de dev usam outro applicationId e outro nome, para poderem
 *      conviver com a versao de producao no mesmo aparelho.
 *
 * Variaveis de ambiente lidas no momento do build:
 *   EAS_BUILD_PROFILE     definido pelo EAS ("development" | "preview" | "production")
 *   APP_VARIANT           override manual para builds locais
 *   EXPO_PUBLIC_API_URL   URL base da API (obrigatoria em producao)
 */

const profile = process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE || 'development';
const IS_PRODUCTION = profile === 'production';
const IS_PREVIEW = profile === 'preview';

// Cores da marca — espelham brand/mellow_mark.py
const PLUM = '#4A3550';

const bundleId = IS_PRODUCTION
  ? 'com.mellowpet.app'
  : IS_PREVIEW
    ? 'com.mellowpet.app.preview'
    : 'com.mellowpet.app.dev';

const nameSuffix = IS_PRODUCTION ? '' : IS_PREVIEW ? ' (Preview)' : ' (Dev)';

if (IS_PRODUCTION && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL precisa estar definida no build de producao — ' +
      'sem ela o app cairia no fallback de localhost e nao acharia a API.',
  );
}

if (IS_PRODUCTION && !/^https:\/\//.test(process.env.EXPO_PUBLIC_API_URL)) {
  throw new Error(
    'EXPO_PUBLIC_API_URL precisa usar https:// em producao — ' +
      'o build de producao nao permite trafego HTTP puro.',
  );
}

module.exports = {
  expo: {
    name: `MellowPet${nameSuffix}`,
    slug: 'mellowpet',
    scheme: 'mellowpet',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    primaryColor: PLUM,

    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: PLUM,
    },

    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
      buildNumber: '1',
      infoPlist: {
        // A camera roda em background para a deteccao continua; sem esta chave
        // a App Store rejeita o binario.
        NSCameraUsageDescription:
          'O MellowPet usa a câmera para reconhecer suas expressões e responder ao seu estado emocional. As imagens não são armazenadas.',
        NSMicrophoneUsageDescription:
          'O MellowPet usa o microfone apenas durante exercícios guiados de respiração.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: bundleId,
      versionCode: 1,
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: PLUM,
      },
      // Bloqueia backup automatico: o banco local guarda historico emocional.
      allowBackup: false,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            // HTTP puro so em dev, onde a API roda em IP local sem TLS.
            usesCleartextTraffic: !IS_PRODUCTION,
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Permita o acesso à câmera para o Mellow perceber como você está se sentindo.',
          recordAudioAndroid: false,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: PLUM,
        },
      ],
    ],

    extra: {
      buildProfile: profile,
      eas: {
        // Preenchido por `eas init`. Sem isso o `eas build` nao sobe.
        projectId: process.env.EAS_PROJECT_ID || undefined,
      },
    },
  },
};
