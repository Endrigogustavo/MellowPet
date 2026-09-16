# Build e instalação no celular (Android)

Guia para gerar o APK de release e instalar num aparelho físico via `adb`.
Cada passo existe por causa de um problema que já aconteceu — os "porquês"
estão anotados para ninguém precisar redescobri-los.

## Pré-requisitos (Windows)

| Ferramenta | Onde | Verificar |
|---|---|---|
| Node 20+ | `C:\Program Files\nodejs` | `node --version` |
| JDK 17 ou 21 | `C:\Program Files\Microsoft\jdk-*` | `java -version` |
| Android SDK | `C:\Android` (`ANDROID_HOME`) | `dir C:\Android\build-tools` |
| Build-tools 36 | `C:\Android\build-tools\36.0.0` | precisa de `aapt2.exe` |
| adb | vem com o SDK (`platform-tools`) | `adb version` |

No celular: **Opções do desenvolvedor → Depuração USB** ligada. Em MIUI/HyperOS
ligue também **Instalar via USB** e desligue **Verificar apps via USB**, senão o
`adb install` diz `Success` mas o sistema descarta a instalação em silêncio.

## 1. Caminho curto (obrigatório)

O Windows limita caminhos a 260 caracteres e o Gradle estoura isso com folga
dentro de `node_modules`. O repositório precisa ser acessado por um caminho
curto. Use uma **junction**, não `subst`:

```powershell
cmd /c mklink /J C:\src "C:\Users\<voce>\Desktop\Pessoal\MellowPet"
```

> **Por que não `subst M:`?** O Java canoniza `M:\...` para o caminho real em
> `C:\...`, o Node não. O codegen do React Native compara os dois com
> `Path.relativize` e quebra com `this and base files have different roots`.
> Uma junction fica na mesma unidade e os dois resolvem igual.
>
> **Não crie a junction em `C:\mp`** — o Windows bloqueia remoção de pastas de
> duas letras na raiz. `C:\src` funciona.

Daqui em diante, tudo roda a partir de `C:\src`.

## 2. Variáveis de ambiente do app

`app/.env.local` (não versionado — copie de `.env.example`):

```
EXPO_PUBLIC_API_BASE_URL=https://mellowpet.onrender.com
EXPO_PUBLIC_API_KEY=...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=...
```

Para o APK que vai para o celular, `API_BASE_URL` precisa apontar para a API
publicada, não para `localhost` — o celular não enxerga a sua máquina.

> A API no Render hiberna quando ociosa: a primeira chamada depois de um tempo
> parado leva 30–50 s. Não é bug do app.

## 3. Gerar a pasta `android/` (quando necessário)

`app/android/` é **gerada** pelo Expo e está no `.gitignore`. Rode isto quando
ela não existir, quando `app.json` mudar, ou quando algo nela parecer errado:

```powershell
cd C:\src\app
npx expo prebuild --platform android --clean
```

Depois confirme a identidade do app — é o erro mais silencioso que existe:

```powershell
findstr /C:"applicationId" /C:"versionName" android\app\build.gradle
```

Tem de sair `com.mellowpet.app` e a versão do `app.json`. Se sair
`com.mellowpet` / `1.0`, a pasta está num estado antigo: rode o `prebuild`
de novo. Um APK com o pacote errado instala **ao lado** do app real em vez de
atualizá-lo, e você passa horas achando que a instalação não pega.

### Onde mora a configuração nativa (e por quê)

Como `android/` é descartável, **nunca edite nada lá direto**. Tudo que o app
precisa de nativo vive em lugares versionados e é aplicado no `prebuild`:

| O quê | Onde |
|---|---|
| 33 widget providers, receivers, `MellowBackgroundService`, permissões de foreground/boot/alarme | `app/modules/mellow-widget/android/src/main/AndroidManifest.xml` |
| `VisionBackgroundService`, permissão de câmera | `app/modules/mellow-vision/android/src/main/AndroidManifest.xml` |
| Repositório Maven local com os AARs do Spotify | `app/plugins/withSpotifyMavenRepo.js` (registrado em `app.json`) |
| Pacote, versão, scheme `mellowpet://`, permissões dos plugins Expo | `app/app.json` |

Já se perdeu tudo isso uma vez por estar só em `android/`. Se um dia faltar
widget, serviço ou permissão no APK, é porque algo saiu desses arquivos.

## 4. Compilar

```powershell
cd C:\src\app\android
.\gradlew.bat assembleRelease
```

Primeira vez: 5–15 min (baixa dependências e compila tudo). Depois é
incremental. O APK sai em:

```
C:\src\app\android\app\build\outputs\apk\release\app-release.apk
```

(~146 MB; é o mesmo arquivo que `...\MellowPet\app\android\...`, só por outro
caminho.)

## 5. Instalar e **verificar**

```powershell
adb devices                      # tem de listar o aparelho como "device"
adb install -r C:\src\app\android\app\build\outputs\apk\release\app-release.apk
```

`Success` **não basta**. Confirme que o que está no celular é o que você
compilou:

```powershell
# 1. pacote e versão certos, e lastUpdateTime = agora
adb shell dumpsys package com.mellowpet.app | findstr /C:"versionName" /C:"lastUpdateTime"

# 2. 33 widgets registrados
adb shell dumpsys package com.mellowpet.app | find /c "WidgetProvider"

# 3. abre sem crash
adb shell am force-stop com.mellowpet.app
adb shell am start -n com.mellowpet.app/.MainActivity
adb logcat -d -s AndroidRuntime:E ReactNativeJS:E
```

Se `lastUpdateTime` não mudou, a instalação não pegou — veja MIUI acima e o
pacote em §3.

Para ter certeza absoluta, compare o hash do APK local com o do aparelho:

```powershell
certutil -hashfile app-release.apk SHA256
adb shell sha256sum $(adb shell pm path com.mellowpet.app | sed s/package://)
```

## 6. Para o segundo plano funcionar no aparelho

O serviço que mantém os widgets vivos morre se o sistema quiser. Uma vez por
aparelho:

- **Bateria → MellowPet → Sem restrições** (isenção do Doze).
- MIUI/HyperOS: **Segurança → Permissões → Início automático → MellowPet**.

Sem isso o serviço para sozinho depois de alguns minutos e não é bug do app.

## Erros conhecidos

| Erro | Causa | Solução |
|---|---|---|
| `Could not find com.spotify.android:app-remote:0.8.0` | O `:app` não enxerga o repositório Maven do módulo | Confirme `./plugins/withSpotifyMavenRepo` em `app.json` e rode `prebuild` |
| `this and base files have different roots` | Uso de `subst` | Use junction (§1) |
| `Couldn't find "package.json" up from path "M:\android"` | `package.json` na raiz de uma unidade `subst` — bug do autolinking | Use junction (§1) |
| `Invalid number formating character` no `logcat` ao abrir | Path SVG com número de argumentos errado (`l4 4-4`) — browser tolera, Android não | Corrija o path; `l`/`L` exigem pares |
| Instalou mas nada mudou | Pacote errado (§3) ou MIUI descartou (pré-requisitos) | Verifique `lastUpdateTime` e `pm list packages \| findstr mellowpet` |
| Aparece um segundo "MellowPet" no celular | APK com pacote `com.mellowpet` | `adb uninstall com.mellowpet` e conserte §3 |
| App abre na tela de login depois de instalar | Normal quando a assinatura ou os dados mudam | Só entrar de novo |
