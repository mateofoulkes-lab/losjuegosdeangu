import { CARRERA_1 } from './carrera-1.js';
import { CARRERA_2 } from './carrera-2.js';
import { CARRERA_3 } from './carrera-3.js';
import { CARRERA_4 } from './carrera-4.js';
import { CARRERA_5 } from './carrera-5.js';
import { CARRERA_6 } from './carrera-6.js';
import { applyCarreraCorrections } from './carrera-corrections.js';

export const CARRERA_DE_MENTES = [
  ...CARRERA_1,
  ...CARRERA_2,
  ...CARRERA_3,
  ...CARRERA_4,
  ...CARRERA_5,
  ...CARRERA_6
].map(applyCarreraCorrections);

if (CARRERA_DE_MENTES.length !== 450) {
  console.warn(`[Angu] Se esperaban 450 preguntas de Carrera de Mentes y se cargaron ${CARRERA_DE_MENTES.length}.`);
}
