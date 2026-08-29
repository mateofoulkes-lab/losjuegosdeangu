import { CARRERA_DE_MENTES } from './carrera-de-mentes-bank.js';
import { TABU_CARDS } from './tabu-bank.js';
import { MIMIC_CARDS, PICTIONARY_CARDS } from './draw-mime-bank.js';

export const CHALLENGE_BANK={
  mente:[
    ...CARRERA_DE_MENTES,
    {kind:'trivia',q:'¿Cuál es el planeta más grande del sistema solar?',opts:['Marte','Júpiter','Saturno','Venus'],a:1},
    {kind:'trivia',q:'¿Cuántos lados tiene un dodecágono?',opts:['10','11','12','14'],a:2},
    {kind:'trivia',q:'¿Qué animal tiene tres corazones?',opts:['Pulpo','Tiburón','Delfín','Pingüino'],a:0},
    {kind:'trivia',q:'¿Qué elemento químico tiene símbolo Fe?',opts:['Flúor','Hierro','Fermio','Francio'],a:1},
    {kind:'trivia',q:'¿Cuál de estos números es primo?',opts:['39','41','51','57'],a:1},
    {kind:'free',title:'ESTIMACIÓN',q:'Sin buscar: ¿cuántos minutos tiene una semana?',hint:'El jurado acepta un margen de ±500.',answer:'10080'},
    {kind:'free',title:'ESTIMACIÓN',q:'¿Cuántos huesos tiene aproximadamente un adulto?',hint:'El jurado acepta 200–212.',answer:'206'},
    {kind:'free',title:'RÁPIDO',q:'Decí cinco países que empiecen con una letra distinta entre sí. Tenés 12 segundos.',answer:'Respuesta abierta'},
    {kind:'free',title:'MEMORIA',q:'Mirá a todos durante 5 segundos. Cerrá los ojos y nombrá el color de la ropa de dos personas.',answer:'El grupo valida'},
    {kind:'free',title:'LÓGICA',q:'Tenés dos monedas que suman 30. Una no es de 10. ¿Cuáles son?',answer:'Una de 20 y una de 10; “una” no es de 10.'}
  ],
  palabra:[
    ...TABU_CARDS.map(card=>({kind:'taboo',title:'PALABRA PROHIBIDA',source:'Recopilatorio Tabú',...card})),
    {kind:'free',title:'CADENA',q:'Decí una palabra que empiece con las últimas dos letras de “CAMA”. Después el grupo continúa tres palabras más.',answer:'Cadena válida sin repetir'},
    {kind:'free',title:'DEFINICIÓN HORRIBLE',q:'Definí “microondas” sin decir para qué sirve. Si el grupo adivina, ganás.',answer:'El grupo valida'},
    {kind:'free',title:'TRES EN CINCO',q:'Nombrá tres cosas que entren en un bolsillo en menos de 5 segundos.',answer:'Tres respuestas válidas'},
    {kind:'free',title:'RIMA',q:'Improvisá una frase que rime con “Angu manda en esta casa”.',answer:'El grupo decide'},
    {kind:'trivia',q:'¿Cuál de estas palabras está escrita correctamente?',opts:['Excepción','Exepción','Excepsión','Execepción'],a:0}
  ],
  // Los dos megabancos grandes nuevos.
  accion:MIMIC_CARDS,
  creatividad:PICTIONARY_CARDS,
  mentiras:[
    {kind:'social',title:'DOS VERDADES',q:'Decí dos cosas verdaderas y una mentira sobre vos. El grupo tiene que detectar la mentira.'},
    {kind:'social',title:'COARTADA',q:'Inventá una coartada de 20 segundos para explicar por qué había una cabra en tu cocina.'},
    {kind:'social',title:'FALSA BIOGRAFÍA',q:'Contá un supuesto dato increíble de tu infancia. El grupo decide si te cree.'},
    {kind:'social',title:'OBJETO MISTERIOSO',q:'Elegí un objeto a la vista y afirmá con total seriedad un uso falso para ese objeto.'},
    {kind:'social',title:'TITULAR FALSO',q:'Inventá una noticia falsa tan plausible que alguien podría compartirla sin leer.'},
    {kind:'social',title:'EXPERTO',q:'Hablá 20 segundos como experto en una disciplina que acabás de inventar.'},
    {kind:'social',title:'ANÉCDOTA',q:'Contá una anécdota de 20 segundos. Puede ser real o inventada. El grupo vota si te cree.'},
    {kind:'social',title:'DEFINICIÓN',q:'Inventá una definición convincente para la palabra “tarabiscote”.'},
    {kind:'social',title:'REGLA ABSURDA',q:'Afirmá una supuesta ley de otro país y defendela durante 15 segundos.'},
    {kind:'social',title:'IMPOSTOR',q:'Elegí una profesión al azar en tu cabeza y hablá como si llevaras 20 años ejerciéndola. Que la adivinen.'}
  ],
  grupo:[
    {kind:'social',title:'¿QUIÉN?',q:'¿Quién del grupo sobreviviría mejor una semana sin celular? Todos señalan al mismo tiempo.'},
    {kind:'social',title:'¿QUIÉN?',q:'¿Quién del grupo sería peor espía? Todos señalan al mismo tiempo.'},
    {kind:'social',title:'MAYORÍA',q:'Sin hablar: todos muestran con los dedos del 1 al 5 cuánto les gusta madrugar. Ganás si adivinás cuál será el número más repetido antes de que muestren.'},
    {kind:'social',title:'PREDICCIÓN',q:'Elegí a alguien. Antes de preguntarle, predecí si preferiría “playa” o “montaña”. Después responde.'},
    {kind:'social',title:'ORDEN',q:'Ordenen físicamente a tres jugadores de “más probable a adoptar diez gatos” a “menos probable”. El jugador activo propone el orden.'},
    {kind:'social',title:'CONSENSO',q:'Tienen 20 segundos para acordar cuál es la mejor comida para una noche de juegos.'},
    {kind:'social',title:'TE CONOZCO',q:'Elegí a alguien y adiviná qué elegiría: viajar gratis para siempre o comer gratis para siempre.'},
    {kind:'social',title:'SEÑALEN',q:'A la cuenta de tres, todos señalan a quien más probablemente tendría un escondite secreto en su casa.'},
    {kind:'social',title:'ESCALA HUMANA',q:'Todos se ubican mentalmente del 1 al 10 en “qué tan competitivos son”. El jugador activo debe adivinar quién se puso más alto.'},
    {kind:'social',title:'UNO CONTRA TODOS',q:'El jugador activo elige: dulce o salado. Si coincide con la mayoría del grupo, supera la prueba.'}
  ]
};

const usedTabuIndexes=new Set();
const usedPartyIndexes={accion:new Set(),creatividad:new Set()};

export function pickChallenge(category,lastKey='',difficulty=null){
  const pool=CHALLENGE_BANK[category]||CHALLENGE_BANK.mente;
  let candidates=pool.map((item,index)=>({item,index})).filter(x=>`${category}:${x.index}`!==lastKey);
  if(category==='mente'&&[1,2,3].includes(Number(difficulty))){
    candidates=candidates.filter(x=>x.item.source==='Carrera de Mentes'&&Number(x.item.difficulty)===Number(difficulty));
  }
  if(category==='palabra'){
    let freshTabu=candidates.filter(x=>x.item.kind==='taboo'&&!usedTabuIndexes.has(x.index));
    if(!freshTabu.length){usedTabuIndexes.clear();freshTabu=candidates.filter(x=>x.item.kind==='taboo')}
    const other=candidates.filter(x=>x.item.kind!=='taboo');
    candidates=[...freshTabu,...other];
  }
  if(category==='accion'||category==='creatividad'){
    const used=usedPartyIndexes[category];
    let fresh=candidates.filter(x=>!used.has(x.index));
    if(!fresh.length){used.clear();fresh=candidates}
    candidates=fresh;
  }
  const fallback=category==='mente'&&[1,2,3].includes(Number(difficulty))
    ? pool.map((item,index)=>({item,index})).find(x=>x.item.source==='Carrera de Mentes'&&Number(x.item.difficulty)===Number(difficulty))
    : {item:pool[0],index:0};
  const picked=candidates[Math.floor(Math.random()*candidates.length)]||fallback||{item:pool[0],index:0};
  if(category==='palabra'&&picked.item.kind==='taboo')usedTabuIndexes.add(picked.index);
  if(category==='accion'||category==='creatividad')usedPartyIndexes[category].add(picked.index);
  return {...picked.item,key:`${category}:${picked.index}`};
}
