// Correcciones revisadas del banco Carrera de Mentes.
// Las observaciones editoriales fueron chequeadas y pasan a formar parte de la tarjeta.
const CORRECTIONS = new Map([
  ['111:1', {q:'¿A cuántos grados hierve aproximadamente el agua al nivel del mar?', answer:'A CIEN GRADOS (aproximadamente, a presión atmosférica normal)'}],
  ['114:3', {q:'Según el relato bíblico del Génesis, ¿las aves aparecieron antes que el hombre?', answer:'SÍ'}],
  ['125:2', {q:'¿Alrededor de qué temperatura puede empezar a enturbiarse o solidificarse el aceite de oliva?', opts:['CERCA DE CERO GRADOS','A diez grados bajo cero','A cien grados bajo cero'], a:0}],
  ['144:2', {q:'¿En qué país funcionó la primera central nuclear conectada a una red eléctrica?', opts:['En Estados Unidos','EN LA UNIÓN SOVIÉTICA','En Japón'], a:1}],
  ['165:2', {kind:'free', q:'¿Qué sustancia desencadena la celiaquía en las personas predispuestas?', answer:'EL GLUTEN (presente principalmente en trigo, cebada y centeno)'}],
  ['265:3', {kind:'free', q:'¿Qué compuesto explosivo es un componente principal de la gelignita o gelatina explosiva?', answer:'NITROGLICERINA'}],
  ['311:1', {q:'¿Cuántas veces al día coinciden la aguja de las horas y el minutero de un reloj?', answer:'VEINTIDÓS VECES'}],
  ['324:2', {q:'Normalmente, ¿en cuántos cuartos está dividida la ubre de una vaca?', opts:['Uno','Seis','CUATRO'], a:2}],
  ['414:2', {q:'¿Qué solía combatirse tomando piramidón?', opts:['La sarna','LA FIEBRE','La hepatitis'], a:1}],
  ['435:3', {q:'En barro o arena y a baja velocidad, ¿qué ajuste de los neumáticos puede aumentar la superficie de contacto?', answer:'BAJAR MODERADAMENTE LA PRESIÓN DE LOS NEUMÁTICOS'}],
  ['441:2', {q:'Muchas camelias tienen poco o ningún perfume, aunque existen variedades fragantes. En general, ¿qué olor presentan?', opts:['A rosas','A jazmines','POCO O NINGÚN PERFUME'], a:2}],
  ['442:3', {q:'¿A partir de qué materia prima vegetal se fabrica industrialmente el papel común?', answer:'MADERA, NORMALMENTE PROCESADA COMO TRONCOS, ASTILLAS O FIBRAS'}],
  ['463:3', {q:'¿Pueden los perros comer pequeñas cantidades de naranja?', answer:'SÍ, ALGUNOS PUEDEN (aunque no es necesaria para su dieta y no todos la toleran igual)'}],
  ['511:1', {q:'El mosquito macho, ¿se alimenta de sangre o de néctar y otros azúcares vegetales?', answer:'DE NÉCTAR Y OTROS AZÚCARES VEGETALES'}],
  ['516:2', {q:'Usando unidades decimales, ¿cuántos kilobytes hay en un megabyte?', answer:'MIL'}]
]);

export function applyCarreraCorrections(card){
  const clean={...card};
  delete clean.note;
  const fix=CORRECTIONS.get(`${card.number}:${card.difficulty}`);
  return fix?{...clean,...fix}:clean;
}
