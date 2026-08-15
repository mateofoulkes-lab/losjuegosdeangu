# Los juegos de Angu 🐾

Party game web para jugar con una TV/PC como tablero central y celulares como controles personales.

## Estado actual — v0.2.0

- Host crea sala con código de 4 letras.
- 2 a 8 jugadores, sin cuenta.
- WebRTC P2P con Trystero 0.25.3 y reconexión lógica persistente por dispositivo.
- Host autoritativo para turnos, posiciones, premios y minijuegos.
- Tablero 3D usando `TABLERO.glb` con su textura embebida.
- Mesa real debajo del tablero usando un plano 3D con `FONDO.jpg`.
- Cámara y decorado aplicados desde la configuración exportada por `scene-editor.html`.
- Decorado con `CUCHA.glb`, `PLATO.glb`, `PELOTA.glb` y `JUGUETE.glb`.
- Fichas provisionales con `pin.glb`; está previsto reemplazarlas por objetos low-poly individuales tipo Monopoly.
- Dos paneles laterales de jugadores, balanceados automáticamente: hasta 4 cards por lado / 8 jugadores total.
- Cada card muestra nombre, color, avatar provisional, estado contextual y una rueda de seis categorías.
- La rueda enciende cada sección conforme el jugador gana premios.
- Estados visuales: turno activo, responde, lee pregunta, jurado, buzzer, primero en responder, robo y desconectado.
- Primeras mecánicas: trivia normal, trivia todos-juegan con buzzer, desafíos sociales y Robador al caer sobre otro jugador.
- `simulator.html` permite simular cuatro celulares para probar solo.
- `scene-editor.html` permite editar cámara y posiciones de escena y exportar configuración.

## Categorías

1. Mente
2. Acción
3. Palabra
4. Creatividad
5. Engaño
6. Grupo

## Victoria

Gana quien consigue los seis premios/categorías. La regla de premio por vuelta completa y el Robador definitivo siguen pendientes.
