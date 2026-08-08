"""
Tools Router — Emotion-aware quick actions, recovery plans, and wellness tools
"""
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)


# ── Shared Models ──────────────────────────────────────────────────────────────

class ToolItem(BaseModel):
    id: str
    title: str
    subtitle: str
    icon: str
    action: str
    accent: bool = False


class ToolsResponse(BaseModel):
    emotion: str
    confidence: float
    support_message: str
    suggested_tools: list[ToolItem]
    micro_plan: list[str]
    focus_mode_hint: str


class BreathingProtocolResponse(BaseModel):
    emotion: str
    cycle_seconds: int
    inhale_seconds: int
    hold_seconds: int
    exhale_seconds: int
    hold_after_exhale_seconds: int
    rounds: int
    intro: str


class DailyContentResponse(BaseModel):
    emotion: str
    affirmation: str
    journal_prompt: str
    reset_prompt: str


class MeditationSession(BaseModel):
    emotion: str
    title: str
    duration_minutes: int
    technique: str
    guide_steps: list[str]
    closing_message: str


class GroundingExercise(BaseModel):
    emotion: str
    title: str
    technique: str
    steps: list[str]
    duration_seconds: int
    tip: str


class JournalPrompts(BaseModel):
    emotion: str
    prompts: list[str]
    guided_questions: list[str]
    reflection_closing: str


class CognitiveReframing(BaseModel):
    emotion: str
    automatic_thought_example: str
    cognitive_distortion: str
    reframed_thought: str
    steps: list[str]
    practice_prompt: str


class MuscleRelaxation(BaseModel):
    emotion: str
    title: str
    duration_minutes: int
    body_groups: list[dict]
    closing_message: str


class SleepHygiene(BaseModel):
    emotion: str
    tips: list[str]
    wind_down_routine: list[str]
    avoid_list: list[str]
    bedtime_affirmation: str


class EmotionEducation(BaseModel):
    emotion: str
    what_it_is: str
    why_it_happens: str
    body_signals: list[str]
    healthy_responses: list[str]
    unhealthy_patterns: list[str]
    fun_fact: str


class GratitudePractice(BaseModel):
    emotion: str
    prompts: list[str]
    micro_gratitude: str
    sharing_prompt: str


class SocialConnection(BaseModel):
    emotion: str
    suggestions: list[str]
    conversation_starters: list[str]
    boundary_tip: str


class CrisisResources(BaseModel):
    emotion: str
    severity: str
    immediate_actions: list[str]
    hotlines: list[dict]
    safety_plan_steps: list[str]
    grounding_quick: str


class EnergyBoost(BaseModel):
    emotion: str
    physical_activities: list[dict]
    quick_wins: list[str]
    nutrition_tip: str
    hydration_reminder: str


class FocusMode(BaseModel):
    emotion: str
    technique: str
    duration_minutes: int
    steps: list[str]
    distraction_blockers: list[str]
    reward_after: str


class EmotionPlaylist(BaseModel):
    emotion: str
    mood_label: str
    genres: list[str]
    curated_tracks: list[dict]
    ambient_sounds: list[str]


class BodyScan(BaseModel):
    emotion: str
    title: str
    duration_minutes: int
    body_areas: list[dict]
    closing_message: str


class Visualization(BaseModel):
    emotion: str
    title: str
    scenario: str
    guided_steps: list[str]
    sensory_details: dict
    duration_minutes: int
    closing_affirmation: str


class PositiveAffirmations(BaseModel):
    emotion: str
    affirmations: list[str]
    mirror_exercise: str
    repeat_count: int
    closing: str


class EmotionWheel(BaseModel):
    emotion: str
    primary_emotion: str
    secondary_emotions: list[str]
    nuanced_feelings: list[str]
    description: str
    body_map: list[str]
    coping_match: list[str]


# ── Builders ───────────────────────────────────────────────────────────────────

def _build_daily_content(emotion: str) -> DailyContentResponse:
    catalog = {
        "happy": {
            "affirmation": "Eu valorizo esse momento bom e posso usá-lo com intenção.",
            "journal_prompt": "Que pequena vitória de hoje merece ser registrada?",
            "reset_prompt": "Qual próxima ação simples mantém essa energia viva?",
        },
        "sad": {
            "affirmation": "Eu posso sentir tudo isso e ainda dar um passo pequeno e gentil.",
            "journal_prompt": "O que mais está pesando agora, sem filtro?",
            "reset_prompt": "Qual ação mínima me ajudaria nos próximos 10 minutos?",
        },
        "anxious": {
            "affirmation": "Eu volto para o agora, um ciclo de respiração por vez.",
            "journal_prompt": "Qual medo está mais alto agora e o que é fato sobre ele?",
            "reset_prompt": "O que está no meu controle imediato neste instante?",
        },
        "fearful": {
            "affirmation": "Eu posso buscar segurança em passos curtos e claros.",
            "journal_prompt": "O que eu preciso para me sentir 10% mais seguro agora?",
            "reset_prompt": "Quem ou o que pode me dar suporte prático hoje?",
        },
        "angry": {
            "affirmation": "Eu posso pausar, descarregar tensão e escolher com clareza.",
            "journal_prompt": "O que cruzou meu limite e como quero comunicar isso depois?",
            "reset_prompt": "O que evita que eu responda no impulso agora?",
        },
        "neutral": {
            "affirmation": "Consistência pequena também é progresso real.",
            "journal_prompt": "Qual tarefa curta merece prioridade agora?",
            "reset_prompt": "Que passo de 5 minutos eu posso concluir já?",
        },
        "surprised": {
            "affirmation": "A surpresa é uma porta para a curiosidade e o aprendizado.",
            "journal_prompt": "O que me surpreendeu hoje e o que posso aprender com isso?",
            "reset_prompt": "Como posso transformar essa energia em ação?",
        },
        "disgusted": {
            "affirmation": "Eu posso reconhecer o desconforto e escolher me afastar com calma.",
            "journal_prompt": "O que me causou desconforto e como posso lidar melhor?",
            "reset_prompt": "O que posso fazer agora para recuperar conforto?",
        },
    }
    selected = catalog.get(emotion, catalog["neutral"])
    return DailyContentResponse(emotion=emotion, **selected)


def _build_breathing_protocol(emotion: str, confidence: float) -> BreathingProtocolResponse:
    if emotion in {"sad", "anxious", "fearful"}:
        rounds = 7 if confidence >= 0.7 else 5
        return BreathingProtocolResponse(
            emotion=emotion,
            cycle_seconds=16,
            inhale_seconds=4,
            hold_seconds=4,
            exhale_seconds=4,
            hold_after_exhale_seconds=4,
            rounds=rounds,
            intro="Respiração em caixa para reduzir ativação e recuperar foco.",
        )
    if emotion == "angry":
        rounds = 6 if confidence >= 0.7 else 4
        return BreathingProtocolResponse(
            emotion=emotion,
            cycle_seconds=14,
            inhale_seconds=4,
            hold_seconds=2,
            exhale_seconds=6,
            hold_after_exhale_seconds=2,
            rounds=rounds,
            intro="Expiração mais longa para ajudar a baixar a intensidade.",
        )

    return BreathingProtocolResponse(
        emotion=emotion,
        cycle_seconds=12,
        inhale_seconds=4,
        hold_seconds=2,
        exhale_seconds=4,
        hold_after_exhale_seconds=2,
        rounds=4,
        intro="Respiração de manutenção para estabilizar presença e energia.",
    )


def _build_meditation(emotion: str, duration: int) -> MeditationSession:
    sessions = {
        "sad": MeditationSession(
            emotion=emotion,
            title="Meditação de Autocompaixão",
            duration_minutes=duration,
            technique="loving-kindness",
            guide_steps=[
                "Sente-se confortavelmente e feche os olhos.",
                "Coloque a mão no peito e sinta sua respiração.",
                "Repita: 'Que eu possa ser gentil comigo mesmo.'",
                "Repita: 'Que eu possa aceitar o que sinto agora.'",
                "Repita: 'Que eu possa encontrar paz mesmo na dor.'",
                "Imagine um abraço caloroso envolvendo todo o seu corpo.",
                f"Continue respirando suavemente por {duration} minutos.",
                "Quando estiver pronto, abra os olhos lentamente.",
            ],
            closing_message="Você merece compaixão, especialmente dos seus próprios pensamentos.",
        ),
        "anxious": MeditationSession(
            emotion=emotion,
            title="Meditação de Ancoragem",
            duration_minutes=duration,
            technique="body-scan-anchor",
            guide_steps=[
                "Sente-se com os pés firmes no chão.",
                "Pressione levemente os pés contra o chão e sinta o peso.",
                "Inspire contando até 4, expire contando até 6.",
                "Escaneie o corpo: pés, pernas, abdômen, peito, ombros, rosto.",
                "Em cada área, solte a tensão com a expiração.",
                "Se a mente vagar, volte para a sensação dos pés no chão.",
                f"Continue por {duration} minutos, sem pressa.",
                "Abra os olhos e perceba o espaço ao seu redor.",
            ],
            closing_message="Você está aqui, agora, e isso é suficiente.",
        ),
        "angry": MeditationSession(
            emotion=emotion,
            title="Meditação de Descarga",
            duration_minutes=duration,
            technique="release-breathwork",
            guide_steps=[
                "Sente-se e reconheça a raiva sem julgá-la.",
                "Inspire profundamente pelo nariz (4 segundos).",
                "Segure brevemente (2 segundos).",
                "Expire com força pela boca, como um suspiro (6 segundos).",
                "Imagine a tensão saindo como fumaça escura a cada expiração.",
                "Repita 8 ciclos dessa respiração de descarga.",
                "Contraia e solte os punhos 3 vezes.",
                "Termine com 3 respirações lentas e suaves.",
            ],
            closing_message="A raiva é informação. Agora você pode escolher o que fazer com ela.",
        ),
        "fearful": MeditationSession(
            emotion=emotion,
            title="Meditação de Segurança Interna",
            duration_minutes=duration,
            technique="safe-place-visualization",
            guide_steps=[
                "Feche os olhos e imagine um lugar onde você se sente completamente seguro.",
                "Pode ser real ou imaginário — praia, floresta, quarto acolhedor.",
                "Visualize cada detalhe: cores, sons, cheiros, temperatura.",
                "Sinta seus pés tocando o chão nesse lugar seguro.",
                "Respire calmamente e repita: 'Eu estou seguro aqui.'",
                f"Permaneça nesse lugar por {duration} minutos.",
                "Quando estiver pronto, traga essa sensação de segurança de volta.",
                "Abra os olhos, sabendo que pode voltar a esse lugar sempre que precisar.",
            ],
            closing_message="Seu lugar seguro existe dentro de você, sempre acessível.",
        ),
    }

    default = MeditationSession(
        emotion=emotion,
        title="Meditação de Presença",
        duration_minutes=duration,
        technique="mindfulness",
        guide_steps=[
            "Sente-se confortavelmente com a coluna reta.",
            "Feche os olhos e leve atenção à respiração.",
            "Não tente mudar nada — apenas observe o ar entrando e saindo.",
            "Se pensamentos surgirem, reconheça e volte para a respiração.",
            "Observe as sensações no corpo sem julgamento.",
            f"Continue por {duration} minutos.",
            "Antes de abrir os olhos, perceba os sons ao redor.",
            "Abra os olhos lentamente e aproveite essa clareza.",
        ],
        closing_message="Cada momento de presença é um pequeno progresso.",
    )

    return sessions.get(emotion, default)


def _build_grounding(emotion: str) -> GroundingExercise:
    exercises = {
        "anxious": GroundingExercise(
            emotion=emotion,
            title="Aterramento 5-4-3-2-1",
            technique="sensorial",
            steps=[
                "Observe 5 coisas que você pode VER ao seu redor.",
                "Toque 4 coisas e note a textura (mesa, tecido, pele, cabelo).",
                "Escute 3 sons diferentes (relógio, vento, respiração).",
                "Identifique 2 cheiros (café, ar fresco, sabonete).",
                "Sinta 1 sabor (beba água ou coma algo com atenção).",
            ],
            duration_seconds=120,
            tip="Fale em voz alta o que está percebendo para reforçar a presença.",
        ),
        "fearful": GroundingExercise(
            emotion=emotion,
            title="Aterramento Físico de Segurança",
            technique="corporal",
            steps=[
                "Pressione os pés firmes no chão por 10 segundos.",
                "Aperte as mãos uma contra a outra por 5 segundos e solte.",
                "Coloque as mãos sob água corrente fria por 15 segundos.",
                "Nomeie em voz alta: onde estou, que dia é, que horas são.",
                "Repita: 'Eu estou aqui, eu estou seguro, isso vai passar.'",
            ],
            duration_seconds=90,
            tip="O contato físico com superfícies firmes ajuda o cérebro a sair do modo alerta.",
        ),
        "angry": GroundingExercise(
            emotion=emotion,
            title="Descarga Corporal Rápida",
            technique="movement",
            steps=[
                "Fique de pé e sacuda as mãos por 15 segundos.",
                "Faça 10 agachamentos rápidos ou marche no lugar.",
                "Contraia todo o corpo por 5 segundos e solte de uma vez.",
                "Lave o rosto com água fria por 20 segundos.",
                "Respire 3 ciclos lentos: 4 inspire, 6 expire.",
            ],
            duration_seconds=90,
            tip="Movimento físico metaboliza a adrenalina da raiva mais rápido que qualquer técnica mental.",
        ),
    }

    default = GroundingExercise(
        emotion=emotion,
        title="Aterramento de Presença",
        technique="awareness",
        steps=[
            "Pause o que está fazendo por 30 segundos.",
            "Olhe ao redor e nomeie 3 objetos em voz alta.",
            "Sinta os pés no chão e a cadeira te apoiando.",
            "Respire 3 ciclos lentos e profundos.",
            "Pergunte: 'O que precisa da minha atenção agora?'",
        ],
        duration_seconds=60,
        tip="Micropausas de presença previnem acúmulo emocional ao longo do dia.",
    )

    return exercises.get(emotion, default)


def _build_journal_prompts(emotion: str) -> JournalPrompts:
    prompts_map = {
        "happy": JournalPrompts(
            emotion=emotion,
            prompts=[
                "O que aconteceu hoje que me fez sorrir?",
                "Qual pessoa contribuiu para essa alegria?",
                "Como posso recriar esse momento mais vezes?",
                "O que estou orgulhoso de ter feito esta semana?",
                "Que atitude minha trouxe esse resultado positivo?",
            ],
            guided_questions=[
                "Descreva o momento em 3 frases curtas.",
                "Que emoção secundária acompanhou a felicidade?",
                "Se pudesse enviar uma mensagem para si mesmo ontem, diria o quê?",
            ],
            reflection_closing="Registro de alegria fortalece a memória positiva e motiva ações futuras.",
        ),
        "sad": JournalPrompts(
            emotion=emotion,
            prompts=[
                "O que está mais pesado neste momento?",
                "Se minha tristeza pudesse falar, o que diria?",
                "O que eu preciso que alguém me diga agora?",
                "Qual parte disso está no meu controle e qual não está?",
                "Quando foi a última vez que me senti bem e o que era diferente?",
            ],
            guided_questions=[
                "Sem filtro, escreva 5 palavras que descrevem como você se sente.",
                "Se esse sentimento fosse uma cor/forma, como seria?",
                "O que tornaria amanhã 5% melhor?",
            ],
            reflection_closing="Escrever sobre dor sem julgamento é uma forma de processamento emocional.",
        ),
        "angry": JournalPrompts(
            emotion=emotion,
            prompts=[
                "O que cruzou meu limite hoje?",
                "Qual necessidade minha não está sendo atendida?",
                "Se eu estivesse calmo, como responderia a isso?",
                "O que eu quero que mude nesta situação?",
                "Existe uma parte disso que eu posso controlar?",
            ],
            guided_questions=[
                "Onde no corpo você sente a raiva? Descreva.",
                "Essa raiva é sobre a situação atual ou algo mais antigo?",
                "Qual seria o desfecho ideal para você?",
            ],
            reflection_closing="A raiva processada se transforma em clareza e assertividade.",
        ),
        "anxious": JournalPrompts(
            emotion=emotion,
            prompts=[
                "Qual é meu maior 'e se...' agora?",
                "O que é fato e o que é suposição nesta preocupação?",
                "Qual foi a pior coisa que imaginei que nunca aconteceu?",
                "O que está no meu controle nos próximos 30 minutos?",
                "Se eu parasse de planejar por 5 minutos, o que aconteceria?",
            ],
            guided_questions=[
                "Liste 3 preocupações e classifique cada uma: controlável ou incontrolável?",
                "Imagine que tudo deu certo. O que você diria para o 'eu' de agora?",
                "Qual a menor ação que reduziria sua ansiedade hoje?",
            ],
            reflection_closing="Ansiedade no papel perde poder. Você está retomando o controle.",
        ),
    }

    default = JournalPrompts(
        emotion=emotion,
        prompts=[
            "Como estou me sentindo neste exato momento?",
            "O que aconteceu de significativo hoje?",
            "O que aprendi sobre mim mesmo esta semana?",
            "Pelo que sou grato agora?",
            "O que quero priorizar amanhã?",
        ],
        guided_questions=[
            "Se tivesse que resumir seu dia em 3 palavras, quais seriam?",
            "Que hábito novo gostaria de começar?",
            "Qual relação merece mais atenção nesta semana?",
        ],
        reflection_closing="O hábito de escrever constrói autoconhecimento dia após dia.",
    )

    return prompts_map.get(emotion, default)


def _build_cognitive_reframing(emotion: str) -> CognitiveReframing:
    catalog = {
        "sad": CognitiveReframing(
            emotion=emotion,
            automatic_thought_example="Nada vai melhorar. É sempre assim.",
            cognitive_distortion="Pensamento tudo-ou-nada + Previsão catastrófica",
            reframed_thought="Está difícil agora, mas já passei por momentos ruins antes e sobrevivi. Não preciso resolver tudo hoje.",
            steps=[
                "Identifique o pensamento automático (o que passou pela mente).",
                "Pergunte: isso é um fato ou uma interpretação?",
                "Busque evidências a favor E contra esse pensamento.",
                "Crie uma versão mais equilibrada e realista.",
                "Escreva a nova versão e releia em voz alta.",
            ],
            practice_prompt="Escreva um pensamento que está te incomodando e tente reformular usando os passos acima.",
        ),
        "anxious": CognitiveReframing(
            emotion=emotion,
            automatic_thought_example="E se tudo der errado? Não vou conseguir lidar.",
            cognitive_distortion="Catastrofização + Subestimação de recursos",
            reframed_thought="Mesmo que algo não saia como planejei, eu tenho capacidade de me adaptar. Já lidei com coisas difíceis antes.",
            steps=[
                "Perceba o 'e se...' — esse é o gatilho da catastrofização.",
                "Pergunte: qual a probabilidade real disso acontecer?",
                "Se acontecesse, qual seria meu plano B?",
                "Lembre de uma vez que lidou com algo inesperado.",
                "Substitua o 'e se der errado' por 'e se der certo?'",
            ],
            practice_prompt="Qual é seu maior 'e se...' agora? Passe pelos 5 passos e escreva a versão reformulada.",
        ),
        "angry": CognitiveReframing(
            emotion=emotion,
            automatic_thought_example="Isso é injusto! Eles fizeram de propósito.",
            cognitive_distortion="Leitura mental + Personalização",
            reframed_thought="Pode ser injusto, mas não sei a intenção do outro. Posso expressar meu limite sem presumir motivações.",
            steps=[
                "Reconheça a raiva e a valide (é legítimo sentir).",
                "Separe fato de interpretação.",
                "Considere pelo menos uma explicação alternativa.",
                "Decida: o que eu quero que mude na prática?",
                "Comunique com clareza, não com intensidade.",
            ],
            practice_prompt="Sobre o que você está com raiva? Tente identificar a interpretação e busque uma alternativa.",
        ),
    }

    default = CognitiveReframing(
        emotion=emotion,
        automatic_thought_example="Deveria estar melhor do que estou.",
        cognitive_distortion="Deveria / Comparação social",
        reframed_thought="Eu estou no meu ritmo. Progresso não é linear e cada passo conta.",
        steps=[
            "Identifique pensamentos com 'deveria', 'preciso', 'sempre', 'nunca'.",
            "Pergunte: de quem é essa expectativa?",
            "Busque evidências de progresso, por menor que seja.",
            "Reescreva com mais gentileza.",
            "Pratique a nova versão durante o dia.",
        ],
        practice_prompt="Qual pensamento 'deveria' aparece com mais frequência? Tente reformulá-lo.",
    )

    return catalog.get(emotion, default)


def _build_muscle_relaxation(emotion: str) -> MuscleRelaxation:
    intensity = "alta" if emotion in {"angry", "anxious", "fearful"} else "moderada"
    duration = 12 if emotion in {"angry", "anxious"} else 8

    body_groups = [
        {"group": "Mãos e antebraços", "instruction": "Feche os punhos com força por 5s, depois solte completamente.", "duration_seconds": 15},
        {"group": "Bíceps", "instruction": "Flexione os braços e contraia por 5s, depois relaxe.", "duration_seconds": 15},
        {"group": "Ombros", "instruction": "Levante os ombros até as orelhas por 5s, depois deixe cair.", "duration_seconds": 15},
        {"group": "Rosto", "instruction": "Aperte todos os músculos do rosto por 5s (olhos, boca, testa). Solte.", "duration_seconds": 15},
        {"group": "Pescoço", "instruction": "Incline a cabeça levemente para trás por 5s, volte ao centro e relaxe.", "duration_seconds": 15},
        {"group": "Peito e abdômen", "instruction": "Inspire fundo, contraia o abdômen por 5s. Expire e solte.", "duration_seconds": 15},
        {"group": "Costas", "instruction": "Arqueie levemente as costas por 5s, depois volte e relaxe.", "duration_seconds": 15},
        {"group": "Pernas", "instruction": "Estique as pernas e aponte os pés. Contraia por 5s. Solte.", "duration_seconds": 15},
        {"group": "Pés", "instruction": "Curve os dedos dos pés por 5s. Solte e sinta o relaxamento subindo.", "duration_seconds": 15},
    ]

    return MuscleRelaxation(
        emotion=emotion,
        title=f"Relaxamento Muscular Progressivo — Intensidade {intensity}",
        duration_minutes=duration,
        body_groups=body_groups,
        closing_message="Seu corpo está mais leve agora. Leve essa sensação para as próximas ações.",
    )


def _build_sleep_hygiene(emotion: str) -> SleepHygiene:
    base_tips = [
        "Mantenha horários regulares de dormir e acordar, mesmo nos fins de semana.",
        "Evite telas 30 minutos antes de dormir (ou use filtro de luz azul).",
        "Mantenha o quarto escuro, fresco e silencioso.",
        "Evite cafeína após as 14h.",
        "Faça uma refeição leve no jantar.",
    ]

    emotion_extras = {
        "anxious": [
            "Escreva suas preocupações em papel ANTES de deitar — tire da mente.",
            "Use a respiração 4-7-8 deitado: inspire 4s, segure 7s, expire 8s.",
            "Se não dormir em 20 min, levante e faça algo calmo até sentir sono.",
        ],
        "sad": [
            "Evite cochilar durante o dia por mais de 20 minutos.",
            "Exponha-se à luz natural pela manhã para regular o ritmo circadiano.",
            "Ouvir sons da natureza ou white noise pode acolher o silêncio.",
        ],
        "angry": [
            "Não vá para a cama com raiva não processada — escreva ou fale antes.",
            "Um banho morno 1h antes ajuda a baixar a temperatura corporal para o sono.",
            "Alongamento leve de 5 minutos antes de deitar libera tensão muscular.",
        ],
    }

    tips = base_tips + emotion_extras.get(emotion, [])

    wind_down = {
        "anxious": ["Desligar notificações 1h antes", "Escrever 3 preocupações no papel", "Chá de camomila", "Respiração 4-7-8 deitado", "Body scan mental por 5 minutos"],
        "sad": ["Ouvir uma playlist calma", "Escrever 1 coisa boa do dia", "Chá quente", "Respiração suave", "Abraçar um travesseiro ou cobertor"],
        "angry": ["Alongamento de 5 min", "Escrever o que está pesando", "Banho morno", "Respiração 4-2-6", "Desligar telas"],
    }

    avoid = [
        "Álcool antes de dormir (fragmenta o sono)",
        "Exercício intenso nas 2h antes de dormir",
        "Discussões sérias perto da hora de dormir",
        "Checar redes sociais na cama",
        "Cafeína ou chocolate à noite",
    ]

    affirmations = {
        "anxious": "Eu coloquei minhas preocupações no papel. Agora posso descansar.",
        "sad": "Amanhã é um novo começo. Eu mereço descansar esta noite.",
        "angry": "Eu posso resolver isso amanhã com mais clareza. Agora, descanso.",
        "neutral": "Eu tive um dia completo e mereço um sono reparador.",
    }

    return SleepHygiene(
        emotion=emotion,
        tips=tips,
        wind_down_routine=wind_down.get(emotion, ["Desligar telas", "Chá quente", "Respiração suave", "Escurecer o quarto", "Deitar e relaxar"]),
        avoid_list=avoid,
        bedtime_affirmation=affirmations.get(emotion, affirmations["neutral"]),
    )


def _build_emotion_education(emotion: str) -> EmotionEducation:
    catalog = {
        "happy": EmotionEducation(
            emotion=emotion,
            what_it_is="Felicidade é uma resposta emocional de prazer, satisfação ou gratidão. Pode variar de contentamento suave a euforia intensa.",
            why_it_happens="Ativada pela dopamina e serotonina quando conquistamos algo, nos conectamos socialmente ou vivenciamos prazer.",
            body_signals=["Sorriso genuíno (Duchenne — olhos e boca)", "Sensação de leveza no peito", "Energia elevada", "Vontade de socializar"],
            healthy_responses=["Registrar o momento (gratidão)", "Compartilhar com alguém", "Planejar repetir a causa", "Aproveitá-lo sem culpa"],
            unhealthy_patterns=["Buscar felicidade constantemente (hedonic treadmill)", "Sentir culpa por estar feliz", "Ignorar problemas reais"],
            fun_fact="O sorriso Duchenne ativa 2 músculos: zigomático maior (boca) e orbicular dos olhos. Quase impossível falsificar!",
        ),
        "sad": EmotionEducation(
            emotion=emotion,
            what_it_is="Tristeza é uma resposta emocional a perdas, decepções ou necessidades não atendidas. É uma das emoções mais importantes para processamento.",
            why_it_happens="Sinaliza ao cérebro que algo importante foi perdido ou não está como deveria. Promove reflexão e busca de apoio social.",
            body_signals=["Peso no peito", "Olhos lacrimejando", "Cansaço", "Vontade de se recolher", "Falta de apetite ou apetite excessivo"],
            healthy_responses=["Permitir-se sentir sem julgamento", "Buscar apoio de confiança", "Escrever sobre o que sente", "Chorar se precisar"],
            unhealthy_patterns=["Suprimir a tristeza", "Isolar-se por muito tempo", "Usar substâncias para anestesiar", "Ruminar sem ação"],
            fun_fact="Chorar libera hormônios de estresse (cortisol) e produz endorfinas. Por isso nos sentimos melhor depois de chorar.",
        ),
        "angry": EmotionEducation(
            emotion=emotion,
            what_it_is="Raiva é uma resposta emocional a ameaças, injustiças ou limites ultrapassados. É uma emoção de ação e proteção.",
            why_it_happens="Ativa o sistema de luta-ou-fuga quando percebemos injustiça, frustração ou ameaça aos nossos valores/limites.",
            body_signals=["Mandíbula cerrada", "Punhos fechados", "Calor no rosto", "Coração acelerado", "Tensão nos ombros"],
            healthy_responses=["Pausar antes de reagir", "Identificar o limite cruzado", "Comunicar com assertividade", "Exercício físico para descarga"],
            unhealthy_patterns=["Reagir por impulso", "Suprimir totalmente", "Agressão passiva", "Guardar rancor"],
            fun_fact="A raiva aumenta a confiança e a disposição para agir. Quando processada, pode ser transformadora.",
        ),
        "anxious": EmotionEducation(
            emotion=emotion,
            what_it_is="Ansiedade é uma resposta preventiva do cérebro a possíveis ameaças futuras. É medo de algo que ainda não aconteceu.",
            why_it_happens="O cérebro ativa o sistema de alerta (amígdala) como se o perigo fosse real. Evolutivamente, nos prepara para agir.",
            body_signals=["Coração acelerado", "Mãos suando", "Aperto no peito", "Dificuldade de concentração", "Pensamentos repetitivos"],
            healthy_responses=["Aterramento sensorial", "Respiração controlada", "Separar fato de suposição", "Movimento físico leve"],
            unhealthy_patterns=["Evitar tudo que causa ansiedade", "Buscar reassurance excessiva", "Catastrofizar", "Procrastinar por medo"],
            fun_fact="Ansiedade moderada melhora performance (Lei de Yerkes-Dodson). O problema é quando ultrapassa o ponto ótimo.",
        ),
        "surprised": EmotionEducation(
            emotion=emotion,
            what_it_is="Surpresa é a reação mais breve (dura <1s) e prepara o cérebro para processar informação inesperada.",
            why_it_happens="Quando algo não corresponde à expectativa, o cérebro 'para tudo' para recalibrar e entender o que aconteceu.",
            body_signals=["Olhos arregalados", "Boca aberta", "Sobrancelhas levantadas", "Pausa motora momentânea"],
            healthy_responses=["Dar-se tempo para processar", "Usar a curiosidade antes do julgamento", "Registrar o aprendizado"],
            unhealthy_patterns=["Reagir impulsivamente", "Negar a surpresa", "Ficar paralisado"],
            fun_fact="A surpresa é a única emoção que pode se transformar em qualquer outra — alegria, medo, raiva — dependendo do contexto.",
        ),
        "disgusted": EmotionEducation(
            emotion=emotion,
            what_it_is="Nojo é uma resposta de proteção que nos afasta de coisas potencialmente nocivas — físicas ou morais.",
            why_it_happens="Evolutivamente protege contra contaminação. Também ativado por violações morais e comportamentos que cruzam nossos valores.",
            body_signals=["Franzir do nariz", "Lábio superior levantado", "Sensação de mal-estar estomacal", "Vontade de se afastar"],
            healthy_responses=["Identificar o gatilho específico", "Afastar-se do estímulo", "Processar se é reação proporcional"],
            unhealthy_patterns=["Projetar nojo em pessoas", "Rigidez moral excessiva", "Evitar situações saudáveis por nojo deslocado"],
            fun_fact="O córtex insular processa tanto nojo físico quanto moral. É por isso que injustiça pode causar literal mal-estar.",
        ),
        "fearful": EmotionEducation(
            emotion=emotion,
            what_it_is="Medo é a resposta mais primitiva do cérebro a ameaças imediatas. Nos prepara para fugir, lutar ou congelar.",
            why_it_happens="A amígdala detecta perigo (real ou percebido) e ativa todo o sistema nervoso simpático em milissegundos.",
            body_signals=["Coração disparado", "Respiração rápida e curta", "Músculos tensos", "Boca seca", "Pupilas dilatadas"],
            healthy_responses=["Avaliar se o perigo é real", "Aterramento físico", "Buscar segurança prática", "Comunicar o que sente"],
            unhealthy_patterns=["Evitar todas as situações que causam medo", "Hipervigilância crônica", "Catastrofizar", "Isolar-se"],
            fun_fact="O medo é processado antes da consciência: a amígdala reage em 12ms, enquanto o córtex leva 100ms+ para analisar.",
        ),
    }

    default = EmotionEducation(
        emotion=emotion,
        what_it_is="Estado emocional equilibrado, sem ativação forte de nenhuma emoção específica.",
        why_it_happens="É o estado base do sistema nervoso quando não há estímulos emocionais significativos.",
        body_signals=["Respiração regular", "Postura relaxada", "Atenção dispersa", "Batimentos cardíacos normais"],
        healthy_responses=["Aproveitar para planejar", "Manter rotinas", "Fazer check-in emocional preventivo"],
        unhealthy_patterns=["Confundir neutralidade com apatia", "Ignorar emoções sutis", "Não usar o momento para prevenção"],
        fun_fact="O estado neutro é ideal para tomada de decisão. O cérebro racional funciona melhor sem interferência emocional forte.",
    )

    return catalog.get(emotion, default)


def _build_gratitude(emotion: str) -> GratitudePractice:
    prompts_map = {
        "sad": GratitudePractice(
            emotion=emotion,
            prompts=[
                "Uma pessoa que, mesmo de longe, torce por mim.",
                "Uma conquista pequena que já esqueci de celebrar.",
                "Algo no meu corpo que funciona e eu não agradeço.",
            ],
            micro_gratitude="Neste segundo, estou vivo e posso respirar. Isso já é motivo.",
            sharing_prompt="Envie uma mensagem curta para alguém dizendo que é importante para você.",
        ),
        "anxious": GratitudePractice(
            emotion=emotion,
            prompts=[
                "Uma situação difícil que eu sobrevivi no passado.",
                "Um recurso que tenho e que muitos não têm (saúde, teto, comida).",
                "Uma habilidade minha que me ajuda a lidar com desafios.",
            ],
            micro_gratitude="Apesar da ansiedade, eu estou aqui, tentando. Isso requer coragem.",
            sharing_prompt="Agradeça a alguém que te ajudou recentemente, mesmo que tenha sido algo pequeno.",
        ),
        "happy": GratitudePractice(
            emotion=emotion,
            prompts=[
                "O que contribuiu para essa alegria de hoje?",
                "Uma pessoa que fez diferença na sua semana.",
                "Um privilégio que você tem e que pode compartilhar.",
            ],
            micro_gratitude="Estou sentindo algo bom e valorizo este momento.",
            sharing_prompt="Use essa energia para fazer um elogio sincero a alguém.",
        ),
    }

    default = GratitudePractice(
        emotion=emotion,
        prompts=[
            "3 coisas simples pelas quais sou grato hoje.",
            "Uma lição que aprendi com uma dificuldade recente.",
            "Uma parte do meu dia que foi melhor do que esperava.",
        ],
        micro_gratitude="Existe algo de bom neste exato momento, mesmo que pequeno.",
        sharing_prompt="Pense em alguém e mande uma mensagem de agradecimento genuíno.",
    )

    return prompts_map.get(emotion, default)


def _build_social_connection(emotion: str) -> SocialConnection:
    catalog = {
        "sad": SocialConnection(
            emotion=emotion,
            suggestions=[
                "Ligue para alguém de confiança e diga apenas: 'Queria ouvir sua voz.'",
                "Mande uma mensagem honesta: 'Tô num dia difícil, posso falar com você?'",
                "Assista algo com alguém (mesmo online) para ter companhia sem pressão.",
                "Vá a um lugar público (café, parque) para sentir presença humana.",
            ],
            conversation_starters=[
                "Oi, tô precisando de um ouvido. Posso te contar?",
                "Você já se sentiu assim? Me conta como lidou.",
                "Não preciso de conselho, só quero companhia.",
            ],
            boundary_tip="Se alguém minimizar sua dor ('não é nada', 'anime-se'), busque outro apoio. Você merece validação.",
        ),
        "anxious": SocialConnection(
            emotion=emotion,
            suggestions=[
                "Peça para alguém te ligar e só conversar sobre coisas leves.",
                "Compartilhe uma preocupação com alguém de confiança.",
                "Faça uma atividade em dupla (caminhar, cozinhar) para ocupar a mente.",
                "Participe de um grupo online sobre um hobby (distração saudável).",
            ],
            conversation_starters=[
                "Tô com a cabeça a mil, posso desabafar um pouco?",
                "Me conta algo bom que aconteceu hoje — preciso de uma âncora.",
                "Vamos fazer algo juntos? Preciso de distração.",
            ],
            boundary_tip="Não precisa explicar tudo. Pedir companhia já é válido.",
        ),
        "happy": SocialConnection(
            emotion=emotion,
            suggestions=[
                "Compartilhe a boa notícia com alguém que vai celebrar com você.",
                "Mande uma mensagem de gratidão para alguém que te ajudou.",
                "Convide alguém para fazer algo divertido.",
                "Registre o momento com foto e mande para quem importa.",
            ],
            conversation_starters=[
                "Aconteceu algo bom e pensei em você!",
                "Queria dividir uma coisa boa que aconteceu.",
                "Vamos celebrar algo simples juntos?",
            ],
            boundary_tip="Compartilhar alegria sem se preocupar com julgamento fortalece relações.",
        ),
    }

    default = SocialConnection(
        emotion=emotion,
        suggestions=[
            "Mande uma mensagem curta para alguém que não fala há um tempo.",
            "Pergunte a alguém como está — de verdade.",
            "Participe de um grupo (online ou presencial) sobre algo que te interessa.",
            "Convide alguém para um café ou um passeio rápido.",
        ],
        conversation_starters=[
            "Oi! Só passando para saber como você está.",
            "Tava pensando em você. Como estão as coisas?",
            "Vamos marcar algo? Faz tempo que não conversamos.",
        ],
        boundary_tip="Conexão não precisa ser profunda. Presença leve e genuína já faz diferença.",
    )

    return catalog.get(emotion, default)


def _build_crisis_resources(emotion: str, confidence: float) -> CrisisResources:
    severity = "alta" if confidence >= 0.8 else "moderada" if confidence >= 0.5 else "leve"
    return CrisisResources(
        emotion=emotion,
        severity=severity,
        immediate_actions=[
            "Você está seguro fisicamente? Se não, vá para um lugar seguro agora.",
            "Ligue para alguém de confiança imediatamente.",
            "Se tiver pensamentos de se machucar, ligue para o CVV: 188 (24h).",
            "Respire 5 ciclos lentos: inspire 4s, expire 6s.",
            "Não tome decisões importantes agora. Espere pelo menos 24h.",
        ],
        hotlines=[
            {"name": "CVV — Centro de Valorização da Vida", "number": "188", "hours": "24 horas", "type": "telefone/chat"},
            {"name": "SAMU", "number": "192", "hours": "24 horas", "type": "emergência médica"},
            {"name": "CVV Chat", "number": "www.cvv.org.br", "hours": "24 horas", "type": "chat online"},
            {"name": "Ligue 180 (violência contra mulher)", "number": "180", "hours": "24 horas", "type": "denúncia/apoio"},
        ],
        safety_plan_steps=[
            "1. Sinais de alerta: o que sinto antes de uma crise?",
            "2. Estratégias internas: o que posso fazer sozinho? (respiração, aterramento)",
            "3. Pessoas que posso contactar para distração",
            "4. Profissionais/linhas de apoio para emergência",
            "5. Como posso tornar meu ambiente mais seguro?",
            "6. O que me motiva a continuar? (razões para viver)",
        ],
        grounding_quick="Pressione os pés no chão, nomeie 5 coisas que vê, 4 que toca, 3 que ouve. Você está aqui, agora.",
    )


def _build_energy_boost(emotion: str) -> EnergyBoost:
    activities = {
        "sad": [
            {"name": "Caminhada de 10 minutos", "intensity": "leve", "benefit": "Libera endorfina e muda cenário mental"},
            {"name": "Dançar 1 música animada", "intensity": "moderada", "benefit": "Quebra padrão corporal de recolhimento"},
            {"name": "Alongamento de 5 minutos", "intensity": "leve", "benefit": "Alivia tensão e melhora postura"},
        ],
        "anxious": [
            {"name": "Corrida leve de 5 minutos", "intensity": "moderada", "benefit": "Metaboliza adrenalina e cortisol"},
            {"name": "Yoga gentil (10 min)", "intensity": "leve", "benefit": "Ativa sistema nervoso parassimpático"},
            {"name": "Marchar no lugar por 2 minutos", "intensity": "leve", "benefit": "Bilateral stimulation grounding"},
        ],
        "angry": [
            {"name": "30 flexões ou agachamentos", "intensity": "alta", "benefit": "Descarga física da adrenalina"},
            {"name": "Saco de boxe ou travesseiro (1 min)", "intensity": "alta", "benefit": "Liberação controlada de energia"},
            {"name": "Caminhada rápida (15 min)", "intensity": "moderada", "benefit": "Reduz hormônios de estresse"},
        ],
    }

    default_activities = [
        {"name": "Caminhada de 10 minutos", "intensity": "leve", "benefit": "Aumento geral de energia e humor"},
        {"name": "Subir escadas por 3 minutos", "intensity": "moderada", "benefit": "Eleva batimentos e acorda o corpo"},
        {"name": "Alongamento de 5 minutos", "intensity": "leve", "benefit": "Libera tensão acumulada"},
    ]

    return EnergyBoost(
        emotion=emotion,
        physical_activities=activities.get(emotion, default_activities),
        quick_wins=[
            "Abra uma janela e respire ar fresco por 1 minuto.",
            "Lave o rosto com água fria.",
            "Ouça uma música que te dê energia.",
            "Faça 10 polichinelos rápidos.",
        ],
        nutrition_tip="Um copo de água + uma fruta ou oleaginosa (castanha, nozes) é o boost de energia mais rápido.",
        hydration_reminder="Desidratação leve causa fadiga e irritabilidade. Beba pelo menos 250ml agora.",
    )


def _build_focus_mode(emotion: str) -> FocusMode:
    techniques = {
        "anxious": FocusMode(
            emotion=emotion,
            technique="Pomodoro Suavizado",
            duration_minutes=20,
            steps=[
                "Escolha UMA tarefa para os próximos 20 minutos.",
                "Configure um timer de 20 minutos (mais curto para reduzir pressão).",
                "Cada vez que a mente vagar para preocupações, anote e volte.",
                "Ao final, faça 5 minutos de pausa com respiração.",
                "Repita se quiser, ou mude de tarefa.",
            ],
            distraction_blockers=["Silencie notificações por 20 min", "Coloque o celular voltado para baixo", "Feche abas do browser que não precisa"],
            reward_after="Após completar, faça algo prazeroso por 5 minutos como recompensa.",
        ),
        "sad": FocusMode(
            emotion=emotion,
            technique="Foco Gentil",
            duration_minutes=15,
            steps=[
                "Escolha a tarefa MAIS SIMPLES da sua lista.",
                "Configure 15 minutos — sem pressão de terminar.",
                "Faça o que conseguir, sem julgamento.",
                "Cada progresso, por menor, já conta.",
                "Ao final, registre: o que você conseguiu fazer?",
            ],
            distraction_blockers=["Evite redes sociais nos próximos 15 min", "Coloque uma música instrumental suave"],
            reward_after="Você fez algo mesmo num dia difícil. Isso é força.",
        ),
    }

    default = FocusMode(
        emotion=emotion,
        technique="Pomodoro Clássico",
        duration_minutes=25,
        steps=[
            "Escolha UMA tarefa prioritária.",
            "Configure 25 minutos sem interrupções.",
            "Trabalhe com atenção total nessa tarefa.",
            "Ao final, faça 5 minutos de pausa real (levantar, alongar).",
            "A cada 4 ciclos, faça uma pausa maior de 15 minutos.",
        ],
        distraction_blockers=["Silencie o celular", "Feche redes sociais", "Coloque fones com música instrumental"],
        reward_after="Recompense-se com algo agradável após 2 ciclos completos.",
    )

    return techniques.get(emotion, default)


def _build_emotion_playlist(emotion: str) -> EmotionPlaylist:
    playlists = {
        "happy": EmotionPlaylist(
            emotion=emotion,
            mood_label="Energético & Positivo",
            genres=["Pop", "Funk", "Indie Folk", "Dance"],
            curated_tracks=[
                {"title": "Happy", "artist": "Pharrell Williams", "mood": "celebration"},
                {"title": "Good as Hell", "artist": "Lizzo", "mood": "empowerment"},
                {"title": "Can't Stop the Feeling", "artist": "Justin Timberlake", "mood": "joy"},
                {"title": "Walking on Sunshine", "artist": "Katrina and the Waves", "mood": "energy"},
                {"title": "Lovely Day", "artist": "Bill Withers", "mood": "warmth"},
                {"title": "Don't Stop Me Now", "artist": "Queen", "mood": "euphoria"},
            ],
            ambient_sounds=["Pássaros cantando", "Rio correndo", "Crianças brincando ao longe"],
        ),
        "sad": EmotionPlaylist(
            emotion=emotion,
            mood_label="Suave & Acolhedor",
            genres=["Lo-fi", "Neo-Classical", "Ambient", "Acoustic"],
            curated_tracks=[
                {"title": "Weightless", "artist": "Marconi Union", "mood": "calm"},
                {"title": "Clair de Lune", "artist": "Debussy", "mood": "melancholy beauty"},
                {"title": "River Flows in You", "artist": "Yiruma", "mood": "gentle sadness"},
                {"title": "Skinny Love", "artist": "Bon Iver", "mood": "vulnerability"},
                {"title": "Fix You", "artist": "Coldplay", "mood": "hope in sadness"},
                {"title": "Gymnopédie No.1", "artist": "Satie", "mood": "reflective"},
            ],
            ambient_sounds=["Chuva suave", "Lareira crepitando", "Ondas do mar distantes"],
        ),
        "angry": EmotionPlaylist(
            emotion=emotion,
            mood_label="Descarga & Depois Calma",
            genres=["Rock", "Metal (catarse)", "Instrumental", "Ambient"],
            curated_tracks=[
                {"title": "Break Stuff", "artist": "Limp Bizkit", "mood": "catharsis"},
                {"title": "Killing in the Name", "artist": "RATM", "mood": "release"},
                {"title": "Breathe (2 AM)", "artist": "Anna Nalick", "mood": "post-anger calm"},
                {"title": "The Sound of Silence", "artist": "Disturbed", "mood": "powerful reflection"},
                {"title": "Nuvole Bianche", "artist": "Ludovico Einaudi", "mood": "cool down"},
                {"title": "Sunset Lover", "artist": "Petit Biscuit", "mood": "peaceful resolution"},
            ],
            ambient_sounds=["Vento forte virando brisa", "Tempestade distante", "Fogueira noturna"],
        ),
        "anxious": EmotionPlaylist(
            emotion=emotion,
            mood_label="Calmo & Aterrante",
            genres=["Ambient", "Neo-Classical", "Nature Sounds", "Drone"],
            curated_tracks=[
                {"title": "Gymnopédie No.1", "artist": "Satie", "mood": "slow down"},
                {"title": "Experience", "artist": "Ludovico Einaudi", "mood": "grounding"},
                {"title": "Weightless", "artist": "Marconi Union", "mood": "anxiety reduction"},
                {"title": "Watermark", "artist": "Enya", "mood": "floating calm"},
                {"title": "Comptine d'un autre été", "artist": "Yann Tiersen", "mood": "gentle focus"},
                {"title": "An Ending", "artist": "Brian Eno", "mood": "spacious calm"},
            ],
            ambient_sounds=["Chuva no telhado", "Floresta à noite", "White noise suave", "Ondas rítmicas"],
        ),
    }

    default = EmotionPlaylist(
        emotion=emotion,
        mood_label="Equilibrado & Focado",
        genres=["Lo-fi Hip Hop", "Ambient", "Classical", "Jazz"],
        curated_tracks=[
            {"title": "Lo-fi Hip Hop Beats", "artist": "Various", "mood": "focus"},
            {"title": "Clair de Lune", "artist": "Debussy", "mood": "classic calm"},
            {"title": "Blue in Green", "artist": "Miles Davis", "mood": "sophisticated neutral"},
            {"title": "Intro", "artist": "The xx", "mood": "minimal calm"},
        ],
        ambient_sounds=["Sons de café", "Chuva suave", "Biblioteca silenciosa"],
    )

    return playlists.get(emotion, default)


def _build_tools(emotion: str, confidence: float, face_detected: bool) -> ToolsResponse:
    confident = confidence >= 0.65

    if emotion == "happy":
        tools = [
            ToolItem(id="celebrate", title="Registrar conquista", subtitle="Guardar o que deu certo hoje", icon="star-check-outline", action="open_journal", accent=True),
            ToolItem(id="share", title="Compartilhar energia", subtitle="Mandar uma mensagem boa para alguém", icon="share-variant-outline", action="open_chat"),
            ToolItem(id="keep_flow", title="Manter o ritmo", subtitle="Um plano leve para as próximas 2h", icon="clock-fast", action="open_focus"),
            ToolItem(id="music", title="Trilha positiva", subtitle="Ouvir algo que combine com esse momento", icon="music-note-outline", action="open_music"),
            ToolItem(id="gratitude", title="Prática de gratidão", subtitle="3 coisas boas para registrar", icon="heart-outline", action="open_gratitude"),
            ToolItem(id="social", title="Conexão social", subtitle="Compartilhar alegria com alguém", icon="account-group-outline", action="open_social"),
            ToolItem(id="energy", title="Boost de energia", subtitle="Atividades para manter o embalo", icon="lightning-bolt-outline", action="open_energy"),
            ToolItem(id="hydrate", title="Pausa de água", subtitle="Hidratar e manter energia", icon="cup-water", action="hydrate"),
            ToolItem(id="stretch", title="Alongamento rápido", subtitle="2 minutos para soltar o corpo", icon="human-handsup", action="start_stretch"),
            ToolItem(id="affirmations", title="Afirmações positivas", subtitle="Frases para amplificar a alegria", icon="message-text-outline", action="open_affirmations"),
            ToolItem(id="emotion_wheel", title="Roda emocional", subtitle="Explore nuances da sua alegria", icon="chart-donut", action="open_emotion_wheel"),
        ]
        plan = ["Aproveite esse momento por 2 minutos", "Registre uma vitória pequena", "Envie uma mensagem boa para alguém", "Pratique gratidão"]
        support = "Você está com uma energia boa. Vale transformar isso em algo concreto."
        hint = "Use o modo foco leve para continuar sem perder o embalo."
    elif emotion in {"sad", "anxious", "fearful"}:
        tools = [
            ToolItem(id="breath", title="Respiração guiada", subtitle="Desacelerar o corpo em 1 minuto", icon="meditation", action="start_breathing", accent=True),
            ToolItem(id="ground", title="Aterramento 5-4-3-2-1", subtitle="Voltar para o presente agora", icon="earth", action="grounding"),
            ToolItem(id="meditation", title="Meditação guiada", subtitle="Sessão personalizada para seu estado", icon="spa-outline", action="open_meditation"),
            ToolItem(id="reframe", title="Reestruturação cognitiva", subtitle="Transformar pensamentos automáticos", icon="head-cog-outline", action="open_reframing"),
            ToolItem(id="journal", title="Diário emocional", subtitle="Escrever para processar emoções", icon="notebook-outline", action="open_journal_prompts"),
            ToolItem(id="muscle", title="Relaxamento muscular", subtitle="Progressivo — corpo inteiro", icon="human-handsdown", action="open_muscle_relax"),
            ToolItem(id="checkin", title="Check-in rápido", subtitle="Dizer em uma frase como você está", icon="clipboard-text-outline", action="open_chat"),
            ToolItem(id="support", title="Plano de apoio", subtitle="Ver contatos e próximos passos", icon="account-heart-outline", action="open_support"),
            ToolItem(id="safe_space", title="Criar espaço seguro", subtitle="Silenciar estímulos por 5 minutos", icon="weather-night", action="open_reset"),
            ToolItem(id="social", title="Conexão social", subtitle="Falar com alguém que se importa", icon="account-group-outline", action="open_social"),
            ToolItem(id="sleep", title="Higiene do sono", subtitle="Preparar uma noite melhor", icon="bed-outline", action="open_sleep"),
            ToolItem(id="self_compassion", title="Autocompaixão", subtitle="Uma frase para reduzir pressão", icon="heart-outline", action="self_compassion"),
            ToolItem(id="crisis", title="Recursos de crise", subtitle="Linhas de apoio e plano de segurança", icon="phone-alert-outline", action="open_crisis"),
            ToolItem(id="education", title="Entender a emoção", subtitle="O que é e como lidar", icon="school-outline", action="open_education"),
            ToolItem(id="body_scan", title="Body Scan", subtitle="Escaneie tensões e libere", icon="human-handsdown", action="open_body_scan"),
            ToolItem(id="visualization", title="Visualização guiada", subtitle="Cenário seguro para relaxar", icon="image-filter-hdr", action="open_visualization"),
            ToolItem(id="affirmations", title="Afirmações positivas", subtitle="Frases para reconfortar", icon="message-text-outline", action="open_affirmations"),
            ToolItem(id="emotion_wheel", title="Roda emocional", subtitle="Entenda melhor o que sente", icon="chart-donut", action="open_emotion_wheel"),
        ]
        plan = ["Respire por 60 segundos", "Fale uma frase sobre o que pesa", "Escolha uma ação pequena e segura", "Busque conexão com alguém"]
        support = "Vou priorizar calma, clareza e passos pequenos com você."
        hint = "Se a sensação estiver alta, use o modo foco para reduzir estímulos."
    elif emotion == "angry":
        tools = [
            ToolItem(id="pause", title="Pausa curta", subtitle="Desarmar o impulso por 30 segundos", icon="pause-circle-outline", action="open_pause", accent=True),
            ToolItem(id="breath", title="Respiração de descarga", subtitle="Soltar a tensão com o corpo", icon="lungs", action="start_breathing"),
            ToolItem(id="meditation", title="Meditação de descarga", subtitle="Liberar tensão com guia", icon="spa-outline", action="open_meditation"),
            ToolItem(id="reframe", title="Reestruturação cognitiva", subtitle="Separar fato de interpretação", icon="head-cog-outline", action="open_reframing"),
            ToolItem(id="ground", title="Descarga corporal", subtitle="Exercício físico rápido", icon="earth", action="grounding"),
            ToolItem(id="note", title="Escrever sem filtro", subtitle="Descarregar em texto antes de agir", icon="pencil-outline", action="open_chat"),
            ToolItem(id="muscle", title="Relaxamento muscular", subtitle="Contrair e soltar todo o corpo", icon="human-handsdown", action="open_muscle_relax"),
            ToolItem(id="energy", title="Descarga física", subtitle="30 agachamentos ou caminhada", icon="run-fast", action="open_energy"),
            ToolItem(id="distance", title="Criar distância", subtitle="Reduzir gatilhos por alguns minutos", icon="step-backward", action="open_focus"),
            ToolItem(id="cold_water", title="Água fria no rosto", subtitle="Queda rápida de ativação", icon="snowflake", action="cooldown"),
            ToolItem(id="education", title="Entender a raiva", subtitle="O que ela está comunicando", icon="school-outline", action="open_education"),
            ToolItem(id="body_reset", title="Reset corporal", subtitle="20 agachamentos ou caminhada curta", icon="run-fast", action="start_stretch"),
            ToolItem(id="body_scan", title="Body Scan", subtitle="Localize e libere a tensão", icon="human-handsdown", action="open_body_scan"),
            ToolItem(id="affirmations", title="Afirmações", subtitle="Frases para recuperar controle", icon="message-text-outline", action="open_affirmations"),
            ToolItem(id="emotion_wheel", title="Roda emocional", subtitle="Entenda a raiz da raiva", icon="chart-donut", action="open_emotion_wheel"),
        ]
        plan = ["Não responda no impulso", "Afaste-se do gatilho por 2 minutos", "Faça descarga física", "Escreva o que você queria dizer"]
        support = "Seu corpo está pedindo descarga. Vamos baixar a intensidade antes de decidir qualquer coisa."
        hint = "Um tempo curto fora do gatilho costuma ajudar muito."
    else:
        tools = [
            ToolItem(id="focus", title="Modo foco", subtitle="Organizar o próximo passo", icon="target", action="open_focus", accent=True),
            ToolItem(id="journal", title="Diário emocional", subtitle="Capturar o que está na cabeça", icon="notebook-outline", action="open_journal_prompts"),
            ToolItem(id="breath", title="Respiração guiada", subtitle="Preparar o corpo para continuar", icon="meditation", action="start_breathing"),
            ToolItem(id="meditation", title="Meditação de presença", subtitle="5 minutos de mindfulness", icon="spa-outline", action="open_meditation"),
            ToolItem(id="gratitude", title="Prática de gratidão", subtitle="3 coisas boas para registrar", icon="heart-outline", action="open_gratitude"),
            ToolItem(id="summary", title="Resumo do humor", subtitle="Ver padrões da semana", icon="chart-bar", action="open_dashboard"),
            ToolItem(id="education", title="Educação emocional", subtitle="Entender o que sente", icon="school-outline", action="open_education"),
            ToolItem(id="music", title="Playlist do humor", subtitle="Trilha personalizada", icon="music-note-outline", action="open_music"),
            ToolItem(id="social", title="Conexão social", subtitle="Manter relacionamentos ativos", icon="account-group-outline", action="open_social"),
            ToolItem(id="reset", title="Reset de 3 minutos", subtitle="Pausa curta com guia", icon="timer-sand", action="open_reset"),
            ToolItem(id="hydrate", title="Pausa de água", subtitle="Recuperar foco rapidamente", icon="cup-water", action="hydrate"),
            ToolItem(id="body_scan", title="Body Scan", subtitle="Escaneie e relaxe o corpo", icon="human-handsdown", action="open_body_scan"),
            ToolItem(id="visualization", title="Visualização", subtitle="Viagem mental relaxante", icon="image-filter-hdr", action="open_visualization"),
            ToolItem(id="affirmations", title="Afirmações", subtitle="Reforço positivo diário", icon="message-text-outline", action="open_affirmations"),
            ToolItem(id="emotion_wheel", title="Roda emocional", subtitle="Mapeie o que sente", icon="chart-donut", action="open_emotion_wheel"),
        ]
        plan = ["Escolha uma prioridade pequena", "Registre o que precisa ser lembrado", "Pratique gratidão", "Dê um passo de cada vez"]
        support = "Você não precisa resolver tudo agora."
        hint = "Use o modo foco para transformar a próxima ação em algo simples."

    if not face_detected:
        tools.insert(0, ToolItem(id="camera", title="Ajustar rosto", subtitle="Reconectar a leitura emocional", icon="camera-retake-outline", action="open_home", accent=True))
        plan = ["Ajuste a câmera e o rosto no quadro", "Espere uma nova leitura", *plan]
        support = "Sem rosto detectado, eu deixei uma ação de reconexão no topo."

    if confident:
        plan.append("Se quiser, siga para o chat com uma frase curta")

    return ToolsResponse(
        emotion=emotion,
        confidence=confidence,
        support_message=support,
        suggested_tools=tools,
        micro_plan=plan[:4],
        focus_mode_hint=hint,
    )


@router.get("/recommendations", response_model=ToolsResponse, summary="Emotion aware tool recommendations")
async def get_tool_recommendations(
    emotion: str = Query("neutral"),
    confidence: float = Query(0.5, ge=0.0, le=1.0),
    face_detected: bool = Query(True),
):
    logger.info("tools recommendations | emotion=%s confidence=%.3f face_detected=%s",
        emotion,
        confidence,
        face_detected,
    )
    return _build_tools(emotion, confidence, face_detected)


@router.get("/daily-content", response_model=DailyContentResponse, summary="Daily affirmation and prompts by emotion")
async def get_daily_content(emotion: str = Query("neutral")):
    logger.info("tools daily-content | emotion=%s", emotion)
    return _build_daily_content(emotion)


@router.get("/breathing-protocol", response_model=BreathingProtocolResponse, summary="Breathing protocol by emotion")
async def get_breathing_protocol(
    emotion: str = Query("neutral"),
    confidence: float = Query(0.5, ge=0.0, le=1.0),
):
    logger.info("tools breathing-protocol | emotion=%s confidence=%.3f", emotion, confidence)
    return _build_breathing_protocol(emotion, confidence)


@router.get("/meditation", response_model=MeditationSession, summary="Guided meditation session by emotion")
async def get_meditation(
    emotion: str = Query("neutral"),
    duration: int = Query(5, ge=3, le=30),
):
    logger.info("tools meditation | emotion=%s duration=%d", emotion, duration)
    return _build_meditation(emotion, duration)


@router.get("/grounding", response_model=GroundingExercise, summary="Grounding exercise by emotion")
async def get_grounding(emotion: str = Query("neutral")):
    logger.info("tools grounding | emotion=%s", emotion)
    return _build_grounding(emotion)


@router.get("/journal-prompts", response_model=JournalPrompts, summary="Guided journal prompts by emotion")
async def get_journal_prompts(emotion: str = Query("neutral")):
    logger.info("tools journal-prompts | emotion=%s", emotion)
    return _build_journal_prompts(emotion)


@router.get("/cognitive-reframing", response_model=CognitiveReframing, summary="Cognitive reframing exercise")
async def get_cognitive_reframing(emotion: str = Query("neutral")):
    logger.info("tools cognitive-reframing | emotion=%s", emotion)
    return _build_cognitive_reframing(emotion)


@router.get("/muscle-relaxation", response_model=MuscleRelaxation, summary="Progressive muscle relaxation")
async def get_muscle_relaxation(emotion: str = Query("neutral")):
    logger.info("tools muscle-relaxation | emotion=%s", emotion)
    return _build_muscle_relaxation(emotion)


@router.get("/sleep-hygiene", response_model=SleepHygiene, summary="Sleep hygiene tips by emotion")
async def get_sleep_hygiene(emotion: str = Query("neutral")):
    logger.info("tools sleep-hygiene | emotion=%s", emotion)
    return _build_sleep_hygiene(emotion)


@router.get("/emotion-education", response_model=EmotionEducation, summary="Learn about an emotion")
async def get_emotion_education(emotion: str = Query("neutral")):
    logger.info("tools emotion-education | emotion=%s", emotion)
    return _build_emotion_education(emotion)


@router.get("/gratitude", response_model=GratitudePractice, summary="Gratitude practice by emotion")
async def get_gratitude(emotion: str = Query("neutral")):
    logger.info("tools gratitude | emotion=%s", emotion)
    return _build_gratitude(emotion)


@router.get("/social-connection", response_model=SocialConnection, summary="Social connection suggestions")
async def get_social_connection(emotion: str = Query("neutral")):
    logger.info("tools social-connection | emotion=%s", emotion)
    return _build_social_connection(emotion)


@router.get("/crisis-resources", response_model=CrisisResources, summary="Crisis intervention resources")
async def get_crisis_resources(
    emotion: str = Query("neutral"),
    confidence: float = Query(0.5, ge=0.0, le=1.0),
):
    logger.info("tools crisis-resources | emotion=%s confidence=%.3f", emotion, confidence)
    return _build_crisis_resources(emotion, confidence)


@router.get("/energy-boost", response_model=EnergyBoost, summary="Energy boost activities by emotion")
async def get_energy_boost(emotion: str = Query("neutral")):
    logger.info("tools energy-boost | emotion=%s", emotion)
    return _build_energy_boost(emotion)


@router.get("/focus-mode", response_model=FocusMode, summary="Focus mode technique by emotion")
async def get_focus_mode(emotion: str = Query("neutral")):
    logger.info("tools focus-mode | emotion=%s", emotion)
    return _build_focus_mode(emotion)


@router.get("/playlist", response_model=EmotionPlaylist, summary="Emotion-based music playlist")
async def get_emotion_playlist(emotion: str = Query("neutral")):
    logger.info("tools playlist | emotion=%s", emotion)
    return _build_emotion_playlist(emotion)


# ── New Builders ──────────────────────────────────────────────────────────

def _build_body_scan(emotion: str, duration: int) -> BodyScan:
    areas_catalog = {
        "happy": [
            {"area": "Topo da cabeça", "instruction": "Note a leveza. Respire fundo e sorria internamente."},
            {"area": "Ombros e pescoço", "instruction": "Relaxe a tensão residual. Gire suavemente o pescoço."},
            {"area": "Peito", "instruction": "Sinta a expansão. Inspire gratidão e expire leveza."},
            {"area": "Mãos", "instruction": "Abra e feche as mãos sentindo a energia de alegria."},
            {"area": "Pés", "instruction": "Sinta o contato com o chão. Ancorando essa felicidade."},
        ],
        "sad": [
            {"area": "Topo da cabeça", "instruction": "Imagine uma luz suave descendo. Sem julgamento."},
            {"area": "Olhos e testa", "instruction": "Relaxe a testa. Permita que as lágrimas venham se preciso."},
            {"area": "Garganta", "instruction": "Note qualquer aperto. Engula suavemente e solte."},
            {"area": "Peito", "instruction": "Coloque a mão no peito. Sinta seu coração batendo com força."},
            {"area": "Barriga", "instruction": "Respire profundamente na barriga. Solte devagar."},
            {"area": "Pernas", "instruction": "Sinta o peso das pernas. Você está seguro aqui."},
        ],
        "anxious": [
            {"area": "Cabeça", "instruction": "Imagine tensão saindo como fumaça ao expirar."},
            {"area": "Mandíbula", "instruction": "Abra ligeiramente. Solte a pressão nos dentes."},
            {"area": "Ombros", "instruction": "Levante até as orelhas, segure 3s, solte completamente."},
            {"area": "Mãos", "instruction": "Aperte os punhos 5s, depois abra lentamente. 3x."},
            {"area": "Barriga", "instruction": "Respiração diafragmática: 4s inspira, 7s expira."},
            {"area": "Pés", "instruction": "Pressione os dedos no chão. Grounding instantâneo."},
        ],
    }
    areas = areas_catalog.get(emotion, areas_catalog.get("anxious", []))
    return BodyScan(
        emotion=emotion,
        title=f"Body Scan — {emotion.capitalize()}",
        duration_minutes=duration,
        body_areas=areas[:duration],
        closing_message="Observe como seu corpo se sente agora comparado ao início. Cada sensação conta.",
    )


def _build_visualization(emotion: str) -> Visualization:
    catalog = {
        "happy": {
            "title": "Jardim da Alegria",
            "scenario": "Você está em um jardim florido ao amanhecer. O sol aquece seu rosto.",
            "guided_steps": [
                "Feche os olhos e imagine um portão de madeira antigo.",
                "Ao abrir, um jardim colorido se revela. Flores vibrantes por todos os lados.",
                "Caminhe pelo caminho de pedras. A grama é macia sob seus pés.",
                "Uma brisa suave traz o cheiro de lavanda e jasmim.",
                "Sente-se no banco ao centro. Sinta o calor do sol nos ombros.",
                "Sorria. Esse lugar é seu. Você pode voltar quando quiser.",
            ],
            "sensory_details": {"visão": "cores vivas, luz dourada", "som": "pássaros, vento leve", "tato": "brisa morna, grama macia", "cheiro": "lavanda, jasmim"},
            "closing_affirmation": "Eu mereço momentos de paz e beleza.",
        },
        "sad": {
            "title": "Lago Sereno",
            "scenario": "Você está à beira de um lago calmo ao entardecer. O céu é rosa e dourado.",
            "guided_steps": [
                "Imagine-se sentado à beira de um lago cristalino.",
                "O céu reflete tons de rosa e laranja na água parada.",
                "Coloque os pés na água morna. Sinta o alívio.",
                "Cada tristeza é uma pedra. Jogue-a suavemente no lago.",
                "Observe as ondas se expandirem e desaparecerem. Assim é a dor: ela passa.",
                "O lago absorve tudo sem julgamento. Você está leve.",
            ],
            "sensory_details": {"visão": "tons rosados, água espelhada", "som": "silêncio suave, grilos distantes", "tato": "água morna nos pés", "cheiro": "terra úmida, pinheiros"},
            "closing_affirmation": "Minha tristeza tem espaço aqui, e ela também vai passar.",
        },
        "anxious": {
            "title": "Cabana na Montanha",
            "scenario": "Você encontra uma cabana aconchegante no alto de uma montanha, longe de tudo.",
            "guided_steps": [
                "Imagine uma trilha de montanha. O ar é fresco e limpo.",
                "Você chega a uma cabana de madeira. A lareira crackle suavemente.",
                "Entre. Há um cobertor quente e uma xícara fumegante de chá.",
                "Sente-se. Olhe pela janela: montanhas infinitas, sem pressa.",
                "Cada respiração descarga mais um pouco de tensão.",
                "Aqui ninguém espera nada de você. Apenas esteja.",
            ],
            "sensory_details": {"visão": "montanhas, neve leve, lareira", "som": "crepitar do fogo, vento distante", "tato": "cobertor felpudo, xícara quente", "cheiro": "madeira queimada, chá de camomila"},
            "closing_affirmation": "Eu posso encontrar paz mesmo quando a mente está acelerada.",
        },
    }
    default = catalog["anxious"]
    data = catalog.get(emotion, default)
    return Visualization(
        emotion=emotion,
        duration_minutes=5,
        **data,
    )


def _build_affirmations(emotion: str) -> PositiveAffirmations:
    catalog = {
        "happy": [
            "Eu mereço essa alegria e posso espalhá-la ao meu redor.",
            "Cada momento feliz é um presente que eu acolho com gratidão.",
            "Minha alegria é contagiante e ilumina quem está perto.",
            "Eu celebro as pequenas vitórias com a mesma intensidade das grandes.",
            "Hoje é um bom dia, e eu reconheço isso conscientemente.",
        ],
        "sad": [
            "Eu tenho permissão para sentir tristeza sem ser definido por ela.",
            "Essa fase vai passar, e eu vou emergir mais forte.",
            "Minha vulnerabilidade é coragem, não fraqueza.",
            "Eu me abraço com a mesma gentileza que daria a um amigo querido.",
            "Cada lágrima é uma forma de liberar o que pesa no coração.",
        ],
        "anxious": [
            "Eu estou seguro neste momento, neste lugar, neste corpo.",
            "Meus pensamentos não são fatos, são apenas pensamentos.",
            "Eu escolho focar no que posso controlar e soltar o resto.",
            "Cada respiração me ancora um pouco mais no presente.",
            "A ansiedade é temporária, minha força interior é permanente.",
        ],
        "angry": [
            "Eu tenho direito de sentir raiva e posso expressá-la com respeito.",
            "Minha raiva me mostra onde meus limites foram cruzados.",
            "Eu escolho responder com clareza, não com impulso.",
            "Essa energia pode ser transformada em ação construtiva.",
            "Eu me permito pausar antes de reagir.",
        ],
        "fearful": [
            "O medo me protege, mas não precisa me paralisar.",
            "Eu já enfrentei medos antes e sobrevivi a todos eles.",
            "Cada passo pequeno contra o medo é um ato de bravura.",
            "Eu posso pedir ajuda e isso é um sinal de inteligência.",
            "O desconhecido também pode trazer coisas boas.",
        ],
        "neutral": [
            "Eu estou presente e isso já é suficiente.",
            "Minha calma é uma força silenciosa.",
            "Eu posso usar esse momento para construir algo significativo.",
            "A estabilidade é um solo fértil para novos começos.",
            "Eu sou capaz e estou pronto para o que vier.",
        ],
    }
    default_affirmations = catalog.get("neutral", [])
    affirmations = catalog.get(emotion, default_affirmations)
    return PositiveAffirmations(
        emotion=emotion,
        affirmations=affirmations,
        mirror_exercise="Olhe-se no espelho por 60 segundos enquanto repete cada afirmação em voz alta, olhando nos seus próprios olhos.",
        repeat_count=3,
        closing="Leve essas palavras com você hoje. Repita sempre que precisar de um lembrete gentil.",
    )


def _build_emotion_wheel(emotion: str) -> EmotionWheel:
    wheel = {
        "happy": {
            "primary_emotion": "Alegria",
            "secondary_emotions": ["Contentamento", "Entusiasmo", "Gratidão", "Orgulho"],
            "nuanced_feelings": ["Euforia", "Serenidade", "Satisfação", "Esperança", "Encantamento", "Amor"],
            "description": "A alegria é uma emoção expansiva que nos abre para conexão e criatividade.",
            "body_map": ["Calor no peito", "Leveza nos ombros", "Sorriso espontâneo", "Energia nas mãos"],
            "coping_match": ["Gratidão", "Compartilhar com alguém", "Registrar no diário"],
        },
        "sad": {
            "primary_emotion": "Tristeza",
            "secondary_emotions": ["Melancolia", "Solidão", "Desapontamento", "Saudade"],
            "nuanced_feelings": ["Luto", "Nostalgia", "Desesperança", "Abandono", "Vazio", "Arrependimento"],
            "description": "A tristeza sinaliza perda ou necessidade não atendida. É natural e necessária.",
            "body_map": ["Peso no peito", "Aperto na garganta", "Cansaço generalizado", "Olhos pesados"],
            "coping_match": ["Auto-compaixão", "Conversar com alguém", "Body scan", "Visualização"],
        },
        "anxious": {
            "primary_emotion": "Ansiedade",
            "secondary_emotions": ["Preocupação", "Nervosismo", "Inquietação", "Apreensão"],
            "nuanced_feelings": ["Pânico", "Tensão", "Hipervigilância", "Antecipação negativa", "Agitação", "Insegurança"],
            "description": "A ansiedade é um alarme para ameaças percebidas, nem sempre reais.",
            "body_map": ["Coração acelerado", "Tensão na mandíbula", "Mãos frias", "Estômago apertado"],
            "coping_match": ["Respiração", "Grounding 5-4-3-2-1", "Relaxamento muscular", "Afirmações"],
        },
        "angry": {
            "primary_emotion": "Raiva",
            "secondary_emotions": ["Irritação", "Frustração", "Indignação", "Ressentimento"],
            "nuanced_feelings": ["Fúria", "Impaciência", "Inveja", "Ciúme", "Desprezo", "Vingança"],
            "description": "A raiva protege nossos limites e valores. Expressa com consciência, é transformadora.",
            "body_map": ["Calor no rosto", "Tensão nos punhos", "Maxilar travado", "Energia impulsiva"],
            "coping_match": ["Reestruturação cognitiva", "Exercício físico", "Respiração 4-7-8", "Diário de raiva"],
        },
        "fearful": {
            "primary_emotion": "Medo",
            "secondary_emotions": ["Terror", "Susto", "Hesitação", "Vulnerabilidade"],
            "nuanced_feelings": ["Fobia", "Paranoia", "Aversão", "Impotência", "Desamparo", "Pânico"],
            "description": "O medo nos prepara para fugir ou lutar. Às vezes ativa sem perigo real.",
            "body_map": ["Palpitações", "Suor frio", "Pernas fracas", "Respiração curta"],
            "coping_match": ["Grounding", "Visualização segura", "Conversa de apoio", "Exposição gradual"],
        },
        "surprised": {
            "primary_emotion": "Surpresa",
            "secondary_emotions": ["Espanto", "Choque", "Admiração", "Confusão"],
            "nuanced_feelings": ["Deslumbramento", "Incredulidade", "Estranhamento", "Fascinação", "Perplexidade"],
            "description": "A surpresa é breve e nos prepara para reavaliar a situação rapidamente.",
            "body_map": ["Olhos arregalados", "Boca aberta", "Tensão súbita", "Pausa respiratória"],
            "coping_match": ["Respiração consciente", "Reestruturação", "Diário de aprendizado"],
        },
        "neutral": {
            "primary_emotion": "Neutralidade",
            "secondary_emotions": ["Calma", "Estabilidade", "Equilíbrio", "Indiferença"],
            "nuanced_feelings": ["Serenidade", "Tédio", "Contemplação intencional", "Descanso", "Aceitação"],
            "description": "O neutro é o solo fértil: espaço para reflexão, planejamento e escolha.",
            "body_map": ["Corpo relaxado", "Respiração regular", "Sem tensões notáveis"],
            "coping_match": ["Planejamento", "Gratidão preventiva", "Meditação", "Exercício leve"],
        },
    }
    default_data = wheel["neutral"]
    data = wheel.get(emotion, default_data)
    return EmotionWheel(emotion=emotion, **data)


# ── New Routes ────────────────────────────────────────────────────────────

@router.get("/body-scan", response_model=BodyScan, summary="Guided body scan by emotion")
async def get_body_scan(
    emotion: str = Query("neutral"),
    duration: int = Query(5, ge=3, le=15),
):
    logger.info("tools body-scan | emotion=%s duration=%d", emotion, duration)
    return _build_body_scan(emotion, duration)


@router.get("/visualization", response_model=Visualization, summary="Guided visualization by emotion")
async def get_visualization(emotion: str = Query("neutral")):
    logger.info("tools visualization | emotion=%s", emotion)
    return _build_visualization(emotion)


@router.get("/affirmations", response_model=PositiveAffirmations, summary="Positive affirmations by emotion")
async def get_affirmations(emotion: str = Query("neutral")):
    logger.info("tools affirmations | emotion=%s", emotion)
    return _build_affirmations(emotion)


@router.get("/emotion-wheel", response_model=EmotionWheel, summary="Emotion wheel exploration")
async def get_emotion_wheel(emotion: str = Query("neutral")):
    logger.info("tools emotion-wheel | emotion=%s", emotion)
    return _build_emotion_wheel(emotion)
