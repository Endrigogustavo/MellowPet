# 🐾 MellowPet — Sistema Inteligente de Detecção Emocional

Bem-vindo ao MellowPet! Um sistema completo de identificação emocional em tempo real com insights de IA e o **Mellow** — a foquinha que percebe como você está antes de você mesmo.

## O que é MellowPet?

MellowPet é uma plataforma integrada de detecção contínua de expressões faciais que combina:
- **Análise emocional em tempo real** com modelos de Deep Learning
- **Pet virtual interativo** que reage às suas emoções
- **Insights comportamentais** gerados por IA
- **Alertas inteligentes** para emoções negativas prolongadas
- **Dashboard analítico** com histórico emocional

O sistema foi desenvolvido para facilitar o monitoramento do bem-estar emocional através de uma experiência lúdica e intuitiva.

## Objetivo

Criar uma rede de aplicações de bem-estar emocional que:
- Otimiza recursos através de uma arquitetura modular e reutilizável
- Reduz barreiras de entrada para implementação de detecção emocional
- Promove inovação em saúde mental e bem-estar digital
- Facilita integração entre diferentes plataformas (mobile, IoT)

## Histórico

A ideia do MellowPet nasceu da necessidade de criar ferramentas acessíveis para monitoramento de bem-estar emocional. Inspirado em plataformas de saúde digital e sistemas de IA empática, o projeto busca democratizar o acesso a tecnologias de detecção emocional.

## Modelo

MellowPet segue um modelo **modular e extensível**:
- **API Backend**: serviço centralizado de análise emocional
- **App Mobile**: interface intuitiva com pet virtual
- **Dispositivos IoT**: suporte para Raspberry Pi e outros dispositivos
- **Integração com IA**: Claude API para insights contextualizados

Cada componente pode funcionar independentemente ou integrado, permitindo diferentes formas de participação e uso.

## Formas de Participação

### Usuários Finais
- Utilizam o app mobile para monitoramento emocional
- Recebem alertas e insights personalizados
- Interagem com o pet virtual

### Desenvolvedores
- Integram a API em suas aplicações
- Desenvolvem novos componentes e extensões
- Contribuem com melhorias e novas funcionalidades

### Instituições
- Implementam soluções customizadas
- Integram com sistemas existentes
- Participam da evolução da plataforma

## Acesso aos Dados

Os dados do MellowPet são:
- **Privados por padrão**: armazenados localmente no dispositivo do usuário
- **Sincronizáveis**: opcionalmente sincronizados com backend
- **Auditáveis**: logs estruturados de todas as operações
- **Exportáveis**: dados podem ser exportados em formatos padrão

---

## Estrutura do Projeto

```
mellowpet/
├── api/                  # Backend FastAPI (Python)
│   ├── config.py         # Config por env + trava de produção
│   ├── main.py           # Entry point e middlewares
│   ├── routers/          # Endpoints da API
│   ├── services/         # Lógica de negócio
│   └── utils/
│       ├── database.py   # SQLite + tabelas
│       ├── logger.py     # Logging
│       └── security.py   # API key, rate limit, limite de corpo
├── app/                  # App React Native (Expo)
│   ├── app.config.js     # Config nativa por perfil de build
│   ├── eas.json          # Perfis de build do EAS
│   ├── assets/           # Ícones/splash gerados (não editar à mão)
│   ├── src/
│   │   ├── screens/      # Telas da aplicação
│   │   ├── components/   # Componentes (inclui MellowMark)
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # Integração com API
│   │   └── theme/        # Design tokens
│   └── App.tsx           # Entry point
├── brand/                # Identidade visual
│   ├── mellow_mark.py    # Geometria do Mellow (fonte da verdade)
│   ├── generate_assets.py# Gera os PNGs de app/assets/
│   └── *.svg             # Logo, ícone e marca monocromática
└── docs/
    └── iot_hardware.md   # Especificação de hardware IoT
```

### Identidade visual

O Mellow é uma foca desenhada em geometria vetorial. Todos os assets derivam de
um único arquivo, então a marca nunca diverge entre design e app:

```bash
python brand/generate_assets.py    # requer apenas Pillow
```

| Variante | Onde é usada |
|----------|--------------|
| Fundo escuro (selo claro sobre `#4A3550`) | ícone do app / launcher |
| Monocromática | dentro do app (`MellowMark.tsx`) |
| Colorida | material de marca |

Paleta: `#FFC9A8` · `#F3AEB6` · `#C6A9F0` · `#4A3550`

---

## Como Rodar (Passo a Passo)

### 1. API Backend

```bash
cd api

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate       # Linux/macOS
# ou: venv\Scripts\activate    # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env

# Gere a API key e cole no .env (API_KEY=...). A mesma chave vai no app.
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Opcional: ANTHROPIC_API_KEY para chat e insights (sem ela há fallback)

# Rodar
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# ou: ./run_api.sh
```

Acesse:
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health

Em desenvolvimento a API sobe mesmo sem `API_KEY`, apenas registrando um aviso.
Com `APP_ENV=production` ela **se recusa a subir** se a configuração estiver
insegura — veja o checklist em [api/README.md](api/README.md).

---

### 2. App Mobile

```bash
cd app

# Instalar dependências
npm install

# Configurar a API
cp .env.example .env.local
# Edite .env.local:
#   EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:8000   (emulador: http://10.0.2.2:8000)
#   EXPO_PUBLIC_API_KEY=<a mesma chave do api/.env>

# Rodar
npm start
npm run android    # ou: npm run ios
```

> Se a tela ficar sem dados e o console mostrar `401`, a chave do app e a da API
> estão diferentes.

---

## Funcionalidades Implementadas

### API
- `POST /api/v1/emotion/analyze` — Análise de frames em tempo real
- `GET /api/v1/history/` — Histórico de eventos emocionais
- `GET /api/v1/history/summary` — Resumo por período
- `GET /api/v1/dashboard/overview` — Dashboard completo com IA
- `POST /api/v1/chat/` — Chat empático contextualizado
- `POST /api/v1/alerts/emotion` — Alertas de emoção negativa
- `POST /api/v1/alerts/no-face` — Alerta sem rosto detectado (10min)
- Banco SQLite com persistência de eventos
- Logs estruturados, tratamento de erros
- Documentação Swagger automática

### App Mobile
- Câmera rodando em background (invisível)
- Análise a cada 700ms sem interação do usuário
- Pet virtual animado (cachorro e gato) em SVG
- Animações por emoção: bounce, shake, pulse, float
- Badge com emoção + confiança + mensagem empática
- Sugestões musicais por emoção
- Dashboard com gráficos (PieChart + BarChart)
- Insight gerado por IA
- Chat empático (integrado com API)
- Configurações: nome/tipo do pet, contatos de emergência, alertas
- Estado global com Zustand
- Design system completo (branco gelo, tipografia, espaçamentos)

### IoT
- Especificação completa de hardware
- Lista de componentes com modelos recomendados
- Diagrama de conexões
- Descrição de design físico e experiência do usuário

---

## Arquitetura

```
┌──────────────┐     frame (base64)     ┌──────────────┐
│  App Mobile  │ ──────────────────────▶│  FastAPI     │
│  React Native│ ◀─────────────────────│  (Python)    │
└──────────────┘   emotion + message    │              │
                                        │  DeepFace /  │
┌──────────────┐     frame (base64)     │  OpenCV      │
│  IoT Device  │ ──────────────────────▶│              │
│  Raspberry Pi│ ◀─────────────────────│  Anthropic   │
└──────────────┘   emotion + LEDs       │  Claude API  │
                                        └──────────────┘
                                               │
                                         SQLite DB
```

---

## Configurações de IA (Opcional mas Recomendado)

O sistema funciona sem IA configurada (modo fallback), mas para:
- **Chat empático contextualizado**: adicione `ANTHROPIC_API_KEY` no `.env`
- **Insights do dashboard**: mesma chave acima

---

## Tecnologia

### Stack Utilizado

| Camada | Stack |
|--------|-------|
| API | Python 3.11+, FastAPI, DeepFace, OpenCV, SQLite |
| App | React Native 0.81, TypeScript, Zustand, React Navigation, Expo |
| IA | Anthropic Claude API, OpenAI API |
| IoT | Raspberry Pi 5, Python, rpi_ws281x, pygame |

### Topologia de Componentes

**API Backend (Núcleo)**
- Responsável pelo processamento de frames e análise emocional
- Gerencia persistência de dados e histórico
- Coordena alertas e notificações
- Integra com serviços de IA

**App Mobile (Cliente)**
- Captura contínua de frames da câmera
- Interface intuitiva com pet virtual
- Sincronização com backend
- Notificações e alertas em tempo real

**Dispositivos IoT (Extensão)**
- Suporte para Raspberry Pi e similares
- Feedback visual (LEDs) baseado em emoções
- Integração com ecossistema smart home

---

## Governança

### Princípios de Desenvolvimento

- **Modularidade**: componentes independentes e reutilizáveis
- **Extensibilidade**: fácil integração de novos serviços
- **Qualidade**: testes automatizados e validação contínua
- **Documentação**: código bem documentado e exemplos práticos
- **Segurança**: proteção de dados e privacidade do usuário

### Decisões Técnicas

| Decisão | Justificativa |
|---------|---------------|
| FastAPI | Performance, async nativo, documentação automática |
| React Native + Expo | Cross-platform, desenvolvimento rápido, hot reload |
| SQLite | Leve, sem dependências externas, ideal para MVP |
| DeepFace | Modelos pré-treinados, alta precisão em detecção emocional |
| Zustand | State management simples e eficiente |
| Claude API | IA empática e contextualizada para insights |

### Roadmap

- [x] Detecção de emoções em tempo real
- [x] Pet virtual com animações
- [x] Dashboard com histórico
- [x] Chat empático com IA
- [x] Alertas inteligentes
- [x] Identidade visual e assets de loja
- [x] Endurecimento para produção (API key, rate limit, CORS)
- [ ] Autenticação de usuário (login + dados isolados por conta)
- [ ] Suporte a múltiplos idiomas
- [ ] Integração com wearables
- [ ] Análise preditiva de bem-estar
- [ ] Comunidade e compartilhamento de insights

---

## Qualidade e Segurança

### Padrões de Código

- **TypeScript strict mode** no frontend
- **Type hints** em todo código Python
- **Linting automático** com ESLint e Pylint
- **Formatação** com Prettier e Black
- **Testes unitários** para lógica crítica

### Segurança

Controles implementados e verificáveis no código:

| Controle | Onde |
|----------|------|
| API key (`X-API-Key`) nas rotas `/api/v1/*` | `api/utils/security.py` |
| Rate limit por IP (120/min, ajustável) | `api/utils/security.py` |
| Limite de corpo (6 MB) e de frame (4 MB) | `api/utils/security.py`, `api/routers/emotion.py` |
| CORS por allowlist, sem credenciais | `api/main.py` |
| Erro 500 sem stacktrace no corpo da resposta | `api/main.py` |
| Erro de validação sem ecoar o frame enviado | `api/main.py` |
| Allowlist de destinatários de e-mail | `api/routers/alerts.py` |
| Escape de HTML e do Subject nos e-mails | `api/services/alert_service.py` |
| Consulta de histórico exige `session_id`/`user_id` | `api/routers/history.py` |
| Boot bloqueado se a config de produção estiver insegura | `api/config.py` |
| Container non-root com healthcheck | `api/Dockerfile` |
| Banco e segredos fora do versionamento | `.gitignore` |

**O que ainda não existe** — importante para quem for usar isto com dados reais:

- **Não há autenticação de usuário.** Quem tiver a API key e um `session_id`
  válido lê o histórico daquela sessão. A key vai embutida no app e é extraível
  de um APK, então ela barra terceiros, não usuários do próprio app.
- **Dados não são criptografados em repouso.** O SQLite guarda histórico
  emocional em texto claro; proteja o volume.
- **O rate limit é por processo.** Com várias réplicas, use o gateway ou Redis.

Antes de tratar dados de pessoas reais, implemente login e isolamento por conta.

### Observabilidade

- Logs estruturados com nível configurável (`LOG_LEVEL`)
- Log de método, rota, status e duração por requisição
- Healthcheck em `/health` (usado pelo Docker e por load balancers)

---


## Créditos
Endrigo Gustavo Brandão de Oliveira
Gabriel Messias da Silva
Pedro Fernandes Araújo
