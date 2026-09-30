(function () {
    'use strict';
    var CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA', 'Enter'];
    var pos = 0;
    var running = false;

    document.addEventListener('keydown', function (e) {
        pos = e.code === CODE[pos] ? pos + 1 : (e.code === CODE[0] ? 1 : 0);
        if (pos === CODE.length) {
            pos = 0;
            if (!running) cameo();
        }
    });

    var PX = 4;
    var WHITE = '#f2f2f2';
    var RED = '#e03050';
    var COLORS = { '1': WHITE, '2': WHITE, '3': RED, '4': '#6e6e6e', '5': '#454545' };
    var BODY_A = [
        '....1111....', '....1111....', '....1111....', '.....11.....',
        '...222222...', '..2.2222.2..', '..2.2222.2..', '....2222....',
        '....1111....', '...11..11...', '...1....1...', '..11....11..'
    ];
    var BODY_B = BODY_A.slice();
    BODY_B[10] = '....1..1....';
    BODY_B[11] = '...11..11...';
    var BODY_AIR = [
        '....1111....', '....1111....', '....1111....', '.....11.....',
        '.2.222222.2.', '..2.2222.2..', '....2222....', '....2222....',
        '...111111...', '..11....11..', '..1......1..', '............'
    ];
    var BOARD_FLIP = [
        ['333333333333', '.44......44.'],
        ['.3333333333.', '.5555555555.'],
        ['............', '555555555555'],
        ['.44......44.', '555555555555'],
        ['.5555555555.', '.3333333333.']
    ];
    var FLIP_ORDER = [0, 1, 2, 3, 4, 1, 0];
    var FLIP_DROP = [0, 2, 4, 6, 4, 2, 0];

    function cameo() {
        running = true;
        var canvas = document.createElement('canvas');
        canvas.className = 'konami-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var W = canvas.clientWidth, H = canvas.clientHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var groundY = H - 16;
        var x = -60, y = 0, vy = 0, air = false, airT = 0, jumped = false, frame = 0, label = 0;
        var speed = reduce ? 14 : 7;

        function sprite(rows, sx, sy) {
            for (var r = 0; r < rows.length; r++) {
                for (var c = 0; c < rows[r].length; c++) {
                    var ch = rows[r][c];
                    if (ch === '.') continue;
                    ctx.fillStyle = COLORS[ch];
                    ctx.fillRect(Math.round(sx + c * PX), Math.round(sy + r * PX), PX, PX);
                }
            }
        }

        function tick() {
            frame++;
            x += speed;
            if (!jumped && x > W / 2 - 24) {
                jumped = true;
                air = true;
                vy = -11;
                label = 70;
            }
            if (air) {
                vy += 0.6;
                y += vy;
                airT++;
                if (y >= 0) { y = 0; vy = 0; air = false; }
            }

            ctx.clearRect(0, 0, W, H);
            var top = groundY - 14 * PX + y;
            var body, board, drop = 0;
            if (air) {
                body = BODY_AIR;
                var step = Math.min(FLIP_ORDER.length - 1, Math.floor(airT / 4));
                board = BOARD_FLIP[FLIP_ORDER[step]];
                drop = FLIP_DROP[step];
            } else {
                body = Math.floor(frame / 8) % 2 ? BODY_A : BODY_B;
                board = BOARD_FLIP[0];
            }
            sprite(body, x, top);
            sprite(board, x, top + 12 * PX + drop);

            if (label > 0) {
                label--;
                ctx.globalAlpha = Math.min(1, label / 20);
                ctx.fillStyle = RED;
                ctx.font = '700 12px "Space Mono", "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('+100000 STEEEEZE', x + 24, top - 12 - (70 - label) * 0.4);
                ctx.globalAlpha = 1;
            }

            if (x < W + 60) {
                requestAnimationFrame(tick);
            } else {
                canvas.remove();
                running = false;
            }
        }
        requestAnimationFrame(tick);
    }
})();