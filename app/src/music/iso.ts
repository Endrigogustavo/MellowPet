import type { Playlist, Track } from '../data/content';

/**
 * Princípio ISO da musicoterapia: para mudar o humor com música, comece por
 * uma música que COMBINA com o humor atual e vá trocando aos poucos até o
 * humor desejado. Pular direto para "música feliz" quando se está triste
 * costuma irritar, não ajudar.
 *
 * Cada playlist do app tem um lugar no plano valência × energia; a jornada
 * traça uma reta do ponto atual ao alvo e escolhe, para cada passo, a faixa
 * mais próxima ainda não usada.
 */
export type Mood = { valence: number; energy: number };

export const PLAYLIST_MOOD: Record<string, Mood> = {
  acolhimento: { valence: -0.5, energy: -0.3 },
  quebra: { valence: 0.2, energy: 0.35 },
  sono: { valence: 0.05, energy: -0.85 },
  descarga: { valence: -0.45, energy: 0.8 },
  embalo: { valence: 0.8, energy: 0.6 },
  foco: { valence: 0.25, energy: -0.2 },
};

export type IsoGoal = 'acalmar' | 'dormir' | 'focar' | 'animar';

export const GOALS: Record<IsoGoal, { label: string; mood: Mood }> = {
  acalmar: { label: 'Acalmar', mood: { valence: 0.35, energy: -0.5 } },
  dormir: { label: 'Dormir', mood: { valence: 0.05, energy: -0.9 } },
  focar: { label: 'Focar', mood: { valence: 0.25, energy: -0.15 } },
  animar: { label: 'Animar', mood: { valence: 0.8, energy: 0.55 } },
};

/** Onde cada emoção lida costuma cair no plano (quando não há o círculo de Russell). */
export const EMOTION_MOOD: Record<string, Mood> = {
  happy: { valence: 0.75, energy: 0.45 },
  surprised: { valence: 0.3, energy: 0.75 },
  neutral: { valence: 0, energy: -0.1 },
  sad: { valence: -0.6, energy: -0.45 },
  fearful: { valence: -0.55, energy: 0.6 },
  angry: { valence: -0.6, energy: 0.75 },
  disgusted: { valence: -0.5, energy: 0.2 },
};

export type JourneyStep = { track: Track; playlistId: string; target: Mood };

const dist = (a: Mood, b: Mood) => Math.hypot(a.valence - b.valence, a.energy - b.energy);

export function isoJourney(from: Mood, to: Mood, playlists: Playlist[], steps = 5): JourneyStep[] {
  const pool = playlists.flatMap((p) =>
    PLAYLIST_MOOD[p.id] ? p.tracks.map((track) => ({ track, playlistId: p.id, mood: PLAYLIST_MOOD[p.id] })) : []
  );
  const used = new Set<string>();
  const out: JourneyStep[] = [];
  for (let i = 0; i < steps; i++) {
    const k = steps === 1 ? 1 : i / (steps - 1);
    const target = {
      valence: from.valence + (to.valence - from.valence) * k,
      energy: from.energy + (to.energy - from.energy) * k,
    };
    const best = pool
      .filter((c) => !used.has(c.track.url))
      .sort((a, b) => dist(a.mood, target) - dist(b.mood, target))[0];
    if (!best) break;
    used.add(best.track.url);
    out.push({ track: best.track, playlistId: best.playlistId, target });
  }
  return out;
}
