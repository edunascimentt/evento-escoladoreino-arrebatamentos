/* Página de inscrição: animações (entrada do hero, palavras, partículas, reveal ao rolar,
   versículo que acende, cards 3D, linha do tempo, contadores, vídeo), contagem regressiva,
   formulário e eventos do Meta Pixel (ViewContent, IniciouInscricao, InscricaoEtapa, Lead). Sem frameworks. */
(function () {
  'use strict';
  var started = Date.now();
  var root = document.documentElement;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* ── Meta Pixel: carregado por pixel.js (PageView). Aqui: ViewContent e os eventos do funil. ── */
  var px = window.edrPixel || { track: function () {}, custom: function () {}, eid: function () { return null; } };
  px.track('ViewContent', { content_name: 'Aula: Todos os arrebatamentos da Bíblia', content_category: 'aula_gratuita' });

  /* ── UTMs guardadas na sessão ── */
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  var utm = {};
  try { utm = JSON.parse(sessionStorage.getItem('edr_utm') || '{}'); } catch (e) { utm = {}; }
  var qs = new URLSearchParams(location.search);
  KEYS.forEach(function (k) { if (qs.get(k)) utm[k] = qs.get(k); });
  try { sessionStorage.setItem('edr_utm', JSON.stringify(utm)); } catch (e) { /* modo privado */ }

  /* ── Quebra texto em palavras: <span class="w"><span style="--i:n">palavra</span></span> ── */
  function splitWords(el) {
    var i = 0;
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 1) { wrap(c); return; }
        if (c.nodeType !== 3 || !c.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var inner = document.createElement('span'); inner.style.setProperty('--i', i++); inner.textContent = part;
          w.appendChild(inner); frag.appendChild(w);
        });
        node.replaceChild(frag, c);
      });
    })(el);
    return i;
  }
  $$('[data-split]').forEach(function (el) { el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); splitWords(el); });
  $$('[data-lightup]').forEach(function (el) { splitWords(el); });

  /* ── 1) Entrada do hero quando as fontes chegarem (ou em 900 ms) ── */
  var go = function () { if (!root.classList.contains('ready')) requestAnimationFrame(function () { root.classList.add('ready'); }); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  setTimeout(go, 900);

  /* ── 2) Partículas subindo ── */
  if (!reduce) {
    $$('[data-motes]').forEach(function (box) {
      var n = +box.getAttribute('data-motes') * (window.innerWidth < 640 ? .55 : 1);
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

  /* ── 3) Aparecer ao rolar ── */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add('in'); });

  /* ── 4) Rolagem: topo em pílula + progresso, parallax da foto, versículo, linha do tempo, barra fixa ── */
  var top = $('#top');
  var photo = $('[data-parallax] img');
  var verse = $('[data-lightup]');
  var verseWords = verse ? $$('.w', verse) : [];
  var tl = $('[data-timeline]');
  var tlItems = tl ? $$('li', tl) : [];
  var sticky = $('.sticky');
  var form = $('#inscricao');
  var formVisible = true;
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    top.classList.toggle('scrolled', y > 30);
    top.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    if (photo && !reduce && y < vh * 1.4) photo.style.setProperty('--py', (y * -.08).toFixed(1) + 'px');
    if (verse) {
      var r = verse.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
      var lit = reduce ? verseWords.length : Math.round(p * verseWords.length);
      verseWords.forEach(function (w, k) { w.classList.toggle('lit', k < lit); });
    }
    if (tl) {
      var t = tl.getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (vh * .6 - t.top) / t.height));
      tl.style.setProperty('--fill', f.toFixed(3));
      tlItems.forEach(function (li) { li.classList.toggle('on', li.getBoundingClientRect().top + 28 < vh * .6); });
    }
    if (sticky) sticky.classList.toggle('show', !formVisible && y > vh * .6 && !root.classList.contains('sent'));
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  if (form && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { formVisible = es[0].isIntersecting; onScroll(); }).observe(form);
  }
  onScroll();

  /* ── 5) Luz que segue o cursor no hero + cards 3D ── */
  if (fine && !reduce) {
    var hero = $('.hero');
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
    $$('[data-tilt]').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.setProperty('--ry', ((px - .5) * 10).toFixed(2) + 'deg');
        c.style.setProperty('--rx', ((.5 - py) * 10).toFixed(2) + 'deg');
        c.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        c.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ── 6) Contadores (30 mil, 100%) ── */
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        co.unobserve(e.target);
        var el = e.target, end = +el.getAttribute('data-count'), t0 = performance.now(), dur = reduce ? 0 : 1600;
        (function step(now) {
          var p = dur ? Math.min(1, (now - t0) / dur) : 1;
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: .6 });
    counters.forEach(function (el) { co.observe(el); });
  } else counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });

  /* ── 7) Vídeo do Eduardo: toca mudo quando aparece; botão liga o som ── */
  var vid = $('[data-autoplay]');
  var snd = $('.sound');
  if (vid) {
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { var p = vid.play(); if (p) p.catch(function () {}); }
          else vid.pause();
        });
      }, { threshold: .35 }).observe(vid);
    }
    if (snd) snd.addEventListener('click', function () {
      var on = vid.muted;
      vid.muted = !on;
      if (on) { vid.currentTime = 0; var p = vid.play(); if (p) p.catch(function () {}); }
      snd.setAttribute('aria-pressed', String(on));
      $('.sound-txt', snd).textContent = on ? 'Som ligado' : 'Ativar som';
    });
  }

  /* ── 8) Contagem regressiva (com "virada" dos números) ── */
  $$('[data-countdown]').forEach(function (cd) {
    var target = new Date(cd.getAttribute('data-countdown')).getTime();
    var units = {};
    $$('[data-u]', cd).forEach(function (el) { units[el.getAttribute('data-u')] = el; });
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var set = function (k, v) { var el = units[k]; if (el && el.textContent !== v) { el.textContent = v; if (!reduce) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); } } };
    (function tick() {
      var left = Math.max(0, target - Date.now());
      if (left === 0) {
        cd.classList.add('is-live');
        var lab = $('.cd-label', cd); if (lab) lab.textContent = 'A aula já começou: o link está no seu WhatsApp e e-mail';
        return;
      }
      var s = Math.floor(left / 1000);
      set('d', pad(Math.floor(s / 86400))); set('h', pad(Math.floor(s % 86400 / 3600)));
      set('m', pad(Math.floor(s % 3600 / 60))); set('s', pad(s % 60));
      setTimeout(tick, 1000 - (Date.now() % 1000));
    })();
  });

  /* ── 9) Formulário ── */
  if (!form) return;
  var errBox = $('.err', form);
  var btn = $('button[type=submit]', form);
  var btnTxt = $('.btn-txt', btn);
  var MSG = {
    name: 'Coloque seu nome para a gente saber quem é você.',
    phone: 'Confira o WhatsApp: no Brasil, DDD + número; fora, escolha o país. Ou deixe em branco.',
    email: 'Esse e-mail parece incompleto. Dá uma olhadinha?',
    agree: 'Marque a caixinha para receber o link da aula.',
    rate: 'Muitas tentativas seguidas. Espere um minutinho e tente de novo.',
    net: 'Não conseguimos enviar agora. Confira sua internet e tente de novo.'
  };
  var CHECK = {
    name: function (v) { return v.trim().length >= 2; },
    // WhatsApp is optional (empty passes). Brazil: DDD + number. Abroad: full number 8-15 digits.
    phone: function (v) {
      var d = digits(v);
      if (!d) return true;
      if (country.value === '55') return d.length >= 10 && d.length <= 11;
      return intl(v).length >= 9 && intl(v).length <= 16;
    },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }
  };

  /* WhatsApp: país (código de discagem) + número. Brasil usa a máscara (11) 98765-4321. */
  var phone = form.elements.phone;
  var country = form.elements.country;
  var dial = country.closest('.dial');
  var dialFlag = $('[data-dial-flag]', form);
  var dialCode = $('[data-dial-code]', form);
  var phoneLabel = $('[data-phone-label]', form);
  var CODES = $$('option', country).map(function (o) { return o.value; })
    .filter(function (c) { return c !== 'other'; })
    .sort(function (a, b) { return b.length - a.length; });
  function digits(v) { return v.replace(/\D/g, ''); }
  // Number sent to the server: '' (skipped), Brazil as national digits, abroad as +<code><number>.
  function intl(v) {
    var d = digits(v);
    if (!d) return '';
    if (country.value === 'other') return '+' + d;
    if (country.value !== '39') d = d.replace(/^0+/, ''); // drop trunk 0 (07911… in the UK); Italy keeps it
    return '+' + country.value + d;
  }
  function phoneValue() { return country.value === '55' ? digits(phone.value) : intl(phone.value); }
  function syncCountry(pop) {
    var o = country.options[country.selectedIndex];
    dialFlag.textContent = o.getAttribute('data-flag');
    dialCode.textContent = o.value === 'other' ? '+ …' : '+' + o.value;
    phoneLabel.textContent = o.value === '55' ? 'WhatsApp com DDD' : o.value === 'other' ? 'Número com +código do país' : 'Número do WhatsApp';
    phone.setAttribute('autocomplete', o.value === 'other' ? 'tel' : 'tel-national');
    if (pop && !reduce) { dial.classList.remove('pop'); void dial.offsetWidth; dial.classList.add('pop'); }
  }
  function formatPhone() {
    var raw = phone.value;
    // Typed or pasted with +code (or 00code): pick the country from it.
    if (/^\s*(\+|00)/.test(raw)) {
      var all = digits(raw).replace(/^00/, '');
      var hit = CODES.filter(function (c) { return all.indexOf(c) === 0; })[0];
      if (hit) {
        if (country.value !== hit) { country.value = hit; syncCountry(true); }
        raw = all.slice(hit.length);
      } else {
        if (all.length >= 3 && country.value !== 'other') { country.value = 'other'; syncCountry(true); }
        phone.value = '+' + all.slice(0, 15);
        return;
      }
    }
    var d = digits(raw);
    if (country.value === 'other') { phone.value = d ? '+' + d.slice(0, 15) : ''; return; }
    if (country.value !== '55') { phone.value = d.slice(0, 15 - country.value.length); return; }
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    d = d.slice(0, 11);
    var out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 6) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
    phone.value = out;
  }
  phone.addEventListener('input', function () { formatPhone(); navLabel(); });
  country.addEventListener('change', function () {
    syncCountry(true);
    // A country picked by hand wins over a "+code" left in the field (from "Outro país").
    if (country.value !== 'other') phone.value = digits(phone.value);
    formatPhone();
    phone.removeAttribute('aria-invalid');
    errBox.hidden = true;
    phone.closest('.field').classList.toggle('valid', !!digits(phone.value) && CHECK.phone(phone.value));
    phone.focus({ preventScroll: true });
  });
  syncCountry(false);

  Object.keys(CHECK).forEach(function (n) {
    var el = form.elements[n];
    var mark = function () { el.closest('.field').classList.toggle('valid', !!el.value.trim() && CHECK[n](el.value)); };
    el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); errBox.hidden = true; mark(); });
    el.addEventListener('blur', mark);
  });
  form.elements.agree.addEventListener('change', function () { form.elements.agree.removeAttribute('aria-invalid'); errBox.hidden = true; });

  /* Etapas: 0 convite, 1 nome, 2 WhatsApp, 3 e-mail + aceite. Uma por vez. */
  var STEP_OF = { name: 1, phone: 2, email: 3, agree: 3 };
  var LAST = 3;
  var step = 0;
  var steps = $$('.step', form);
  var stepNum = $('[data-stepnum]', form);
  var hello = $('[data-hello]', form);
  form.classList.add('stepped');
  function goTo(n, focus) {
    var dir = n >= step ? 'go-fwd' : 'go-back';
    step = Math.max(0, Math.min(LAST, n));
    form.setAttribute('data-step', step);
    form.style.setProperty('--sp', (step / LAST).toFixed(3));
    steps.forEach(function (s) {
      var on = +s.getAttribute('data-step') === step;
      s.classList.toggle('active', on);
      s.classList.remove('go-fwd', 'go-back');
      if (on) { void s.offsetWidth; s.classList.add(dir); }
    });
    if (stepNum) stepNum.textContent = step;
    navLabel();
    errBox.hidden = true;
    if (step === 2 && hello) {
      var first = form.elements.name.value.trim().split(' ')[0];
      hello.textContent = first ? 'Prazer, ' + first + '!' : 'Prazer!';
    }
    if (focus !== false && step > 0) {
      var input = $('.step.active input', form);
      if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
    }
  }
  // Button text: "Pular" on the WhatsApp step while it is empty (the number is optional).
  function navLabel() {
    btnTxt.textContent = step === LAST ? 'Garantir vaga' : step === STEP_OF.phone && !digits(phone.value) ? 'Pular' : 'Continuar';
  }
  var startedForm = false;
  var markStart = function () { if (!startedForm) { startedForm = true; px.custom('IniciouInscricao', { aula: 'todos-os-arrebatamentos' }); } };
  $('[data-next]', form).addEventListener('click', function () { markStart(); goTo(1); });
  $('[data-back]', form).addEventListener('click', function () { goTo(step - 1); });
  // Botões "Garantir vaga" da página: rolam até o card e já abrem a primeira pergunta.
  $$('a[href="#inscricao"]').forEach(function (a) {
    a.addEventListener('click', function () { if (step === 0) { markStart(); setTimeout(function () { goTo(1); }, 450); } });
  });
  goTo(0, false);

  function showError(code) {
    if (STEP_OF[code] && STEP_OF[code] !== step) goTo(STEP_OF[code]);
    errBox.hidden = false;
    errBox.textContent = MSG[code] || MSG.net;
    var el = form.elements[code];
    if (el && el.setAttribute) { el.removeAttribute('aria-invalid'); void el.offsetWidth; el.setAttribute('aria-invalid', 'true'); el.focus({ preventScroll: true }); }
  }

  function validate(upTo) {
    for (var n in CHECK) if (STEP_OF[n] <= upTo && !CHECK[n](form.elements[n].value)) return n;
    if (upTo >= 3 && !form.elements.agree.checked) return 'agree';
    return null;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (step === 0) return goTo(1);
    var bad = validate(step);
    if (bad) return showError(bad);
    if (step < LAST) { px.custom('InscricaoEtapa', { etapa: step }); return goTo(step + 1); }
    btn.classList.add('loading');
    btnTxt.textContent = 'Garantindo sua vaga…';
    var name = form.elements.name.value.trim();
    var leadId = px.eid();
    fetch('/api/inscricao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: name,
        phone: phoneValue(),
        email: form.elements.email.value.trim(),
        agree: form.elements.agree.checked,
        website: form.elements.website.value,
        elapsed: Date.now() - started,
        referrer: document.referrer || null,
        utm: utm,
        eventId: leadId
      })
    }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (!res.ok) throw res.error || 'net';
        root.classList.add('sent');
        px.track('Lead', { content_name: 'Aula: Todos os arrebatamentos da Bíblia', content_category: 'aula_gratuita' }, leadId);
        try { sessionStorage.setItem('edr_nome', name.split(' ')[0]); } catch (err) { /* ignore */ }
        btnTxt.textContent = 'Vaga garantida!';
        setTimeout(function () { location.href = '/grupo'; }, 350);
      })
      .catch(function (code) {
        btn.classList.remove('loading');
        btnTxt.textContent = 'Garantir vaga';
        showError(typeof code === 'string' ? code : 'net');
      });
  });
})();
