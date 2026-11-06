/* Página de confirmação: nome da pessoa, partículas, confete e botões de agenda. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    var nome = sessionStorage.getItem('edr_nome');
    if (nome) document.querySelector('[data-name]').textContent = 'Pronto, ' + nome + '! Sua vaga está garantida.';
  } catch (e) { /* ignore */ }

  // partículas subindo
  if (!reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-motes]'), function (box) {
      var n = +box.getAttribute('data-motes');
      for (var k = 0; k < n; k++) {
        var m = document.createElement('i');
        m.style.left = (Math.random() * 100).toFixed(1) + '%';
        m.style.setProperty('--s', (2 + Math.random() * 4).toFixed(1) + 'px');
        m.style.setProperty('--t', (9 + Math.random() * 12).toFixed(1) + 's');
        m.style.setProperty('--dl', (-Math.random() * 20).toFixed(1) + 's');
        m.style.setProperty('--x', ((Math.random() - .5) * 120).toFixed(0) + 'px');
        m.style.setProperty('--o', (.35 + Math.random() * .6).toFixed(2));
        box.appendChild(m);
      }
    });
  }

  // confete nas cores da marca
  function confetti() {
    if (reduce) return;
    var c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
    var colors = ['#DB5500', '#f07a2a', '#e9cfa3', '#EDE3D3', '#c89b62', '#1FAF54'];
    var parts = [];
    for (var i = 0; i < 160; i++) {
      var fromLeft = i % 2 === 0;
      parts.push({
        x: fromLeft ? 0 : W, y: H * .75,
        vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 12) * dpr,
        vy: -(12 + Math.random() * 14) * dpr,
        w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 10) * dpr,
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        c: colors[i % colors.length]
      });
    }
    var t0 = performance.now();
    (function frame(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += .35 * dpr; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 3800);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      });
      if (t < 3800) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  setTimeout(confetti, 350);

  // Salvar na agenda = CompleteRegistration (sem grupo de WhatsApp nesta aula)
  var px = window.edrPixel || { track: function () {}, eid: function () { return ''; } };
  var sent = false;
  Array.prototype.forEach.call(document.querySelectorAll('#cal-google, #cal-ics'), function (a) {
    a.addEventListener('click', function () {
      if (sent) return; sent = true;
      px.track('CompleteRegistration', { content_name: 'Agenda: Todos os arrebatamentos da Bíblia', status: 'agenda' }, px.eid());
    });
  });

  // Click ripple + magnetic pull on the calendar buttons (off under reduced motion).
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.btn');
      if (!b) return;
      var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
      var s = document.createElement('span');
      s.className = 'ripple';
      s.setAttribute('aria-hidden', 'true');
      s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left) + 'px;top:' + (e.clientY - r.top) + 'px';
      b.appendChild(s);
      setTimeout(function () { s.remove(); }, 750);
    }, { passive: true });
    if (window.matchMedia('(pointer: fine)').matches) {
      Array.prototype.forEach.call(document.querySelectorAll('.btn-cal'), function (el) {
        el.classList.add('magnetic');
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * .12).toFixed(1) + 'px');
          el.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * .2).toFixed(1) + 'px');
        });
        el.addEventListener('pointerleave', function () { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
      });
    }
  }
})();
