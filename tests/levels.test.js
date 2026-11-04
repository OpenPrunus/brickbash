import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, autoplay, parseBricks, COLS, TPS } from '../web/js/engine.js';
import { LEVELS } from '../web/js/levels.js';

test('chaque niveau est bien formé : 12 colonnes, caractères connus, au moins une brique destructible, textes FR et EN', () => {
  assert.ok(LEVELS.length >= 10);
  let last = 0;
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.id, i + 1);
    assert.ok(lv.rows.length >= 1 && lv.rows.length <= 12, `niveau ${lv.id} : hauteur`);
    for (const row of lv.rows) assert.match(row, /^[123#x.]{12}$/, `niveau ${lv.id} : ${row}`);
    assert.ok(parseBricks(lv.rows).some((b) => b.kind !== 'steel'), `niveau ${lv.id} : rien à casser`);
    assert.ok(lv.speed > last, `niveau ${lv.id} : la vitesse augmente`);
    last = lv.speed;
    for (const f of ['name', 'hint']) assert.ok(lv[f].fr && lv[f].en, `niveau ${lv.id} : ${f}`);
  });
  assert.equal(COLS, 12);
});

test('chaque niveau se gagne : le joueur automatique le termine en moins de cinq minutes, sans perdre toutes ses vies', () => {
  for (const lv of LEVELS) {
    const g = autoplay(new Game(lv, { seed: lv.id, lives: 5 }), { maxSteps: TPS * 300 });
    assert.equal(g.status, 'won', `niveau ${lv.id} non terminé (reste ${g.remaining} briques, ${g.lives} vies, ${(g.tick / TPS) | 0} s)`);
  }
});
