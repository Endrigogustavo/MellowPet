"""
Geometria vetorial do Mellow (a foca da MellowPet).

Este modulo e a fonte da verdade para o desenho da marca. Os SVGs em brand/
e os PNGs em app/assets/ sao gerados a partir daqui, entao a marca nunca
diverge entre o design e o que e empacotado no app.

O selo e desenhado num quadrado de 100x100 unidades (o corpo ocupa de y=9 a
y=100, incluindo as nadadeiras). Todas as cores sao parametrizadas para que a
mesma geometria gere as tres variantes da identidade:

  - "dark"  : selo claro sobre #4A3550  -> icone do app (launcher)
  - "mono"  : selo #4A3550 sobre claro  -> icone dentro do app
  - "color" : selo com gradiente quente -> material de marca
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ── Paleta da marca ──────────────────────────────────────────────────────────
PLUM = "#4A3550"       # roxo escuro — fundo do icone e traco do monocromatico
CREAM = "#FAF6F2"      # off-white — selo sobre fundo escuro
PEACH = "#FFC9A8"
ROSE = "#F3AEB6"
LILAC = "#C6A9F0"
MUTED = "#9B8AA6"

VIEWBOX = 100.0  # o selo e desenhado em 100x100 unidades


@dataclass(frozen=True)
class MarkStyle:
    """Cores de uma variante da marca."""

    body: str          # preenchimento do corpo e das nadadeiras
    ink: str           # olhos, nariz, boca — o traco
    belly: str         # elipse da barriga
    belly_alpha: float
    whisker: str
    whisker_alpha: float
    whisker_width: float


# Selo claro sobre fundo escuro (icone do app).
STYLE_DARK = MarkStyle(
    body=CREAM, ink=PLUM, belly=PLUM, belly_alpha=0.10,
    whisker=PLUM, whisker_alpha=0.60, whisker_width=1.8,
)

# Selo escuro sobre fundo claro (icone dentro do app).
STYLE_MONO = MarkStyle(
    body=PLUM, ink=CREAM, belly=CREAM, belly_alpha=0.16,
    whisker=CREAM, whisker_alpha=0.85, whisker_width=1.8,
)


# ── Geometria ────────────────────────────────────────────────────────────────
# Nadadeiras: (cx, cy, rx, ry, rotacao em graus)
FLIPPERS = [
    (38.0, 93.0, 11.0, 7.0, -15.0),
    (62.0, 93.0, 11.0, 7.0, 15.0),
    (14.0, 76.0, 12.0, 7.0, -20.0),
    (86.0, 76.0, 12.0, 7.0, 20.0),
]

# Corpo — capsula arredondada, mais larga embaixo.
BODY_PATH = (
    "M 50 9 C 75 9 89 29 89 53 C 89 78 72 91 50 91 "
    "C 28 91 11 78 11 53 C 11 29 25 9 50 9 Z"
)

BELLY = (50.0, 68.0, 18.0, 12.5)  # cx, cy, rx, ry

# Olhos fechados e curvos — e isso que da o ar "mellow" (tranquilo).
EYES = ["M 30 51 q 7 -9 14 0", "M 56 51 q 7 -9 14 0"]
EYE_WIDTH = 4.2

NOSE_PATH = "M 44.5 58 Q 50 55.5 55.5 58 Q 55 64.5 50 67 Q 45 64.5 44.5 58 Z"

MOUTH = ["M 50 67 Q 50 72 44 72", "M 50 67 Q 50 72 56 72"]
MOUTH_WIDTH = 2.6

# Bigodes — 3 de cada lado, partindo do focinho.
WHISKERS = [
    "M 34 65 L 15 60", "M 34 68 L 13 68", "M 34 71 L 16 76",
    "M 66 65 L 85 60", "M 66 68 L 87 68", "M 66 71 L 84 76",
]


# ── Parser de path SVG (subconjunto: M, L, C, Q, Z) ──────────────────────────

def _tokenize(d: str) -> list[str]:
    out: list[str] = []
    num = ""
    for ch in d:
        if ch.isalpha():
            if num:
                out.append(num)
                num = ""
            out.append(ch)
        elif ch in " ,\n\t":
            if num:
                out.append(num)
                num = ""
        else:
            num += ch
    if num:
        out.append(num)
    return out


def _bezier3(p0, p1, p2, p3, steps: int):
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        )


def _bezier2(p0, p1, p2, steps: int):
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
        )


def flatten_path(d: str, steps: int = 48) -> list[tuple[float, float]]:
    """Converte um path SVG numa polilinha densa o bastante para rasterizar."""
    tokens = _tokenize(d)
    pts: list[tuple[float, float]] = []
    cur = (0.0, 0.0)
    i = 0
    cmd = ""
    while i < len(tokens):
        tok = tokens[i]
        if tok.isalpha():
            cmd = tok
            i += 1
            if cmd in ("Z", "z"):
                continue
        rel = cmd.islower()
        up = cmd.upper()

        def nums(n: int):
            nonlocal i
            vals = [float(tokens[i + k]) for k in range(n)]
            i += n
            return vals

        if up == "M":
            x, y = nums(2)
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            pts.append(cur)
            cmd = "l" if rel else "L"  # coordenadas seguintes viram lineto
        elif up == "L":
            x, y = nums(2)
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            pts.append(cur)
        elif up == "C":
            x1, y1, x2, y2, x, y = nums(6)
            if rel:
                c1 = (cur[0] + x1, cur[1] + y1)
                c2 = (cur[0] + x2, cur[1] + y2)
                end = (cur[0] + x, cur[1] + y)
            else:
                c1, c2, end = (x1, y1), (x2, y2), (x, y)
            pts.extend(_bezier3(cur, c1, c2, end, steps))
            cur = end
        elif up == "Q":
            x1, y1, x, y = nums(4)
            if rel:
                c1 = (cur[0] + x1, cur[1] + y1)
                end = (cur[0] + x, cur[1] + y)
            else:
                c1, end = (x1, y1), (x, y)
            pts.extend(_bezier2(cur, c1, end, steps))
            cur = end
        else:
            i += 1  # comando nao suportado — ignora com seguranca
    return pts


def ellipse_points(cx, cy, rx, ry, rotation_deg=0.0, steps: int = 96):
    """Elipse (opcionalmente rotacionada) como poligono."""
    rad = math.radians(rotation_deg)
    cos_r, sin_r = math.cos(rad), math.sin(rad)
    pts = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        x, y = rx * math.cos(a), ry * math.sin(a)
        pts.append((cx + x * cos_r - y * sin_r, cy + x * sin_r + y * cos_r))
    return pts
