"""
Gera os assets de marca da MellowPet a partir da geometria em mellow_mark.py.

Uso:
    python brand/generate_assets.py

Saida (app/assets/):
    icon.png              1024  selo claro sobre #4A3550  — icone do app (iOS + fallback Android)
    adaptive-icon.png     1024  selo claro, fundo transparente — foreground do adaptive icon Android
    splash-icon.png       1024  selo claro, fundo transparente — splash sobre #4A3550
    favicon.png             64  versao web
    notification-icon.png   96  silhueta branca — barra de status do Android

Requer apenas Pillow (`pip install pillow`). Nao depende de Node nem de
rasterizador SVG externo, entao roda em qualquer maquina do time.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mellow_mark import (  # noqa: E402
    BELLY, BODY_PATH, CREAM, EYES, EYE_WIDTH, FLIPPERS, MOUTH, MOUTH_WIDTH,
    NOSE_PATH, PLUM, STYLE_DARK, STYLE_MONO, WHISKERS, MarkStyle,
    ellipse_points, flatten_path,
)

SS = 4  # fator de supersampling — desenha grande e reduz com LANCZOS

ASSETS = Path(__file__).resolve().parent.parent / "app" / "assets"

# Caixa de conteudo do selo em unidades do desenho. As nadadeiras descem ate
# y=100 e o topo da cabeca comeca em y=9; sobra uma folga pequena em cima.
CONTENT = (0.0, 5.0, 100.0, 100.0)  # x0, y0, x1, y1


def _rgba(hex_color: str, alpha: float = 1.0) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), round(alpha * 255))


def _stroke(draw: ImageDraw.ImageDraw, pts, width: float, color) -> None:
    """Traco com ponta e juncao arredondadas (SVG stroke-linecap="round").

    O `line(joint="curve")` do Pillow une retangulos e deixa a borda externa
    serrilhada nas curvas. Estampar um disco a cada ~1px ao longo do caminho
    produz exatamente a uniao que o SVG define, sem serrilhado.
    """
    if len(pts) < 2:
        return
    r = max(0.5, width / 2.0)

    def dot(x, y):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    dot(*pts[0])
    carry = 0.0
    spacing = 0.7  # px na escala supersampled
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        seg = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        if seg == 0:
            continue
        t = spacing - carry
        while t <= seg:
            dot(ax + (bx - ax) * t / seg, ay + (by - ay) * t / seg)
            t += spacing
        carry = (carry + seg) % spacing
    dot(*pts[-1])


def render_mark(size: int, style: MarkStyle, *, scale: float = 1.0) -> Image.Image:
    """Desenha o selo do Mellow num quadrado RGBA transparente de `size` px.

    `scale` e a fracao da caixa que o selo ocupa (1.0 = encosta nas bordas).
    """
    canvas = size * SS
    x0, y0, x1, y1 = CONTENT
    content_w, content_h = x1 - x0, y1 - y0
    unit = (canvas * scale) / max(content_w, content_h)
    off_x = (canvas - content_w * unit) / 2 - x0 * unit
    off_y = (canvas - content_h * unit) / 2 - y0 * unit

    def T(pts):
        return [(off_x + px * unit, off_y + py * unit) for px, py in pts]

    def layer():
        img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        return img, ImageDraw.Draw(img)

    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))

    # Corpo + nadadeiras
    img, d = layer()
    body = _rgba(style.body)
    for cx, cy, rx, ry, rot in FLIPPERS:
        d.polygon(T(ellipse_points(cx, cy, rx, ry, rot)), fill=body)
    d.polygon(T(flatten_path(BODY_PATH)), fill=body)
    out = Image.alpha_composite(out, img)

    # Barriga
    img, d = layer()
    d.polygon(T(ellipse_points(*BELLY)), fill=_rgba(style.belly, style.belly_alpha))
    out = Image.alpha_composite(out, img)

    # Bigodes
    img, d = layer()
    whisker_color = _rgba(style.whisker, style.whisker_alpha)
    for path in WHISKERS:
        _stroke(d, T(flatten_path(path)), style.whisker_width * unit, whisker_color)
    out = Image.alpha_composite(out, img)

    # Olhos, nariz e boca
    img, d = layer()
    ink = _rgba(style.ink)
    for path in EYES:
        _stroke(d, T(flatten_path(path)), EYE_WIDTH * unit, ink)
    d.polygon(T(flatten_path(NOSE_PATH)), fill=ink)
    for path in MOUTH:
        _stroke(d, T(flatten_path(path)), MOUTH_WIDTH * unit, ink)
    out = Image.alpha_composite(out, img)

    return out.resize((size, size), Image.LANCZOS)


def render_silhouette(size: int) -> Image.Image:
    """Silhueta branca com as feicoes vazadas — icone de notificacao do Android.

    O Android descarta as cores e usa so o canal alpha, entao o desenho precisa
    funcionar como recorte: corpo solido, olhos/nariz/boca transparentes.
    """
    canvas = size * SS
    x0, y0, x1, y1 = CONTENT
    unit = canvas * 0.94 / max(x1 - x0, y1 - y0)
    off_x = (canvas - (x1 - x0) * unit) / 2 - x0 * unit
    off_y = (canvas - (y1 - y0) * unit) / 2 - y0 * unit

    def T(pts):
        return [(off_x + px * unit, off_y + py * unit) for px, py in pts]

    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    white = (255, 255, 255, 255)
    for cx, cy, rx, ry, rot in FLIPPERS:
        d.polygon(T(ellipse_points(cx, cy, rx, ry, rot)), fill=white)
    d.polygon(T(flatten_path(BODY_PATH)), fill=white)

    # Vaza as feicoes (ImageDraw substitui o pixel, entao alpha 0 apaga).
    clear = (255, 255, 255, 0)
    for path in EYES:
        _stroke(d, T(flatten_path(path)), EYE_WIDTH * unit, clear)
    d.polygon(T(flatten_path(NOSE_PATH)), fill=clear)
    for path in MOUTH:
        _stroke(d, T(flatten_path(path)), MOUTH_WIDTH * unit, clear)

    return img.resize((size, size), Image.LANCZOS)


def on_plum(mark: Image.Image, size: int) -> Image.Image:
    """Compoe o selo sobre o roxo solido da marca."""
    bg = Image.new("RGBA", (size, size), _rgba(PLUM))
    return Image.alpha_composite(bg, mark)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    # Icone do app: selo claro sobre #4A3550 (variante "fundo escuro").
    # iOS e o fallback do Android mascaram o quadrado, entao o fundo e full-bleed.
    icon = on_plum(render_mark(1024, STYLE_DARK, scale=0.62), 1024)
    icon.save(ASSETS / "icon.png")

    # Adaptive icon do Android: so o foreground. O sistema pode recortar ate
    # 33% de cada borda, entao o selo fica menor, dentro da zona segura.
    render_mark(1024, STYLE_DARK, scale=0.46).save(ASSETS / "adaptive-icon.png")

    # Splash: selo sobre o fundo roxo definido no app.json.
    render_mark(1024, STYLE_DARK, scale=0.60).save(ASSETS / "splash-icon.png")

    # Web.
    on_plum(render_mark(64, STYLE_DARK, scale=0.66), 64).save(ASSETS / "favicon.png")

    # Notificacao Android: silhueta monocromatica.
    render_silhouette(96).save(ASSETS / "notification-icon.png")

    # Referencia da variante monocromatica (o componente in-app usa SVG, mas
    # este PNG serve para docs e para a loja).
    (ASSETS / "brand").mkdir(exist_ok=True)
    on_white = Image.new("RGBA", (512, 512), _rgba(CREAM))
    mono = Image.alpha_composite(on_white, render_mark(512, STYLE_MONO, scale=0.66))
    mono.save(ASSETS / "brand" / "mellow-mono.png")

    for path in sorted(ASSETS.rglob("*.png")):
        img = Image.open(path)
        print(f"  {path.relative_to(ASSETS.parent)}  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
