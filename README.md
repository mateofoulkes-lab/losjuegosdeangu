# Los juegos de Angu 🐾

Party game web para jugar con una TV/PC como tablero central y celulares como controles personales.

## Estado actual — v0.1.0

- Host crea sala con código de 4 letras.
- Jugadores entran desde el celular sin cuenta.
- WebRTC P2P con Trystero 0.25.3.
- Reutiliza el `appId` comprobado de la prueba multiplayer de Soquetín: `soquetin-multiplayer-probe-2026`.
- La conexión se mantiene viva mientras la interfaz del teléfono cambia entre lobby, dado, pregunta, respuesta, buzzer, jurado, espera, etc. No se navega entre páginas.
- Token persistente por dispositivo para recuperar al mismo jugador si el navegador suspende/recrea el peer al volver del background.
- Host autoritativo: mantiene estado, turnos, posiciones, premios y desafíos.
- Tablero 3D con `TABLERO.glb`.
- Fichas con `pin.glb`.
- Decorado inicial con `CUCHA.glb`, `PLATO.glb`, `PELOTA.glb` y `JUGUETE.glb`.
- Dado 3D provisional animado.
- Movimiento por 30 posiciones equidistantes sobre un circuito ovalado.
- 6 categorías: Mente, Acción, Palabra, Creatividad, Engaño y Grupo.
- Primeras mecánicas: trivia normal, trivia todos-juegan con buzzer, desafíos sociales y disparador de Robador al caer sobre otro jugador.

## Regla de victoria

Cada categoría entrega una arandela. Gana el primero en conseguir las seis. Completar una vuelta y la lógica definitiva de Robador/selección de equipo todavía están pendientes de la siguiente iteración.

## Assets actuales

- `TABLERO.glb` — tablero
- `pin.glb` — ficha/clavija
- `prize.glb` — arandela/premio
- `CUCHA.glb` — cucha
- `PLATO.glb` — plato
- `PELOTA.glb` — pelota
- `JUGUETE.glb` — soga/juguete
- `FONDO.jpg` — textura/fondo
- `FOTO.jpg` — foto de Angu
