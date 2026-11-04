// Brickbash — les niveaux. Chaque ligne fait 12 caractères :
//   1 2 3 = brique à 1, 2 ou 3 coups   # = acier (indestructible)   x = brique explosive (détruit ses voisines)   . = vide
// Toute brique destructible est atteignable par en dessous : un test fait jouer un joueur automatique sur chaque niveau.
export const LEVELS = [
  { id: 1, speed: 3.0, name: { fr: 'Le mur', en: 'The wall' }, hint: { fr: 'Renvoyez la balle avec la raquette et détruisez toutes les briques.', en: 'Bounce the ball with the paddle and clear every brick.' },
    rows: ['111111111111', '111111111111', '222222222222', '222222222222'] },
  { id: 2, speed: 3.15, name: { fr: 'Damier', en: 'Checkerboard' }, hint: { fr: 'Visez avec le bord de la raquette : la balle part de côté.', en: 'Hit with the edge of the paddle to send the ball sideways.' },
    rows: ['1.1.1.1.1.1.', '.2.2.2.2.2.2', '1.1.1.1.1.1.', '.2.2.2.2.2.2', '1.1.1.1.1.1.'] },
  { id: 3, speed: 3.3, name: { fr: 'Pyramide', en: 'Pyramid' }, hint: { fr: 'Les briques plus foncées demandent plusieurs coups.', en: 'Darker bricks take several hits.' },
    rows: ['....1111....', '...122221...', '..12333321..', '.1233333321.', '123333333321'] },
  { id: 4, speed: 3.45, name: { fr: 'Colonnes d\'acier', en: 'Steel pillars' }, hint: { fr: 'L\'acier est indestructible : faites rebondir la balle autour.', en: 'Steel cannot be destroyed: bounce the ball around it.' },
    rows: ['2#22#22#22#2', '2.22.22.22.2', '3#33#33#33#3', '.1111111111.'] },
  { id: 5, speed: 3.6, name: { fr: 'Bombes', en: 'Bombs' }, hint: { fr: 'Une brique explosive détruit toutes ses voisines.', en: 'An explosive brick blows up all its neighbours.' },
    rows: ['111xx11xx111', '222222222222', '1x1x1x1x1x1x', '333333333333'] },
  { id: 6, speed: 3.75, name: { fr: 'Le cœur', en: 'The heart' }, hint: { fr: 'Attrapez les bonus qui tombent : raquette large, multibille, laser, colle…', en: 'Catch the falling bonuses: wide paddle, multiball, laser, glue…' },
    rows: ['.22......22.', '2222....2222', '222222222222', '.2222222222.', '..22222222..', '...222222...', '....2222....', '.....22.....'] },
  { id: 7, speed: 3.9, name: { fr: 'Forteresse', en: 'Fortress' }, hint: { fr: 'Ouvrez une brèche dans les remparts.', en: 'Break a gap in the ramparts.' },
    rows: ['#.#.#.#.#.#.', '.3333333333.', '.3x333333x3.', '.3333333333.', '1.1.1.1.1.1.'] },
  { id: 8, speed: 4.05, name: { fr: 'Sablier', en: 'Hourglass' }, hint: { fr: 'Passez par les côtés pour atteindre le haut.', en: 'Go around the sides to reach the top.' },
    rows: ['333333333333', '.2222222222.', '..11111111..', '....1111....', '.....11.....', '....1111....', '..11111111..', '.2222222222.', '333333333333'] },
  { id: 9, speed: 4.2, name: { fr: 'Slalom', en: 'Slalom' }, hint: { fr: 'Un couloir à droite, un couloir à gauche, et ainsi de suite.', en: 'A lane on the right, then one on the left, and so on.' },
    rows: ['2222222222#.', '............', '.#2222222222', '............', '2222222222#.', '............', '.#3333333333'] },
  { id: 10, speed: 4.35, name: { fr: 'Le final', en: 'Grand finale' }, hint: { fr: 'Tout ce que vous avez appris, d\'un coup.', en: 'Everything you learned, at once.' },
    rows: ['x#33333333#x', '2x2x2x2x2x2x', '333333333333', '#1#1#1#1#1#1'] },
];
