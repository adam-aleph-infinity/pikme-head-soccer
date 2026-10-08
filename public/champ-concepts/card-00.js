// "Card #0": no card — the tutorial's coach (Idan, 2026-10-08): a football commentator in everything
// Saltiz, the Saltiz cap, the red-and-gold shirt with the symbol on it, a commentator's headset.
// Drawn as a bust (head and shoulders), since he only talks (tutorial.js), never plays. The symbol
// is the game's own (symbol.js), not a copy.
import { begin, end, smooth, poly, circle, ellipse, fill, line, keyline, inside, rim, headShape, eyeE, browsE, mouthE, INK } from './kit.js';
import { symbolSVG } from '../symbol.js';

const part = (d, c, w = 6.4) => keyline(d, w) + fill(d, c);
// The Saltiz symbol, w wide, its top-left at (x, y).
const logo = (x, y, w) => symbolSVG().replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${w}" `);

function commentator() {
  begin();
  const RD = { base: '#e3062f', light: '#ff3b4a', shade: '#a8001f', deep: '#78001a' };
  const GD = { base: '#ffcc00', light: '#ffe766', shade: '#d89a00' };
  const S = { base: '#f4c49a', light: '#ffdcb8', shade: '#d8956e' };
  const BK = '#1c1c24';
  let s = '';
  let t = '';
  // the Saltiz shirt: red, gold trim along the shoulders, a gold V collar, the symbol on the chest
  const torso = smooth([[4, 152, 1], [6, 124], [18, 108], [42, 98], [62, 94], [92, 94], [112, 98], [132, 108], [140, 124], [142, 152, 1]]);
  t += part(torso, RD.base) + inside(torso, fill(smooth([[0, 100], [40, 104], [36, 142], [0, 142]]), RD.shade) + fill(smooth([[110, 104], [140, 120], [144, 142], [118, 142]]), RD.light, 'opacity=".7"') +
    line('M12 120Q28 104 52 99M102 99Q124 104 136 120', GD.base, 3.4) + line('M40 142V118M110 142V120', RD.deep, 1.4));
  t += rim(torso, poly([[0, 90], [70, 90], [30, 120], [0, 142]]), 2);
  const neck = smooth([[62, 70, 1], [90, 70, 1], [92, 98, 1], [62, 98, 1]], true, 0.3);
  t += part(neck, S.shade, 4.4);
  t += part(poly([[58, 94], [96, 94], [84, 114], [77, 120], [70, 114]]), GD.base, 3.4) + fill(poly([[64, 94], [90, 94], [77, 113]]), S.shade);
  t += logo(96, 106, 26);
  s += `<g transform="translate(0 -9)">${t}</g>`;   // the shoulders up under the chin
  // the head
  const head = headShape(0.66, 0.66, 2, -28);
  s += part(head, S.base);
  s += inside(head, fill(smooth([[30, 20], [52, 30], [50, 80], [30, 80]]), S.shade) + fill(smooth([[76, 32], [100, 32], [108, 46], [92, 42]]), S.light));
  // short dark hair under the cap at the back
  s += part(smooth([[42, 46], [40, 32], [52, 28], [58, 36], [52, 48]]), '#3a2a22', 3);
  s += rim(head, poly([[0, 0], [70, 0], [44, 30], [36, 70], [0, 80]]), 1.8);
  // the face: wide-eyed, mid-shout, the way a commentator calls a goal
  s += eyeE({ x0: 60, x1: 72, top: 38, bot: 47, slant: 0.25, nose: 1, px: 68, py: 43, pr: 3 });
  s += eyeE({ x0: 80, x1: 94, top: 37, bot: 46, slant: 0.25, nose: -1, px: 89, py: 42, pr: 3.2 });
  s += browsE([58, 33, 73, 34], [79, 33, 96, 29], 2.4);
  s += line('M99 46q4 3 0 6', S.shade, 1.6) + fill(ellipse(100, 56, 4, 2.4), '#ff8a8a', 'opacity=".45"');
  const mouth = smooth([[72, 56, 1], [86, 57], [98, 54, 1], [95, 63], [86, 67], [76, 63]]);
  s += mouthE(85, 59, 26, fill(mouth, '#3a0e10') + inside(mouth, fill(poly([[70, 53], [100, 52], [100, 58], [70, 59]]), '#fff') + fill(ellipse(86, 67, 7, 3.4), '#ff7a8a')) + line(mouth, INK, 1.6));
  // the Saltiz cap: red crown, gold brim and button, the symbol on the front
  const crown = smooth([[38, 34, 1], [40, 20], [52, 8], [74, 4], [96, 8], [108, 20], [110, 32, 1], [74, 30]]);
  s += part(crown, RD.base) + inside(crown, fill(smooth([[30, 0], [56, 6], [52, 40], [30, 40]]), RD.shade) + line('M74 5Q70 18 72 30M52 9Q48 22 50 33', RD.deep, 1.2) + line('M62 9Q84 4 100 12', RD.light, 1.8));
  s += part(circle(74, 4.5, 2.6), GD.base, 2);
  s += logo(79, 10, 17);
  const brim = smooth([[86, 30, 1], [116, 26], [130, 30], [132, 35, 1], [110, 38], [88, 36]]);
  s += part(brim, GD.base, 4.4) + inside(brim, fill(poly([[80, 34], [140, 30], [140, 40], [80, 40]]), GD.shade));
  s += rim(crown, poly([[0, 0], [70, 0], [40, 20], [30, 40], [0, 40]]), 1.6, '#fff2c0');
  // the commentator's headset: the band over the cap, the cup on the ear, the boom mic at the mouth
  s += line('M44 42C38 16 62 2 92 6', INK, 5.4) + line('M44 42C38 16 62 2 92 6', '#3a3a46', 2.6);
  s += part(ellipse(44, 48, 8, 10), BK, 3.4) + line(ellipse(44, 48, 5, 7), RD.base, 1.8);
  s += line('M47 57Q58 72 96 66', INK, 4.4) + line('M47 57Q58 72 96 66', '#3a3a46', 2);
  s += part(ellipse(100, 65, 5.4, 4.4, -0.2), RD.base, 3) + line('M97 63l5 4M98 61l5 4', RD.deep, 1);
  return end(s);
}

export default {
  card: 0, champion: 'הקריין', en: 'The Saltiz Commentator', theme: 'No card: the tutorial\'s coach, a football commentator in everything Saltiz',
  options: [
    { letter: 'A', name: 'Saltiz Commentator', draw: commentator, marks: { eyes: [[66, 42.5], [87, 41.5]], nose: [99, 49] },
      blurb: 'A football commentator in everything Saltiz: the red Saltiz cap with its gold brim and the symbol on the front, the red-and-gold shirt with the symbol on the chest, a commentator\'s headset and mic, calling the play with a big grin.' },
  ],
};
