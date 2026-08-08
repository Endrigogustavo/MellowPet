"""
Alert Service — Emergency notifications and no-face detection alerts
"""
import html
import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Track last face detection per session
_last_face_seen: dict[str, float] = {}
_alert_sent: dict[str, bool] = {}

NO_FACE_TIMEOUT = int(os.getenv("NO_FACE_ALERT_TIMEOUT_MINUTES", "10")) * 60


def update_face_seen(session_id: str, face_detected: bool):
    if face_detected:
        _last_face_seen[session_id] = time.time()
        _alert_sent[session_id] = False
    else:
        if session_id not in _last_face_seen:
            _last_face_seen[session_id] = time.time()


def check_no_face_alert(session_id: str) -> bool:
    """
    Return True if no-face alert should fire."""
    last = _last_face_seen.get(session_id, time.time())
    elapsed = time.time() - last
    already_sent = _alert_sent.get(session_id, False)
    if elapsed >= NO_FACE_TIMEOUT and not already_sent:
        _alert_sent[session_id] = True
        return True
    return False


def get_time_since_last_face(session_id: str) -> float:
    last = _last_face_seen.get(session_id, time.time())
    return round(time.time() - last, 1)


async def send_email_alert(
    to_email: str,
    subject: str,
    body: str,
) -> bool:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_pass:
        logger.warning("Email not configured — skipping alert")
        return False

    # Ultima barreira antes do SMTP: o destinatario precisa estar liberado.
    # A rota tambem checa, mas esta funcao e chamada em background e de mais
    # de um lugar, entao repetimos a verificacao aqui.
    if to_email.strip().lower() not in settings.allowed_alert_recipients:
        logger.error("Destinatario nao autorizado bloqueado: %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        # Um \r ou \n no assunto permitiria injetar headers (Bcc, Reply-To).
        msg["Subject"] = " ".join(subject.split())
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())

        logger.info(f"Alert email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


def build_emotion_alert_email(
    emotion: str,
    duration_minutes: float,
    user_name: str = "Usuário",
) -> tuple[str, str]:
    # user_name e emotion vem da request, entao precisam ser escapados antes
    # de entrar no corpo HTML do e-mail.
    safe_name = html.escape(user_name)
    safe_emotion = html.escape(emotion)
    subject = f"🚨 Alerta MellowPet — {user_name} pode precisar de apoio"
    body = f"""<html><body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #E74C3C;"> Alerta MellowPet</h2>
    <p>O MellowPet detectou que <strong>{safe_name}</strong> está com emoção
    <strong>{safe_emotion}</strong> por aproximadamente <strong>{duration_minutes:.0f} minutos</strong>.</p>
    <p>Por favor, verifique se está tudo bem.</p>
    <hr/>
    <small style="color: #999;">MellowPet — Sistema de Monitoramento Emocional</small>
    </body></html>
    """
    return subject, body


def build_no_face_alert_email(
    minutes: float,
    user_name: str = "Usuário",
) -> tuple[str, str]:
    safe_name = html.escape(user_name)
    subject = f" MellowPet — {user_name} sem atividade há {minutes:.0f} min"
    body = f"""<html><body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #F39C12;">📵 Sem Atividade Detectada</h2>
    <p>Nenhuma expressão facial de <strong>{safe_name}</strong> foi detectada
    nos últimos <strong>{minutes:.0f} minutos</strong>.</p>
    <p>Verifique se o usuário está bem.</p>
    <hr/>
    <small style="color: #999;">MellowPet — Sistema de Monitoramento Emocional</small>
    </body></html>
    """
    return subject, body
