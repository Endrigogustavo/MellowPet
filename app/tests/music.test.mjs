import assert from 'node:assert/strict';
import test from 'node:test';

import { EMOTION_MOOD, GOALS, PLAYLIST_MOOD, isoJourney } from '../src/music/iso.ts';

const t = (id, n) => ({ title: `${id}${n}`, artist: '', url: `u:${id}${n}`, duration: 100 });
const playlists = Object.keys(PLAYLIST_MOOD).map((id) => ({
  id,
  name: id,
  why: '',
  c: '',
  spotifyUri: '',
  tracks: [t(id, 1), t(id, 2), t(id, 3)],
}));

test('ISO: começa onde a pessoa está e termina no alvo', () => {
  const j = isoJourney(EMOTION_MOOD.sad, GOALS.animar.mood, playlists, 5);
  assert.equal(j.length, 5);
  assert.equal(j[0].playlistId, 'acolhimento');
  assert.equal(j[j.length - 1].playlistId, 'embalo');
  assert.equal(new Set(j.map((s) => s.track.url)).size, 5);
});

test('ISO: raiva para dormir passa pela descarga e termina no sono', () => {
  const j = isoJourney(EMOTION_MOOD.angry, GOALS.dormir.mood, playlists, 5);
  assert.equal(j[0].playlistId, 'descarga');
  assert.equal(j[4].playlistId, 'sono');
});
