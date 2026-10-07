# MellowPet no Galaxy Watch 4

O app do relógio é um app **separado** do app do celular: Kotlin + Compose for
Wear OS, projeto Gradle próprio em [`wear/`](../wear). Não é uma tela a mais —
React Native não roda em Wear OS, e desde o Wear OS 2 o Google descontinuou o
"app embutido" no APK do celular.

## O que ele faz

Implementa o arquivo `MellowPet Watch.dc.html` do projeto de design. As telas
ficam lado a lado — deslize na horizontal:

| # | Tela | O que faz |
|---|---|---|
| 1 | **Mostrador** | hora, data, batimento, emoção e o Mellow; anel = sequência |
| 2 | **Humor** | o Mellow grande; anel = precisão da leitura; toque faz carinho |
| 3 | **Check-in** | as carinhas em volta do círculo; toque registra |
| 4 | **Respiração** | 4-4-4, cinco ciclos, **vibrando a cada fase** |
| 5 | **Batimento** | bpm grande, gráfico das últimas leituras, faixa |
| 6 | **Foco** | 25 min; anel grosso, como o design pede |

Mais um **Tile** com o estado, e fila local: o check-in feito longe do celular
sobe quando reconectar.

### Telas do design que ainda não existem

Cada uma depende de algo que o app ainda não tem, e nenhuma é só desenho:

- **Música** — precisa controlar o Spotify do celular a partir do relógio.
- **Diário por voz** — precisa de reconhecimento de fala.
- **Lembrete do pet** e **Alerta do cuidador** — são notificações disparadas
  pelo celular, não telas que o relógio abre sozinho.
- **Ajuda agora** — o atalho de 5 toques no botão é configuração do sistema.

E uma diferença deliberada: o design mostra **seis** emoções no check-in; aqui
são as **sete** que o app registra. Tirar uma para o círculo fechar em 60°
deixaria o relógio incapaz de anotar algo que o celular anota, e furaria a
estatística do mapa emocional.

O que ele **não** faz: detecção por câmera. O Watch 4 não tem câmera frontal.
No relógio o sinal é o que você declara, mais os batimentos.

> Sobre batimentos: frequência alta pode ser café, escada ou susto. O número
> entra como contexto do check-in; o app não conclui emoção a partir dele.

## Como os dois apps conversam

```
celular  --(DataClient  /mellow/state )-->  relógio    estado para exibir
relógio  --(MessageClient /mellow/checkin)--> celular   check-in para gravar
```

O relógio **não tem sessão do Supabase**, de propósito — a credencial é do app
do celular. Então o relógio registra e o celular grava.

**Consequência honesta:** um check-in feito no relógio entra no histórico
quando o app do celular for aberto, não no instante do toque. O serviço que
recebe no celular roda sem a sessão autenticada, então ele só enfileira.

### Os dois apps precisam da mesma assinatura

O Data Layer só entrega mensagens entre apps com o **mesmo `applicationId`** e a
**mesma chave de assinatura**. Com chaves diferentes os dois simplesmente não se
enxergam — e sem nenhum erro visível, as mensagens somem.

Por isso `wear/app/debug.keystore` é cópia de `app/android/app/debug.keystore`
(a chave de debug pública do template React Native, `CN=Android Debug`, válida
até 2052 — não é segredo). Está versionada aqui porque `app/android/` é gerada
pelo prebuild e está no `.gitignore`.

Conferir que batem:

```powershell
$bt = "C:\Android\build-tools\36.0.0"
& "$bt\apksigner.bat" verify --print-certs wear\app\build\outputs\apk\release\app-release.apk | findstr SHA-1
& "$bt\apksigner.bat" verify --print-certs app\android\app\build\outputs\apk\release\app-release.apk | findstr SHA-1
```

As duas linhas têm de ser idênticas. Hoje: `5e8f1606...`.

> **Ao migrar para uma chave de release de verdade, os dois apps precisam passar
> a usar a mesma**, ou o relógio para de falar com o celular.

## 1. Compilar

```powershell
cd C:\Users\<voce>\Desktop\Pessoal\MellowPet\wear
.\gradlew.bat :app:assembleRelease
```

Sai em:

```
wear\app\build\outputs\apk\release\app-release.apk
```

(~24 MB. A primeira compilação baixa as dependências e leva alguns minutos.)

Diferente do app do celular, este projeto **não precisa do caminho curto**
(`C:\src`): ele não tem `node_modules`, então não chega perto do limite de 260
caracteres do Windows.

## 2. Conectar o relógio ao `adb`

O Watch 4 não tem porta USB. A instalação é por **Wi-Fi** ou por **Bluetooth**.
Wi-Fi é mais simples e é o caminho recomendado.

### No relógio, uma vez

1. **Configurações → Sobre o relógio → Software** e toque **7 vezes** em
   *Número da versão*. Aparece "modo desenvolvedor ativado".
2. Volte. Agora existe **Configurações → Opções do desenvolvedor**.
3. Ligue **Depuração ADB**.
4. Ligue **Depuração por Wi-Fi** (ou "Depurar via Wi-Fi").
5. O relógio mostra o **IP e a porta**, algo como `192.168.0.42:5555`.

O relógio e o PC precisam estar **na mesma rede Wi-Fi**.

6. Ainda em Opções do desenvolvedor, ligue **Permanecer ativo**
   (*Stay awake while charging*). Sem isso a tela apaga em segundos, o Wi-Fi
   entra em baixo consumo e **a conexão do `adb` cai no meio do `install`** —
   e ao religar a porta muda, exigindo parear de novo.

> **O carregador não serve para `adb`.** O berço do Watch 4 é só energia: é um
> carregador sem fio, sem linhas de dados. Ligá-lo no PC não faz o relógio
> aparecer no `adb devices`, e nenhum driver resolve. Wi-Fi é o caminho.

### No PC

```powershell
adb connect 192.168.0.42:5555
adb devices -l
```

Deve aparecer uma linha com o IP e `device`. Na primeira conexão o **relógio
mostra um pedido de autorização** — toque em *Sempre permitir*. Enquanto não
autorizar, `adb devices` mostra `unauthorized`.

## 3. Instalar

Com mais de um aparelho conectado (celular e relógio), o `adb` exige dizer qual.
Use `-s` com o id do relógio:

```powershell
adb -s 192.168.0.42:5555 install -r wear\app\build\outputs\apk\release\app-release.apk
```

Confirmar que entrou:

```powershell
adb -s 192.168.0.42:5555 shell dumpsys package com.mellowpet.app | findstr "versionName lastUpdateTime"
```

Depois, no relógio: lista de apps → **MellowPet**.

## 4. Primeira execução

1. Abra o app. Ele pede **permissão de sensores corporais** — é o que libera os
   batimentos. Recusar não quebra nada: o check-in continua funcionando, só sem
   o número.
2. Toque em **Como estou** e escolha uma emoção.
3. Abra o app no **celular**. É nesse momento que o check-in do relógio vira
   linha no banco e aparece no diário e no mapa emocional.

### Adicionar o Tile

No mostrador, deslize para a esquerda até o fim → **+** → escolha **Mellow**.

## Erros conhecidos

| Sintoma | Causa | O que fazer |
|---|---|---|
| `adb devices` mostra `unauthorized` | Falta autorizar no relógio | Toque em *Sempre permitir* na tela do relógio |
| `adb connect` dá timeout | PC e relógio em redes diferentes, ou a depuração Wi-Fi desligou | Confira a rede; a porta muda ao reativar |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Já existe um MellowPet no relógio com outra assinatura | `adb -s <relogio> uninstall com.mellowpet.app` e instale de novo |
| App instala mas o celular não recebe os check-ins | Assinaturas diferentes, ou Play Services desatualizado no relógio | Compare os SHA-1 (acima) |
| Fica "medindo…" e não sai | Pulso frouxo ou sensor sem contato | Aperte a pulseira; o sensor precisa encostar na pele |
| "N aguardando o celular" não zera | Celular fora de alcance, ou app do celular nunca aberto | Aproxime e abra o app no celular |
| `adb install` foi para o celular | Dois aparelhos conectados, sem `-s` | Sempre use `-s <id-do-relogio>` |
| `device offline` no meio do trabalho | A tela apagou e o Wi-Fi dormiu | Ligue *Permanecer ativo*; reconecte e, se a porta mudou, pareie de novo |
| Relógio não aparece com o carregador no PC | O berço é só energia, sem dados | Use Wi-Fi; não há caminho USB no Watch 4 |

## Limites desta versão

- **Instalado e rodando num Watch 4 real** (SM-R870, Wear OS 5 / API 34): o
  bichinho desenha, o seletor de emoções funciona e os batimentos medem. O que
  **não** foi validado é a entrega ao celular: o Data Layer precisa dos dois
  aparelhos conectados ao mesmo tempo, e o celular não estava disponível.
- O bichinho é sempre a **foca**. O celular ainda não envia qual pet o dono
  escolheu.
- O anel do mostrador mostra a **sequência de dias**, não o índice de bem-estar
  que o design pede: esse número é calculado no celular e ainda não é enviado.
- A faixa da tela de batimento vem do **bpm medido**, não da tabela de
  "estresse por emoção" do design. Derivar um índice de estresse da emoção
  declarada seria apresentar palpite como medição.
- O **Tile não desenha o bichinho** — Tile usa ProtoLayout, não Compose, e o
  desenho depende do Canvas do Compose. Mostra emoção e nível em texto.
- **Sem tags e sem nota** no check-in do relógio: não há teclado. Essas entram
  pelo celular.
- O check-in do relógio grava `detectedEmotion` nulo. Isso é correto, não uma
  falta: sem câmera não há leitura para comparar, e inventar uma falsearia a
  estatística de autopercepção × detecção do mapa emocional.
