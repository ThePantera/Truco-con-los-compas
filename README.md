# 🧉 Truco con los compas

Truco argentino en un bar de Boedo: paredón con grafitis del Diego y de Messi, milonga de fondo, la moza pasando el trapo y mate en la mano. Se juega en el navegador, contra bots o con los compas de la oficina por código de sala.

**Jugar:** https://thepantera.github.io/Truco-con-los-compas/

## Qué trae

- **Truco completo:** mazo español de 40 cartas, truco / retruco / vale cuatro, envido / real envido / falta envido (con "el envido está primero"), flor opcional (contraflor y contraflor al resto), pardas, irse al mazo, partidas a 15 o a 30 (malas y buenas).
- **Multijugador por sala:** 1 vs 1, 2 vs 2 y 3 vs 3. Uno crea la sala, pasa el link o el código de 4 letras y los demás entran. Los lugares vacíos los ocupan bots, y si alguien se cae, un bot juega por él hasta que vuelva.
- **El Guapo 🤖:** el bot rival. Canta, miente de vez en cuando y no hace trampa (solo ve sus cartas).
- **Bot Guía 🧉:** para el que no sabe jugar. Te dice cuánto envido tenés, qué carta conviene tirar, qué significa cada canto, y resalta la jugada sugerida. Tiene el reglamento con la escalera de cartas.
- **Chat de la mesa:** emojis que vuelan sobre tu asiento, frases porteñas armadas y texto libre.
- **Competitivo:** puntaje de barrio, rachas, títulos (de "Pibe de barrio" a "Leyenda de Caminito"), 12 logros, historial y tabla de la sala.
- **Ambiente:** milonga sintetizada (bandoneón, guitarra y bajo), gritos de "¡Truco!" con la voz del navegador, cartas que vuelan, la moza, mate con la tecla **G** y golpe en la mesa con la **H**.

## Cómo jugar con la oficina

1. Entrá a la página, poné tu nombre y tocá **Crear sala para la oficina**.
2. Copiá el link y mandalo por el chat del trabajo.
3. Cuando estén todos, elegí el modo (1v1, 2v2, 3v3), acomodá las parejas con ▲▼ y **¡Arrancar partida!**

El que crea la sala tiene que dejar su pestaña abierta: su navegador hace de mesa (reparte, valida las jugadas y le manda a cada uno solo sus cartas).

### Cómo funciona la conexión

No hay servidor propio: la sala usa [PeerJS](https://peerjs.com/) (WebRTC). El servidor público y gratuito de PeerJS solo presenta a los navegadores; después las jugadas van directo entre ellos. Algunas redes corporativas muy cerradas bloquean WebRTC; si pasa, prueben desde el celular con datos o desde otra red. También se puede usar un broker propio agregando `?peer=host:puerto` a la URL.

## Atajos

| Tecla | Acción |
| --- | --- |
| 1, 2, 3 | Tirar carta |
| T | Truco (o subir) |
| E | Envido |
| Q / N | Quiero / No quiero |
| G | Tomar un mate 🧉 |
| H | Golpear la mesa 👊 |

## Para desarrollar

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # tests del motor y de los bots
npm run build   # genera dist/
```

Cada push a `main` corre los tests y publica en GitHub Pages (`.github/workflows/deploy.yml`). En los pull requests corren los tests y el build (`ci.yml`).

## Estructura

```
├── index.html               # Pantallas: menú, sala, mesa
├── css/
│   ├── styles.css           # Variables, paredón del bar, neón, pantallas
│   └── components.css       # Cartas, botones de canto, fósforos, chat, guía
├── js/
│   ├── main.js              # Arranque: conecta la sesión con la UI
│   ├── engine/
│   │   ├── cards.js         # Mazo, jerarquía del truco, envido y flor
│   │   └── trucoEngine.js   # Reglas: turnos, vueltas, pardas, cantos y puntaje
│   ├── bots/
│   │   ├── rivalBot.js      # "El Guapo"
│   │   └── guideBot.js      # "Bot Guía" + reglamento
│   ├── game/session.js      # Anfitrión (corre el motor y los bots) e invitado
│   ├── network/multiplayer.js  # Salas por código con PeerJS
│   ├── graphics/
│   │   ├── scene.js         # Grafitis (Diego, Messi, sol de mayo), neón, lamparitas
│   │   ├── cardRenderer.js  # Cartas españolas en SVG
│   │   └── fpController.js  # Mate (G), golpe (H) y atajos
│   ├── character/mesonera.js   # La moza
│   ├── audio/soundManager.js   # Milonga y efectos con Web Audio
│   ├── stats/ranking.js     # Puntaje, rachas y logros
│   └── ui/                  # Mesa, sala, chat, paneles
└── tests/                   # Vitest
```

Proyecto experimental sin fines de lucro, hecho para jugar con amigos.
