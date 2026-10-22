/**
 * Sinais que só fazem sentido ao longo do tempo, não num quadro isolado.
 *
 * - Tensão: testa franzida e lábios pressionados por MINUTOS (um franzir de
 *   segundos é só pensar). Dispara "solta o rosto".
 * - Fadiga de tela: olhando para uma tela a gente pisca bem menos que o normal
 *   (~15–20/min). Taxa baixa sustentada sugere uma pausa — ligada à "Pausa
 *   de água".
 * - Olhar no Modo foco: o olhar saindo da tela várias vezes em pouco tempo
 *   faz o pet "cutucar".
 *
 * Cada lembrete tem intervalo mínimo próprio: um lembrete repetido vira
 * barulho e a pessoa desliga a câmera.
 */

export type FrameSignals = {
  atMs: number;
  /** Leitura válida neste quadro (rosto bem enquadrado). */
  ready: boolean;
  /** 0–1, de computeTensionSignal. */
  tension: number | null;
  /** Média de eyeBlinkLeft/Right, 0–1. */
  blink: number;
  /** Rotação da cabeça em graus. */
  yaw: number;
  /** Máximo de eyeLookOut*, 0–1. */
  lookOut: number;
};

export type NudgeKind = 'tension' | 'fatigue' | 'gaze';

export const TENSION_LEVEL = 0.45;
export const TENSION_WINDOW_MS = 3 * 60_000;
export const TENSION_SHARE = 0.7;
export const BLINK_WINDOW_MS = 5 * 60_000;
export const MIN_BLINK_COVERAGE_MS = 4 * 60_000;
export const LOW_BLINKS_PER_MIN = 7;
export const GAZE_WINDOW_MS = 2 * 60_000;
export const GAZE_AWAY_EPISODES = 4;
const GAZE_MIN_AWAY_MS = 1500;

export const COOLDOWN_MS: Record<NudgeKind, number> = {
  tension: 30 * 60_000,
  fatigue: 45 * 60_000,
  gaze: 5 * 60_000,
};

type Sample = { atMs: number; tense: boolean };

export class SignalTracker {
  private tension: Sample[] = [];
  private faceSince: number | null = null;
  private blinks: number[] = [];
  private eyesShut = false;
  private awayStart: number | null = null;
  private awayEpisodes: number[] = [];
  private last: Partial<Record<NudgeKind, number>> = {};

  /** Alimenta um quadro. Devolve o lembrete que deve aparecer agora, se houver. */
  push(f: FrameSignals, focusMode: boolean): NudgeKind | null {
    if (!f.ready) {
      // Sem rosto não há como medir piscada: a janela recomeça.
      this.faceSince = null;
      this.eyesShut = false;
      this.awayStart = null;
      return null;
    }
    const now = f.atMs;

    // tensão sustentada
    if (f.tension !== null) {
      this.tension.push({ atMs: now, tense: f.tension >= TENSION_LEVEL });
      this.tension = this.tension.filter((s) => now - s.atMs <= TENSION_WINDOW_MS);
    }

    // piscadas: borda de subida (aberto → fechado)
    if (this.faceSince === null) this.faceSince = now;
    if (!this.eyesShut && f.blink >= 0.55) {
      this.eyesShut = true;
      this.blinks.push(now);
    } else if (this.eyesShut && f.blink <= 0.3) {
      this.eyesShut = false;
    }
    this.blinks = this.blinks.filter((t) => now - t <= BLINK_WINDOW_MS);

    // olhar fora da tela (só conta episódio que dura)
    const away = Math.abs(f.yaw) > 25 || f.lookOut > 0.55;
    if (away && this.awayStart === null) this.awayStart = now;
    if (!away && this.awayStart !== null) {
      if (now - this.awayStart >= GAZE_MIN_AWAY_MS) this.awayEpisodes.push(now);
      this.awayStart = null;
    }
    this.awayEpisodes = this.awayEpisodes.filter((t) => now - t <= GAZE_WINDOW_MS);

    if (focusMode && this.awayEpisodes.length >= GAZE_AWAY_EPISODES && this.ready('gaze', now)) {
      this.awayEpisodes = [];
      return this.fire('gaze', now);
    }

    const span = this.tension.length > 1 ? now - this.tension[0].atMs : 0;
    const share = this.tension.length ? this.tension.filter((s) => s.tense).length / this.tension.length : 0;
    if (span >= TENSION_WINDOW_MS * 0.95 && share >= TENSION_SHARE && this.ready('tension', now)) {
      this.tension = [];
      return this.fire('tension', now);
    }

    const covered = now - this.faceSince;
    if (covered >= MIN_BLINK_COVERAGE_MS) {
      const minutes = Math.min(covered, BLINK_WINDOW_MS) / 60_000;
      if (this.blinks.length / minutes < LOW_BLINKS_PER_MIN && this.ready('fatigue', now)) {
        return this.fire('fatigue', now);
      }
    }
    return null;
  }

  blinkRate(nowMs: number): number | null {
    if (this.faceSince === null) return null;
    const covered = Math.min(nowMs - this.faceSince, BLINK_WINDOW_MS);
    if (covered < 60_000) return null;
    return this.blinks.length / (covered / 60_000);
  }

  private ready(kind: NudgeKind, now: number) {
    const last = this.last[kind];
    return last === undefined || now - last >= COOLDOWN_MS[kind];
  }

  private fire(kind: NudgeKind, now: number): NudgeKind {
    this.last[kind] = now;
    return kind;
  }
}

export const NUDGE_TEXT: Record<NudgeKind, { title: string; body: string }> = {
  tension: {
    title: 'Solta o rosto um pouquinho?',
    body: 'Faz uns minutos que sua testa e seus lábios estão tensos. Relaxa a mandíbula e respira fundo comigo.',
  },
  fatigue: {
    title: 'Hora de piscar e beber água',
    body: 'Você está piscando bem menos que o normal — sinal de tela demais. Que tal uma pausa de água longe dela?',
  },
  gaze: {
    title: 'Ei, volta pra cá',
    body: 'Seu olhar saiu da tela algumas vezes no modo foco. Tudo bem dar uma pausa — ou voltamos juntos?',
  },
};
