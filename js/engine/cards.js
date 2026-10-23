// Mazo español de 40 cartas (sin 8 ni 9) y jerarquías del truco.

export const SUITS = ['espada', 'basto', 'oro', 'copa'];
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export const SUIT_LABEL = { espada: 'Espada', basto: 'Basto', oro: 'Oro', copa: 'Copa' };
export const NUMBER_LABEL = { 10: 'Sota', 11: 'Caballo', 12: 'Rey' };

export function makeCard(num, suit) {
  return { num, suit, id: `${num}-${suit}` };
}

export function parseCard(id) {
  const [n, suit] = id.split('-');
  return makeCard(Number(n), suit);
}

export function newDeck() {
  const deck = [];
  for (const suit of SUITS) for (const num of NUMBERS) deck.push(makeCard(num, suit));
  return deck;
}

// Fisher-Yates. `rng` permite tests deterministas.
export function shuffle(deck, rng = Math.random) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Valor de truco: más alto, más fuerte. 14 = ancho de espada.
export function trucoRank(card) {
  const { num, suit } = card;
  if (num === 1 && suit === 'espada') return 14;
  if (num === 1 && suit === 'basto') return 13;
  if (num === 7 && suit === 'espada') return 12;
  if (num === 7 && suit === 'oro') return 11;
  switch (num) {
    case 3: return 10;
    case 2: return 9;
    case 1: return 8; // anchos falsos
    case 12: return 7;
    case 11: return 6;
    case 10: return 5;
    case 7: return 4; // sietes falsos
    case 6: return 3;
    case 5: return 2;
    case 4: return 1;
  }
  throw new Error(`Carta inválida: ${card.id}`);
}

export function envidoValue(card) {
  return card.num >= 10 ? 0 : card.num;
}

// Tantos de envido de una mano (2 o 3 cartas, o menos si ya jugó alguna:
// se pasan siempre las 3 cartas originales).
export function envidoPoints(cards) {
  let best = 0;
  for (const c of cards) best = Math.max(best, envidoValue(c));
  for (const suit of SUITS) {
    const same = cards.filter((c) => c.suit === suit).map(envidoValue).sort((a, b) => b - a);
    if (same.length >= 2) best = Math.max(best, 20 + same[0] + same[1]);
  }
  return best;
}

export function hasFlor(cards) {
  return cards.length === 3 && cards.every((c) => c.suit === cards[0].suit);
}

export function florPoints(cards) {
  return 20 + cards.reduce((s, c) => s + envidoValue(c), 0);
}

export function cardName(card) {
  const n = NUMBER_LABEL[card.num] ? `${card.num} (${NUMBER_LABEL[card.num]})` : String(card.num);
  return `${n} de ${SUIT_LABEL[card.suit]}`;
}

// Apodo porteño de las cartas bravas.
export function cardNickname(card) {
  if (card.id === '1-espada') return 'el macho (ancho de espada)';
  if (card.id === '1-basto') return 'la hembra (ancho de basto)';
  if (card.id === '7-espada') return 'el siete bravo de espada';
  if (card.id === '7-oro') return 'el siete bello de oro';
  return cardName(card);
}
