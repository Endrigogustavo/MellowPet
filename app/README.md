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
npm run benchmark:vision -- 100000
npm run android
```

Use `npm run start:dev-client` depois de instalar o Development Build. O Expo Go
não carrega o módulo nativo `mellow-vision`.

## Fila de eventos offline

Eventos agregados aguardam sincronização em SQLite local criptografado com
SQLCipher; o Supabase continua sendo o destino definitivo. A chave fica no
SecureStore. A fila não tem o limite anterior de 32 itens e conserva eventos
por até sete dias. Na primeira abertura, itens válidos pendentes da fila antiga
do SecureStore são copiados antes de suas cópias antigas serem removidas; itens
ilegíveis permanecem no SecureStore para possível recuperação.

Como SQLCipher é um recurso nativo, é necessário instalar um novo Development
Build após esta mudança. A fila criptografada não funciona no Expo Go. O upload
continua desligado por padrão e depende da flag `EXPO_PUBLIC_VISION_V2_EVENT_UPLOAD_ENABLED`.

## Configuração

As flags documentadas em `.env.example` usam padrões seguros: a V2 local fica
ativa, enquanto upload, feedback e fallback legado permanecem desligados. Toda
variável `EXPO_PUBLIC_*` é incorporada ao bundle e não pode conter segredos.

## Limites da versão

O build está aprovado para desenvolvimento interno Android. Medições físicas de
latência, inspeção de rede, autenticação real, avaliação humana de acurácia e o
build iOS ainda são gates obrigatórios antes de produção. Consulte
`../docs/specs/vision-expression-engine-v3-scorecard.md` para os resultados e
pendências atuais.
