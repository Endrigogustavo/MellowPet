# MellowPet App

Aplicativo Expo/React Native do MellowPet, com o Motor de Expressões Faciais V2
executado no dispositivo. Imagens e landmarks permanecem no runtime nativo; a
ponte JavaScript recebe somente sinais derivados e metadados de qualidade.

## Requisitos

- Node.js 22 LTS
- JDK 17
- Android SDK 36 e Platform Tools
- dispositivo ou emulador Android para validar câmera e latência física

## Desenvolvimento

```powershell
cd app
Copy-Item .env.example .env.local
npm ci
npm run doctor
npm run typecheck
npm run lint
npm run test:vision
npm run android
```

Use `npm run start:dev-client` depois de instalar o Development Build. O Expo Go
não carrega o módulo nativo `mellow-vision`.

## Configuração

As flags documentadas em `.env.example` usam padrões seguros: a V2 local fica
ativa, enquanto upload, feedback e fallback legado permanecem desligados. Toda
variável `EXPO_PUBLIC_*` é incorporada ao bundle e não pode conter segredos.

## Limites da versão

O build está aprovado para desenvolvimento interno Android. Medições físicas de
latência, inspeção de rede, autenticação real, avaliação humana de acurácia e o
build iOS ainda são gates obrigatórios antes de produção. Consulte
`../docs/specs/vision-expression-engine-v2-scorecard.md` para os resultados e
pendências atuais.
