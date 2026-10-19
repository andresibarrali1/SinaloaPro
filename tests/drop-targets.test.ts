// Comportamiento de los dos arrastres nuevos: soltar un medio (con creación de pista si hace falta) y soltar una
// transición en el borde de un clip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compatibleTrack, describeMediaDrop, laneKindForMedia, planMediaDrop } from '../lib/editor/drop-targets';
import { describeTransitionDrop, junctionTolerance, planTransitionDrop, transitionFadeFor } from '../lib/editor/transition-drop';
import { newEvent, newProject, newTrack, ticks, type Event, type FPS } from '../lib/editor/project';

const fps: FPS = { num: 30, den: 1 };

/** Proyecto con las pistas que se pidan, en orden. */
function projectWith(kinds: ('video' | 'audio')[]) {
  const base = newProject();
  const tracks = kinds.map((kind) => newTrack(kind, kind === 'video' ? 'Video' : 'Audio'));
  return { ...base, tracks, events: [] as Event[] };
}

/* ------------------------------------------------------------------ soltar medios */

test('un audio se va a una pista de audio y la imagen a una de vídeo', () => {
  assert.equal(laneKindForMedia('audio'), 'audio');
  assert.equal(laneKindForMedia('video'), 'video');
  assert.equal(laneKindForMedia('image'), 'video');

  const project = projectWith(['video', 'audio']);
  const audio = planMediaDrop({ mediaKind: 'audio', tracks: project.tracks });
  const video = planMediaDrop({ mediaKind: 'video', tracks: project.tracks });
  assert.equal(audio.kind, 'track');
  assert.equal(video.kind, 'track');
  if (audio.kind !== 'track' || video.kind !== 'track') return;
  assert.equal(project.tracks.find((track) => track.id === audio.trackId)?.kind, 'audio');
  assert.equal(project.tracks.find((track) => track.id === video.trackId)?.kind, 'video');
});

test('sin pistas de su clase, se crea una: el proyecto sin audio acepta un audio', () => {
  const project = projectWith(['video', 'video']);
  const plan = planMediaDrop({ mediaKind: 'audio', tracks: project.tracks });
  assert.equal(plan.kind, 'track');
  if (plan.kind !== 'track') return;
  assert.equal(plan.createTrack, 'audio', 'hay que crear la pista de audio');
  assert.equal(plan.trackId, null);
  assert.match(describeMediaDrop(plan, project.tracks), /creará una pista de audio/);
});

test('un proyecto sin pistas crea la que corresponda al material', () => {
  const project = projectWith([]);
  const video = planMediaDrop({ mediaKind: 'video', tracks: project.tracks });
  const audio = planMediaDrop({ mediaKind: 'audio', tracks: project.tracks });
  assert.deepEqual(video, { kind: 'track', trackId: null, createTrack: 'video' });
  assert.deepEqual(audio, { kind: 'track', trackId: null, createTrack: 'audio' });
});

test('si se suelta sobre una pista de su clase, se usa esa', () => {
  const project = projectWith(['video', 'video', 'audio']);
  const segunda = project.tracks[1];
  const plan = planMediaDrop({ mediaKind: 'video', tracks: project.tracks, preferred: segunda.id });
  assert.equal(plan.kind, 'track');
  if (plan.kind !== 'track') return;
  assert.equal(plan.trackId, segunda.id);
  assert.match(describeMediaDrop(plan, project.tracks), /pista «Video»/);
});

test('si se suelta sobre una pista de otra clase, se usa la primera de la clase correcta', () => {
  const project = projectWith(['video', 'audio']);
  const pistaVideo = project.tracks[0];
  const plan = planMediaDrop({ mediaKind: 'audio', tracks: project.tracks, preferred: pistaVideo.id });
  assert.equal(plan.kind, 'track');
  if (plan.kind !== 'track') return;
  assert.equal(project.tracks.find((track) => track.id === plan.trackId)?.kind, 'audio');
  assert.equal(plan.createTrack, null, 'no hace falta crear nada');
});

test('los subtítulos no eligen pista: los reparte quien los inserta', () => {
  const project = projectWith(['video']);
  assert.deepEqual(planMediaDrop({ mediaKind: 'subtitle', tracks: project.tracks }), {
    kind: 'track',
    trackId: null,
    createTrack: null,
  });
});

test('compatibleTrack respeta el tipo y no devuelve pistas de otra clase', () => {
  const project = projectWith(['video', 'audio']);
  const pistaAudio = project.tracks[1];
  assert.equal(compatibleTrack(project.tracks, 'video', pistaAudio.id)?.kind, 'video');
  assert.equal(compatibleTrack(projectWith(['video']).tracks, 'audio'), null);
});

/* ------------------------------------------------------------------ soltar transiciones */

/** Clip de vídeo en una pista. */
function clip(name: string, startSeconds: number, durationSeconds: number): Event {
  return { ...newEvent('pista', 'video', ticks(startSeconds), ticks(durationSeconds)), name };
}

test('soltar en la mitad izquierda le pone la transición de entrada a ese clip', () => {
  const uno = clip('Uno', 0, 4);
  const plan = planTransitionDrop({ events: [uno], time: ticks(1), kind: 'dissolve-linear', fps });
  assert.equal(plan.kind, 'apply');
  if (plan.kind !== 'apply') return;
  assert.equal(plan.eventId, uno.id);
  assert.equal(plan.edge, 'in');
  assert.equal(plan.junction, false);
  assert.equal(plan.fade, transitionFadeFor(ticks(4)), 'dura un segundo como mucho');
});

test('soltar en la mitad derecha con otro clip pegado usa el corte: entrada del siguiente', () => {
  const uno = clip('Uno', 0, 4);
  const dos = clip('Dos', 4, 3);
  const plan = planTransitionDrop({ events: [uno, dos], time: ticks(3.5), kind: 'iris-circle', fps });
  assert.equal(plan.kind, 'apply');
  if (plan.kind !== 'apply') return;
  assert.equal(plan.eventId, dos.id, 'la transición del corte es la entrada del segundo');
  assert.equal(plan.edge, 'in');
  assert.equal(plan.junction, true);
  assert.equal(plan.fade, transitionFadeFor(ticks(3)));
});

test('soltar en la mitad derecha sin nada después la pone como salida del propio clip', () => {
  const uno = clip('Uno', 0, 4);
  const plan = planTransitionDrop({ events: [uno], time: ticks(3.5), kind: 'wipe-from-left', fps });
  assert.equal(plan.kind, 'apply');
  if (plan.kind !== 'apply') return;
  assert.equal(plan.eventId, uno.id);
  assert.equal(plan.edge, 'out');
  assert.equal(plan.junction, false);
});

test('un clip separado por un hueco no forma corte: la transición va como salida', () => {
  const uno = clip('Uno', 0, 4);
  const dos = clip('Dos', 6, 3);
  const plan = planTransitionDrop({ events: [uno, dos], time: ticks(3.5), kind: 'slide-from-left', fps });
  assert.equal(plan.kind, 'apply');
  if (plan.kind !== 'apply') return;
  assert.equal(plan.edge, 'out');
  assert.equal(plan.eventId, uno.id);
});

test('soltar fuera de cualquier clip no hace nada y lo explica', () => {
  const uno = clip('Uno', 0, 4);
  const plan = planTransitionDrop({ events: [uno], time: ticks(9), kind: 'dissolve-linear', fps });
  assert.equal(plan.kind, 'none');
  if (plan.kind !== 'none') return;
  assert.match(plan.reason, /sobre un clip/);
});

test('los eventos de audio no son destino de una transición', () => {
  const audio = newEvent('pista', 'audio', 0, ticks(4));
  const plan = planTransitionDrop({ events: [audio], time: ticks(1), kind: 'dissolve-linear', fps });
  assert.equal(plan.kind, 'none');
});

test('la tolerancia del corte son dos fotogramas', () => {
  assert.equal(junctionTolerance({ num: 30, den: 1 }), 47_040_000);
  assert.equal(junctionTolerance({ num: 30000, den: 1001 }), 47_087_040);
});

test('la transición nunca dura más de la mitad del clip ni más de un segundo', () => {
  assert.equal(transitionFadeFor(ticks(10)), 705_600_000, 'un segundo');
  assert.equal(transitionFadeFor(ticks(1)), ticks(0.5), 'la mitad de un clip de un segundo');
});

test('la frase de estado distingue corte, entrada y salida', () => {
  const segundos = (value: number) => value / 705_600_000;
  const corte = describeTransitionDrop(
    { kind: 'apply', eventId: 'b', edge: 'in', fade: ticks(0.5), junction: true },
    'Fundido lineal',
    'Dos',
    segundos,
  );
  assert.match(corte, /en el corte/);
  assert.match(corte, /Dos/);
  const salida = describeTransitionDrop(
    { kind: 'apply', eventId: 'a', edge: 'out', fade: ticks(0.5), junction: false },
    'Barrido desde la izquierda',
    'Uno',
    segundos,
  );
  assert.match(salida, /como salida/);
  assert.match(salida, /0\.50 s/);
});
// Pruebas de la regla nueva: soltar fuera de toda pista crea una pista nueva aunque ya haya de su clase.
// ---- soltar fuera de toda pista (regla o hueco de debajo) ----

const proyectoCon = (kinds: ("video" | "audio")[]) => ({
  ...newProject(),
  tracks: kinds.map((kind) => newTrack(kind, kind === "video" ? "Video" : "Audio")),
});

test("soltar fuera de toda pista crea una pista nueva aunque ya haya de su clase", () => {
  const proyecto = proyectoCon(["video", "audio"]);
  const video = planMediaDrop({ mediaKind: "video", tracks: proyecto.tracks, fueraDePista: true });
  const audio = planMediaDrop({ mediaKind: "audio", tracks: proyecto.tracks, fueraDePista: true });
  assert.deepEqual(video, { kind: "track", trackId: null, createTrack: "video" });
  assert.deepEqual(audio, { kind: "track", trackId: null, createTrack: "audio" });
});

test("soltar fuera de toda pista ignora la pista que se pase como preferida", () => {
  const proyecto = proyectoCon(["video", "video"]);
  const plan = planMediaDrop({ mediaKind: "video", tracks: proyecto.tracks, preferred: proyecto.tracks[1].id, fueraDePista: true });
  assert.equal(plan.kind, "track");
  if (plan.kind !== "track") return;
  assert.equal(plan.trackId, null, "no se reutiliza la que ya existe");
  assert.equal(plan.createTrack, "video");
});

test("sobre una pista no se crea nada: se usa la que hay", () => {
  const proyecto = proyectoCon(["video", "audio"]);
  const plan = planMediaDrop({ mediaKind: "audio", tracks: proyecto.tracks, preferred: proyecto.tracks[1].id });
  assert.equal(plan.kind, "track");
  if (plan.kind !== "track") return;
  assert.equal(plan.trackId, proyecto.tracks[1].id);
  assert.equal(plan.createTrack, null);
});

test("una imagen también pide pista de vídeo cuando se suelta fuera de las pistas", () => {
  const proyecto = proyectoCon(["video", "audio"]);
  const plan = planMediaDrop({ mediaKind: "image", tracks: proyecto.tracks, fueraDePista: true });
  assert.equal(plan.kind, "track");
  if (plan.kind !== "track") return;
  assert.equal(plan.createTrack, "video");
});
