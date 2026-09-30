(function () {
  'use strict';
  var canvas = document.querySelector('.hero-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, lines;
  var GRID = 18;
  var OFF = 0;
  var dpr = 1;
  var boost = document.createElement('canvas');
  var bctx = boost.getContext('2d');
  var COUNT = 30;
  var R = 255, G = 255, B = 255;
  var AR = 200, AG = 36, AB = 63;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var mx = -9999, my = -9999, hover = 0, hoverTarget = 0;
  var ripples = [];

  function snap(v) { return OFF + Math.round((v - OFF) / GRID) * GRID; }

  function makeLine() {
    var y = snap(GRID + Math.random() * (H - GRID * 2));
    var points = [{ x: 0, y: y }];
    var cx = 0, cy = y;
    var maxY = OFF + Math.floor((H - GRID - OFF) / GRID) * GRID;
    for (var i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
      var roll = Math.random();
      if (roll < 0.62 || cx < W * 0.25) {
        cx = Math.min(W, snap(cx + GRID * (6 + Math.floor(Math.random() * 11))));
      } else if (roll < 0.80) {
        cy = Math.max(OFF + GRID, cy - GRID * (2 + Math.floor(Math.random() * 4)));
      } else {
        cy = Math.min(maxY, cy + GRID * (2 + Math.floor(Math.random() * 4)));
      }
      points.push({ x: cx, y: cy });
      if (cx >= W) break;
    }
    if (points[points.length - 1].x < W) points.push({ x: W, y: points[points.length - 1].y });

    var total = 0;
    var lens = [];
    for (var j = 1; j < points.length; j++) {
      var d = Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y);
      lens.push(d); total += d;
    }
    return {
      points: points, lens: lens, total: total,
      drawn: 0, tailStart: 0,
      tailLen: total * (0.3 + Math.random() * 0.25),
      speed: 1.8 + Math.random() * 1.4,
      phase: 'drawing', holdTimer: 0,
      brightness: 0.6 + Math.random() * 0.4
    };
  }

  function init() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lines = Array.from({ length: COUNT }, function (_, i) {
      var l = makeLine();
      l.drawn = (l.total / COUNT) * i;
      l.tailStart = Math.max(0, l.drawn - l.tailLen);
      return l;
    });
  }

  function pointAt(line, d) {
    d = Math.max(0, Math.min(line.total, d));
    var acc = 0;
    for (var i = 1; i < line.points.length; i++) {
      var seg = line.lens[i - 1];
      if (acc + seg >= d) {
        var t = (d - acc) / seg;
        return {
          x: line.points[i - 1].x + t * (line.points[i].x - line.points[i - 1].x),
          y: line.points[i - 1].y + t * (line.points[i].y - line.points[i - 1].y)
        };
      }
      acc += seg;
    }
    return { x: line.points[line.points.length - 1].x, y: line.points[line.points.length - 1].y };
  }

  function drawSeg(line, a, b, alpha) {
    if (b <= a) return;
    a = Math.max(0, a); b = Math.min(line.total, b);
    ctx.strokeStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + (alpha * line.brightness) + ')';
    ctx.lineWidth = 1.2;
    var acc = 0;
    for (var i = 1; i < line.points.length; i++) {
      var segStart = acc;
      var segEnd = acc + line.lens[i - 1];
      if (segEnd <= a) { acc = segEnd; continue; }
      if (segStart >= b) break;
      var clipA = Math.max(a, segStart);
      var clipB = Math.min(b, segEnd);
      var len = line.lens[i - 1];
      var tA = (clipA - segStart) / len;
      var tB = (clipB - segStart) / len;
      var x0 = line.points[i - 1].x, y0 = line.points[i - 1].y;
      var x1 = line.points[i].x, y1 = line.points[i].y;
      ctx.beginPath();
      ctx.moveTo(x0 + tA * (x1 - x0), y0 + tA * (y1 - y0));
      ctx.lineTo(x0 + tB * (x1 - x0), y0 + tB * (y1 - y0));
      ctx.stroke();
      acc = segEnd;
    }
  }

  function drawComet(line, tail, head, scale) {
    if (head <= tail) return;
    var STEPS = 20, segLen = (head - tail) / STEPS;
    for (var s = 0; s < STEPS; s++) {
      var a0 = tail + segLen * s;
      var a1 = tail + segLen * (s + 1);
      drawSeg(line, a0, Math.min(a1, head), (s / STEPS) * 0.9 * scale);
    }
    drawNodes(line, tail, head, 0.5 * scale);
  }

  function drawDot(line, d, alpha) {
    var p = pointAt(line, d);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + AR + ',' + AG + ',' + AB + ',' + Math.min(1, alpha * line.brightness * 1.8) + ')';
    ctx.fill();
  }

  function drawNodes(line, fromD, toD, alpha) {
    var acc = 0;
    for (var i = 0; i < line.points.length; i++) {
      if (acc >= fromD && acc <= toD) {
        ctx.beginPath(); ctx.arc(line.points[i].x, line.points[i].y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + (alpha * line.brightness * 0.7) + ')';
        ctx.fill();
      }
      if (i < line.lens.length) acc += line.lens[i];
    }
  }

  function tint() {
    hover = reduceMotion ? hoverTarget : hover + (hoverTarget - hover) * 0.08;
    if (hover < 0.01) return;
    var g = ctx.createRadialGradient(mx, my, 0, mx, my, 150);
    g.addColorStop(0, 'rgba(224,48,80,' + hover + ')');
    g.addColorStop(0.45, 'rgba(224,48,80,' + (0.35 * hover) + ')');
    g.addColorStop(1, 'rgba(224,48,80,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(mx - 150, my - 150, 300, 300);
    ctx.restore();
    var S = Math.round(300 * dpr);
    var sx = Math.round((mx - 150) * dpr), sy = Math.round((my - 150) * dpr);
    if (boost.width !== S) { boost.width = S; boost.height = S; }
    bctx.globalCompositeOperation = 'source-over';
    bctx.clearRect(0, 0, S, S);
    bctx.drawImage(canvas, sx, sy, S, S, 0, 0, S, S);
    var m = bctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    m.addColorStop(0, 'rgba(0,0,0,' + hover + ')');
    m.addColorStop(0.45, 'rgba(0,0,0,' + (0.4 * hover) + ')');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.globalCompositeOperation = 'destination-in';
    bctx.fillStyle = m;
    bctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(boost, sx, sy);
    ctx.drawImage(boost, sx, sy);
    ctx.restore();
  }

  function drawRipples() {
    for (var k = ripples.length - 1; k >= 0; k--) {
      var rp = ripples[k];
      rp.r += 6;
      var life = 1 - rp.r / rp.max;
      if (life <= 0) { ripples.splice(k, 1); continue; }
      var band = 30;
      var inner = Math.max(0, rp.r - band), outer = rp.r + band;
      var g = ctx.createRadialGradient(rp.x, rp.y, inner, rp.x, rp.y, outer);
      g.addColorStop(0, 'rgba(224,48,80,0)');
      g.addColorStop(0.5, 'rgba(224,48,80,' + life + ')');
      g.addColorStop(1, 'rgba(224,48,80,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = g;
      ctx.fillRect(rp.x - outer, rp.y - outer, outer * 2, outer * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(224,48,80,' + (0.18 * life) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
      var gx0 = Math.max(0, Math.floor((rp.x - outer) / GRID));
      var gx1 = Math.min(Math.floor(W / GRID), Math.ceil((rp.x + outer) / GRID));
      var gy0 = Math.max(0, Math.floor((rp.y - outer) / GRID));
      var gy1 = Math.min(Math.floor(H / GRID), Math.ceil((rp.y + outer) / GRID));
      for (var gx = gx0; gx <= gx1; gx++) {
        for (var gy = gy0; gy <= gy1; gy++) {
          var px = gx * GRID, py = gy * GRID;
          var off = Math.abs(Math.hypot(px - rp.x, py - rp.y) - rp.r);
          if (off >= band) continue;
          var a = (1 - off / band) * life;
          ctx.beginPath();
          ctx.arc(px, py, 1.2 + a, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(224,48,80,' + a + ')';
          ctx.fill();
        }
      }
    }
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    lines.forEach(function (line, i) {
      if (line.phase === 'drawing') {
        line.drawn = Math.min(line.drawn + line.speed, line.total);
        line.tailStart = Math.max(0, line.drawn - line.tailLen);
        drawComet(line, line.tailStart, line.drawn, 1);
        drawDot(line, line.drawn, 1.0);
        if (line.drawn >= line.total) {
          line.phase = 'holding';
          line.holdTimer = 20 + Math.floor(Math.random() * 40);
        }
      } else if (line.phase === 'holding') {
        drawComet(line, line.tailStart, line.total, 1);
        if (--line.holdTimer <= 0) line.phase = 'fading';
      } else if (line.phase === 'fading') {
        line.tailStart = Math.min(line.tailStart + line.speed * 2, line.total);
        var rem = line.total - line.tailStart;
        if (rem > 0) {
          drawComet(line, line.tailStart, line.total, rem / line.tailLen);
        } else {
          line.phase = 'done';
        }
      } else if (line.phase === 'done') {
        line.phase = 'waiting';
        setTimeout(function () { lines[i] = makeLine(); }, 200 + Math.random() * 800);
      }
    });
    tint();
    drawRipples();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    lines.forEach(function (line) {
      drawSeg(line, 0, line.total, 0.4);
      drawNodes(line, 0, line.total, 0.3);
    });
    tint();
  }

  var rafId = null, paused = false;
  function loop() {
    if (paused) { rafId = null; return; }
    frame();
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (!paused && rafId === null) loop(); }
  function stop() { paused = true; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  function resume() { if (paused) { paused = false; start(); } }

  init();

  if (reduceMotion) {
    drawStatic();
  } else {
    start();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else resume();
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) resume(); else stop();
      }, { threshold: 0 });
      io.observe(canvas);
    }
  }

  var hero = document.getElementById('hero');
  if (hero && !reduceMotion) {
    hero.addEventListener('pointerdown', function (e) {
      var r = hero.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var far = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
      ripples.push({ x: x, y: y, r: 0, max: Math.min(far, 700) });
      if (ripples.length > 4) ripples.shift();
    });
  }
  if (hero && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      hero.style.setProperty('--mx', mx + 'px');
      hero.style.setProperty('--my', my + 'px');
      hero.classList.add('pointer-in');
      hoverTarget = 1;
      if (reduceMotion) drawStatic();
    });
    hero.addEventListener('pointerleave', function () {
      hero.classList.remove('pointer-in');
      hoverTarget = 0;
      if (reduceMotion) drawStatic();
    });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      init();
      if (reduceMotion) drawStatic();
    }, 150);
  });
})();