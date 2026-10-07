(function () {
  'use strict';
  var canvas = document.getElementById('skate-canvas');
  var scoreEl = document.getElementById('skate-score');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var PX = 4;
  var H = 220;
  var W = 800;
  var GROUND = 180;
  var WHITE = '#f2f2f2';
  var DIM = '#6e6e6e';
  var GHOST = '#2a2a2a';
  var RED = '#e03050';
  var STEEL = '#9a9a9a';

  var BODY_A = [
    '....1111....',
    '....1111....',
    '....1111....',
    '.....11.....',
    '...222222...',
    '..2.2222.2..',
    '..2.2222.2..',
    '....2222....',
    '....1111....',
    '...11..11...',
    '...1....1...',
    '..11....11..'
  ];
  var BODY_B = BODY_A.slice();
  BODY_B[10] = '....1..1....';
  BODY_B[11] = '...11..11...';
  var BODY_AIR = [
    '....1111....',
    '....1111....',
    '....1111....',
    '.....11.....',
    '.2.222222.2.',
    '..2.2222.2..',
    '....2222....',
    '....2222....',
    '...111111...',
    '..11....11..',
    '..1......1..',
    '............'
  ];
  var BODY_GRIND = [
    '............',
    '.....1111...',
    '.....1111...',
    '.....1111...',
    '2....11....2',
    '.222222222..',
    '....2222....',
    '....2222....',
    '...111111...',
    '..11....11..',
    '..1......1..',
    '..11....11..'
  ];
  var BOARD_FLIP = [
    ['333333333333', '.44......44.'],
    ['.3333333333.', '.5555555555.'],
    ['............', '555555555555'],
    ['.44......44.', '555555555555'],
    ['.5555555555.', '.3333333333.']
  ];
  var FLIP_ORDER = [0, 1, 2, 3, 4, 1, 0];
  var FLIP_STEP = 4;
  var FLIP_DROP = [0, 2, 4, 6, 4, 2, 0];
  var CAN = [
    '.11111111.',
    '1111111111',
    '..........',
    '.22222222.',
    '.2.2.2.2..',
    '.2.2.2.2..',
    '.2.2.2.2..',
    '.2.2.2.2..',
    '.2.2.2.2..',
    '.22222222.'
  ];
  var COLORS = { '1': WHITE, '2': WHITE, '3': RED, '4': DIM, '5': '#454545' };
  var CAN_COLORS = { '1': DIM, '2': DIM };

  function drawSprite(sprite, x, y, colors, scale) {
    scale = scale || PX;
    for (var r = 0; r < sprite.length; r++) {
      for (var c = 0; c < sprite[r].length; c++) {
        var ch = sprite[r][c];
        if (ch === '.') continue;
        ctx.fillStyle = colors[ch];
        ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale);
      }
    }
  }

  var SK_W = 12 * PX, SK_H = 14 * PX, BODY_H = 12 * PX;
  var CAN_W = 10 * PX, CAN_H = 10 * PX;
  var RAIL_H = 32;
  var RAIL_TOP = GROUND - RAIL_H;
  var PAD = 6;

  var state, player, obstacles, sparks, speed, score, best, frame, spawnIn, groundOffset, raf;

  try { best = parseInt(localStorage.getItem('skate-best') || '0', 10) || 0; } catch (e) { best = 0; }

  function reset() {
    player = { x: 70, y: GROUND - SK_H, vy: 0, onGround: true, airT: 0, rail: null };
    obstacles = [];
    sparks = [];
    speed = 5;
    score = 0;
    frame = 0;
    spawnIn = 60;
    groundOffset = 0;
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth;
    var cssH = canvas.clientHeight;
    W = Math.max(320, Math.round(cssW * (H / cssH)));
    canvas.width = Math.round(W * dpr * (cssH / H));
    canvas.height = Math.round(H * dpr * (cssH / H));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state !== 'running') draw();
  }

  function jump() {
    if (state === 'ready' || state === 'dead') {
      reset();
      state = 'running';
      loop();
      return;
    }
    if (player.onGround) {
      player.vy = -12.5;
      player.onGround = false;
      player.airT = 0;
      player.rail = null;
    }
  }

  function spawn() {
    if (score > 150 && Math.random() < 0.25) {
      var len = Math.round((240 + Math.random() * 160) * speed / 5);
      obstacles.push({ type: 'rail', x: W + 20, w: len });
      spawnIn = Math.round(len / speed) + 45 + Math.round(Math.random() * 30);
      return;
    }
    var stack = score > 400 && Math.random() < 0.3 ? 2 : 1;
    obstacles.push({ type: 'can', x: W + 20, w: CAN_W, stack: stack });
    var gap = 55 + Math.random() * 70 - Math.min(speed * 3, 30);
    spawnIn = Math.max(38, Math.round(gap));
  }

  function overlapsX(o) {
    return player.x + PAD < o.x + o.w && player.x + SK_W - PAD > o.x;
  }

  function update() {
    frame++;
    speed = Math.min(5 + score / 360, 18);
    score += (player.rail ? 2 : 1) * speed / 10;

    var prevBottom = player.y + SK_H;

    if (player.rail) {
      if (!overlapsX(player.rail)) {
        player.rail = null;
        player.onGround = false;
        player.airT = FLIP_ORDER.length * FLIP_STEP;
        player.vy = 0;
      } else {
        spawnSparks();
      }
    }

    if (!player.rail) {
      player.vy += 0.7;
      player.y += player.vy;
      if (!player.onGround) player.airT++;
      if (player.y >= GROUND - SK_H) {
        player.y = GROUND - SK_H;
        player.vy = 0;
        player.onGround = true;
      }
    }

    if (--spawnIn <= 0) spawn();
    for (var i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed;
      if (obstacles[i].x + obstacles[i].w < -10) obstacles.splice(i, 1);
    }

    for (var k = sparks.length - 1; k >= 0; k--) {
      var sp = sparks[k];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.35;
      if (--sp.life <= 0) sparks.splice(k, 1);
    }

    groundOffset = (groundOffset + speed) % 40;

    var bottom = player.y + SK_H;
    for (var j = 0; j < obstacles.length; j++) {
      var o = obstacles[j];
      if (!overlapsX(o)) continue;

      if (o.type === 'rail') {
        if (player.rail === o) continue;
        if (player.vy >= 0 && prevBottom <= RAIL_TOP + 8 && bottom >= RAIL_TOP) {
          player.rail = o;
          player.y = RAIL_TOP - SK_H + PX;
          player.vy = 0;
          player.onGround = true;
          player.airT = 0;
          continue;
        }
        if (bottom > RAIL_TOP + 8) { die(); return; }
      } else {
        var top = GROUND - CAN_H * o.stack;
        if (bottom - 4 > top + 4 && player.x + PAD < o.x + CAN_W - PAD && player.x + SK_W - PAD > o.x + PAD) {
          die();
          return;
        }
      }
    }
  }

  function spawnSparks() {
    for (var n = 0; n < 2; n++) {
      sparks.push({
        x: player.x + 10 + Math.random() * 12,
        y: RAIL_TOP,
        vx: -1.5 - Math.random() * 3,
        vy: -1 - Math.random() * 2.5,
        life: 10 + Math.floor(Math.random() * 8)
      });
    }
  }

  function die() {
    state = 'dead';
    player.rail = null;
    var s = Math.floor(score);
    if (s > best) {
      best = s;
      try { localStorage.setItem('skate-best', String(best)); } catch (e) { }
    }
  }

  function text(str, x, y, color, size, align) {
    ctx.fillStyle = color;
    ctx.font = (size || 12) + 'px "Space Mono", "Courier New", monospace';
    ctx.textAlign = align || 'center';
    ctx.fillText(str, x, y);
  }

  function drawRail(o) {
    ctx.fillStyle = DIM;
    ctx.fillRect(Math.round(o.x + 8), RAIL_TOP, PX, RAIL_H);
    ctx.fillRect(Math.round(o.x + o.w - 8 - PX), RAIL_TOP, PX, RAIL_H);
    ctx.fillRect(Math.round(o.x + 4), GROUND - PX, PX * 3, PX);
    ctx.fillRect(Math.round(o.x + o.w - 4 - PX * 3), GROUND - PX, PX * 3, PX);
    ctx.fillStyle = STEEL;
    ctx.fillRect(Math.round(o.x), RAIL_TOP, Math.round(o.w), PX);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = DIM;
    ctx.fillRect(0, GROUND, W, 1);
    ctx.fillStyle = GHOST;
    for (var gx = -groundOffset; gx < W; gx += 40) {
      ctx.fillRect(gx, GROUND + 10, 14, 2);
      ctx.fillRect(gx + 22, GROUND + 22, 6, 2);
    }

    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      if (o.type === 'rail') {
        drawRail(o);
      } else {
        for (var s = 0; s < o.stack; s++) {
          drawSprite(CAN, o.x, GROUND - CAN_H * (s + 1), CAN_COLORS);
        }
      }
    }

    var body, board, drop = 0;
    if (player.rail) {
      body = BODY_GRIND;
      board = BOARD_FLIP[0];
    } else if (!player.onGround) {
      body = BODY_AIR;
      var step = Math.min(FLIP_ORDER.length - 1, Math.floor(player.airT / FLIP_STEP));
      board = BOARD_FLIP[FLIP_ORDER[step]];
      drop = FLIP_DROP[step];
    } else {
      body = Math.floor(frame / 8) % 2 ? BODY_A : BODY_B;
      board = BOARD_FLIP[0];
    }
    drawSprite(body, player.x, player.y, COLORS);
    drawSprite(board, player.x, player.y + BODY_H + drop, COLORS);

    for (var k = 0; k < sparks.length; k++) {
      ctx.fillStyle = sparks[k].life > 6 ? WHITE : RED;
      ctx.fillRect(Math.round(sparks[k].x), Math.round(sparks[k].y), 3, 3);
    }

    if (player.rail && state === 'running') {
      text('STEEEEEEZYYYY', player.x + SK_W / 2, player.y - 10, RED, 11);
    }

    if (state === 'ready') {
      text('PRESS SPACE OR TAP TO SHRED', W / 2, 80, WHITE, 13);
      if (best) text('BEST ' + String(best).padStart(6, '0'), W / 2, 104, DIM, 11);
    } else if (state === 'dead') {
      text('BAILED', W / 2, 74, RED, 16);
      text('SPACE OR TAP TO RE-SHRED', W / 2, 100, WHITE, 12);
      text('BEST ' + String(best).padStart(6, '0'), W / 2, 122, DIM, 11);
    }

    scoreEl.textContent = String(Math.floor(score || 0)).padStart(6, '0');
  }

  function loop() {
    cancelAnimationFrame(raf);
    var step = function () {
      if (state !== 'running') { draw(); return; }
      update();
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      var r = canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault();
      jump();
    }
  });
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    canvas.focus();
    jump();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'running') { die(); draw(); }
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });

  reset();
  state = 'ready';
  resize();
  draw();
})();