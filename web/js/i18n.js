// Brickbash — textes FR / EN.
export const DICT = {
  fr: {
    title: 'Brickbash',
    tagline: 'Le casse-brique : renvoyez la balle, détruisez tous les murs.',
    play: 'Jouer',
    levels: 'Niveaux',
    continue: 'Continuer',
    howTo: 'Comment jouer',
    help1: 'Déplacez la raquette (souris, doigt qui glisse, ou flèches du clavier) pour renvoyer la balle sans la laisser tomber. Détruisez toutes les briques pour passer au niveau suivant. L\'endroit de la raquette qui touche la balle décide de l\'angle du rebond.',
    help2: 'Les briques foncées demandent plusieurs coups, l\'acier est indestructible et les briques explosives détruisent leurs voisines. Les briques lâchent parfois des bonus : attrapez-les avec la raquette.',
    help3: 'Bonus : W raquette large, M multibille, S ralenti, C colle (la balle reste sur la raquette), L laser (touchez pour tirer), cœur = une vie. Touchez l\'écran (ou Espace) pour lancer la balle. P pause, R recommencer, Échap quitter.',
    allGames: 'Tous les jeux',
    github: 'GitHub',
    soundOn: 'Son : oui',
    soundOff: 'Son : non',
    langToggle: 'English',
    back: 'Retour',
    ok: 'OK',
    level: 'Niveau {n}',
    locked: 'Verrouillé',
    best: 'Meilleur : {n}',
    score: 'Score',
    lives: 'Vies',
    briefing: '{n} briques à détruire.',
    start: 'C\'est parti',
    pause: 'Pause',
    resume: 'Reprendre',
    paused: 'Pause',
    restart: 'Recommencer',
    menu: 'Menu',
    won: 'Niveau terminé !',
    lost: 'Perdu…',
    wonDetail: 'Score : {score}.',
    newBest: 'Nouveau record !',
    lostDetail: 'Il restait {n} briques. Score : {score}.',
    next: 'Niveau suivant',
    retry: 'Réessayer',
    finished: 'Tous les niveaux sont terminés, bravo !',
    tapLaunch: 'Touchez l\'écran (ou Espace) pour lancer la balle.',
    tapFire: 'Laser actif : touchez pour tirer.',
    fx_wide: 'Raquette large',
    fx_slow: 'Ralenti',
    fx_catch: 'Colle',
    fx_laser: 'Laser',
    offline: 'Hors ligne : le jeu fonctionne sans internet une fois chargé.',
  },
  en: {
    title: 'Brickbash',
    tagline: 'The classic breakout: bounce the ball, smash every wall.',
    play: 'Play',
    levels: 'Levels',
    continue: 'Continue',
    howTo: 'How to play',
    help1: 'Move the paddle (mouse, a sliding finger, or the arrow keys) to bounce the ball back without dropping it. Destroy every brick to move on to the next level. Where the ball meets the paddle decides the angle of the bounce.',
    help2: 'Dark bricks take several hits, steel is indestructible and explosive bricks blow up their neighbours. Bricks sometimes drop bonuses: catch them with the paddle.',
    help3: 'Bonuses: W wide paddle, M multiball, S slow motion, C glue (the ball sticks to the paddle), L laser (tap to shoot), heart = an extra life. Tap the screen (or press Space) to launch the ball. P pause, R restart, Esc leave.',
    allGames: 'All games',
    github: 'GitHub',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    langToggle: 'Français',
    back: 'Back',
    ok: 'OK',
    level: 'Level {n}',
    locked: 'Locked',
    best: 'Best: {n}',
    score: 'Score',
    lives: 'Lives',
    briefing: '{n} bricks to destroy.',
    start: 'Let\'s go',
    pause: 'Pause',
    resume: 'Resume',
    paused: 'Paused',
    restart: 'Restart',
    menu: 'Menu',
    won: 'Level cleared!',
    lost: 'Game over…',
    wonDetail: 'Score: {score}.',
    newBest: 'New record!',
    lostDetail: '{n} bricks were left. Score: {score}.',
    next: 'Next level',
    retry: 'Try again',
    finished: 'All levels cleared, well done!',
    tapLaunch: 'Tap the screen (or press Space) to launch the ball.',
    tapFire: 'Laser on: tap to shoot.',
    fx_wide: 'Wide paddle',
    fx_slow: 'Slow motion',
    fx_catch: 'Glue',
    fx_laser: 'Laser',
    offline: 'Offline: the game works without internet once loaded.',
  },
};

export const LANGS = Object.keys(DICT);
let lang = 'fr';

export function detectLang() {
  try {
    const saved = localStorage.getItem('brickbash.lang');
    if (saved && DICT[saved]) return saved;
  } catch { /* stockage indisponible */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'fr';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try { localStorage.setItem('brickbash.lang', l); } catch { /* ignoré */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export const getLang = () => lang;

export function t(key, vars = {}) {
  const s = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Texte d'un champ { fr, en } d'un niveau. */
export const pick = (obj) => obj?.[lang] ?? obj?.en ?? '';

export function apply(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  document.title = t('title');
}
