"""
Database initialization and connection management."""
import databases
import sqlalchemy

from config import settings

DATABASE_URL = settings.database_url

database = databases.Database(DATABASE_URL)

metadata = sqlalchemy.MetaData()

# ── Tables ────────────────────────────────────────────────────────────────────

users = sqlalchemy.Table("users",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.String(36), primary_key=True),
    sqlalchemy.Column("email", sqlalchemy.String(255), nullable=False, unique=True, index=True),
    sqlalchemy.Column("password_hash", sqlalchemy.String(255), nullable=False),
    sqlalchemy.Column("display_name", sqlalchemy.String(120), nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String(16), nullable=False, default="user"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

emotion_events = sqlalchemy.Table("emotion_events",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("session_id", sqlalchemy.String(64), nullable=False, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(64), nullable=True, index=True),
    sqlalchemy.Column("emotion", sqlalchemy.String(32), nullable=False),
    sqlalchemy.Column("confidence", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("secondary_emotion", sqlalchemy.String(32), nullable=True),
    sqlalchemy.Column("all_scores", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("face_detected", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("source", sqlalchemy.String(16), default="mobile"),  # mobile | iot
    sqlalchemy.Column("timestamp", sqlalchemy.Float, nullable=False, index=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

alerts_log = sqlalchemy.Table("alerts_log",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("session_id", sqlalchemy.String(64), nullable=False),
    sqlalchemy.Column("user_id", sqlalchemy.String(64), nullable=True),
    sqlalchemy.Column("alert_type", sqlalchemy.String(32), nullable=False),
    sqlalchemy.Column("emotion", sqlalchemy.String(32), nullable=True),
    sqlalchemy.Column("message", sqlalchemy.Text, nullable=True),
    sqlalchemy.Column("sent_to", sqlalchemy.String(256), nullable=True),
    sqlalchemy.Column("resolved", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

user_settings = sqlalchemy.Table("user_settings",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(64), nullable=False, unique=True),
    sqlalchemy.Column("pet_type", sqlalchemy.String(32), default="seal"),
    sqlalchemy.Column("pet_name", sqlalchemy.String(64), default="Mellow"),
    sqlalchemy.Column("emergency_contacts", sqlalchemy.JSON, default=list),
    sqlalchemy.Column("music_enabled", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("alerts_enabled", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("no_face_alert_minutes", sqlalchemy.Integer, default=10),
    sqlalchemy.Column("preferred_music_mood", sqlalchemy.String(32), default="calm"),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

# Rosto em repouso aprendido por usuario. Serve para a deteccao ja comecar
# calibrada em vez de gastar os primeiros frames de cada sessao aprendendo de
# novo — ver services/emotion/calibration.py.
user_calibration = sqlalchemy.Table("user_calibration",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(64), nullable=False, unique=True, index=True),
    # JSON com os Action Units de repouso; o conjunto de campos evolui com o
    # modelo, entao um blob e mais pratico que uma coluna por AU.
    sqlalchemy.Column("baseline_json", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("sessions_observed", sqlalchemy.Integer, nullable=False, default=0),
    sqlalchemy.Column("updated_at_ts", sqlalchemy.Float, nullable=False, default=0.0),
)

# Intervalos agregados produzidos no aparelho. Diferente de `emotion_events`,
# esta tabela representa transicoes/heartbeats do pipeline V2 e guarda as
# versoes necessarias para reproduzir a decisao. Nenhum dado de imagem entra
# neste schema.
vision_intervals = sqlalchemy.Table("vision_intervals",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("event_id", sqlalchemy.String(64), nullable=False, unique=True, index=True),
    sqlalchemy.Column("session_id", sqlalchemy.String(64), nullable=False, index=True),
    sqlalchemy.Column("device_session_id", sqlalchemy.String(64), nullable=False, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(64), nullable=True, index=True),
    sqlalchemy.Column("kind", sqlalchemy.String(16), nullable=False),
    sqlalchemy.Column("started_at", sqlalchemy.Float, nullable=False, index=True),
    sqlalchemy.Column("ended_at", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("duration_ms", sqlalchemy.Integer, nullable=False),
    sqlalchemy.Column("observed_expression", sqlalchemy.String(32), nullable=False),
    sqlalchemy.Column("expression_distribution", sqlalchemy.JSON, nullable=False),
    sqlalchemy.Column("signal_confidence", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("quality_mean", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("accepted_coverage", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("quality_reasons", sqlalchemy.JSON, nullable=False),
    sqlalchemy.Column("tension_signal", sqlalchemy.Float, nullable=True),
    sqlalchemy.Column("model_version", sqlalchemy.String(128), nullable=False),
    sqlalchemy.Column("pipeline_version", sqlalchemy.String(128), nullable=False),
    sqlalchemy.Column("quality_config_version", sqlalchemy.String(128), nullable=False),
    sqlalchemy.Column("calibration_version", sqlalchemy.String(128), nullable=True),
    sqlalchemy.Column("source", sqlalchemy.String(16), nullable=False, default="mobile"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

journal_entries = sqlalchemy.Table("journal_entries",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("entry_id", sqlalchemy.String(64), nullable=False, unique=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.String(36), nullable=False, index=True),
    sqlalchemy.Column("text", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("tag", sqlalchemy.String(64), nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

# Convite de cuidador. Nasce "pending" com so o caregiver_user_id preenchido;
# vira "accepted" quando a pessoa cuidada resgata o invite_code, o que
# preenche cared_user_id. Sem isso o painel do cuidador nao tem de onde
# buscar os dados de quem ele acompanha.
caregiver_links = sqlalchemy.Table("caregiver_links",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("invite_code", sqlalchemy.String(16), nullable=False, unique=True, index=True),
    sqlalchemy.Column("caregiver_user_id", sqlalchemy.String(36), nullable=False, index=True),
    sqlalchemy.Column("cared_user_id", sqlalchemy.String(36), nullable=True, index=True),
    sqlalchemy.Column("cared_name", sqlalchemy.String(120), nullable=True),
    sqlalchemy.Column("relationship", sqlalchemy.String(64), nullable=True),
    sqlalchemy.Column("scopes", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("status", sqlalchemy.String(16), nullable=False, default="pending"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
    sqlalchemy.Column("accepted_at", sqlalchemy.DateTime, nullable=True),
)

vision_feedback = sqlalchemy.Table("vision_feedback",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("feedback_id", sqlalchemy.String(64), nullable=False, unique=True, index=True),
    sqlalchemy.Column("event_id", sqlalchemy.String(64), nullable=False, index=True),
    sqlalchemy.Column("agreement", sqlalchemy.String(16), nullable=False),
    # Autorrelato descreve a pessoa; correcao visual descreve a leitura. Eles
    # permanecem em colunas distintas para nao transformar ansiedade em classe.
    sqlalchemy.Column("self_reported_state", sqlalchemy.String(64), nullable=True),
    sqlalchemy.Column("corrected_observed_expression", sqlalchemy.String(32), nullable=True),
    sqlalchemy.Column("note", sqlalchemy.String(500), nullable=True),
    sqlalchemy.Column("created_at_ts", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("received_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

engine = sqlalchemy.create_engine(
    DATABASE_URL.replace("+aiosqlite", ""),
    connect_args={"check_same_thread": False},
)


async def init_db():
    metadata.create_all(engine)
    await database.connect()


async def close_db():
    await database.disconnect()
