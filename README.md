# Los juegos de Angu 🐾

Party game web para jugar con una TV/PC como tablero central y celulares como controles personales.

## Estado actual — v0.6.0

- Host crea sala con código de 4 letras y QR de acceso directo.
- 2 a 8 jugadores, sin cuenta.
- WebRTC con topología en estrella: cada celular se conecta directamente al host; TURN puede usarse como respaldo.
- Host autoritativo para turnos, posiciones, premios y minijuegos.
- Tablero 3D usando `TABLERO.glb` con su textura embebida.
- Mesa real debajo del tablero usando un plano 3D con `FONDO.jpg`.
- Cámara y decorado aplicados desde la configuración exportada por `scene-editor.html`.
- Decorado con `CUCHA.glb`, `PLATO.glb`, `PELOTA.glb` y `JUGUETE.glb`.
- Fichas low-poly individuales tipo Monopoly.
- Dos paneles laterales de jugadores, balanceados automáticamente: hasta 4 cards por lado / 8 jugadores total.
- Cada card muestra nombre, color, avatar, estado contextual y una rueda de seis categorías.
- La rueda enciende cada sección conforme el jugador gana premios.
- Estados visuales: turno activo, responde, lee pregunta, jurado, buzzer, primero en responder, robo y desconectado.
- Banco de 450 preguntas de Carrera de Mentes integrado en Mente, con dificultad de 1, 2 y 3 estrellas.
- `simulator.html` permite simular cuatro celulares para probar solo.
- `scene-editor.html` permite editar cámara y posiciones de escena y exportar configuración.

## Categorías

1. Mente
2. Acción
3. Palabra
4. Creatividad
5. Engaño
6. Grupo

## Regla de preguntas — Carrera de Mentes

Cada turno puede contener como máximo **tres tiradas de dado**.

- Al caer en una casilla de Mente, **el jugador elige en su celular, antes de ver la pregunta, si quiere una pregunta de ⭐, ⭐⭐ o ⭐⭐⭐**.
- Al tirar el dado, el jugador avanza y responde la pregunta correspondiente.
- Si responde **incorrectamente**, el turno termina inmediatamente.
- Si responde **correctamente**, conserva el turno y vuelve a tirar el dado, siempre que todavía no haya realizado tres tiradas en ese turno.
- Una pregunta correcta de **1 estrella** no entrega premio.
- Una pregunta correcta de **2 estrellas** no entrega premio.
- Sólo una pregunta correcta de **3 estrellas** entrega el premio de la categoría Mente.
- Después de completar la tercera tirada, el turno termina aunque la tercera respuesta haya sido correcta.
- Si al caer sobre otro jugador se habilita un robo, se resuelve primero el robo y luego, si todavía corresponde por cantidad de tiradas, el jugador continúa su mismo turno.

## Victoria

Gana quien consigue los seis premios/categorías.
