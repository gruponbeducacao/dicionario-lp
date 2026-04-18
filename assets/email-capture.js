/* Fluência Contábil — Dicionário LP — Email Capture
   Exit-intent modal + Sticky bar (sem share buttons, não é blog)
   Integrado ao fluxo de lead magnet: submit → redireciona pra /obrigado.html
   (o obrigado.html dispara o download automático do PDF)
*/
(function () {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzn7NkJAEr_zVz_POnd4JeugXdDe-CGLbhqhXn4F27lkASxbTkNOGB_x5C1n7hFK-jUQg/exec';
  var SUCCESS_URL = 'obrigado.html';

  var KEYS = {
    subscribed: 'fc_ec_dic_subscribed',
    exitClosedAt: 'fc_ec_dic_exit_closed_at',
    stickyClosedAt: 'fc_ec_dic_sticky_closed_at'
  };

  var COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  var ARM_DELAY_MS = 15000;
  var STICKY_DELAY_MS = 45000;
  var STICKY_SCROLL_PCT = 0.5;

  function safeLocalGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeLocalSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) {}
  }

  function isSubscribed() { return safeLocalGet(KEYS.subscribed) === '1'; }
  function recentlyClosed(key) {
    var ts = parseInt(safeLocalGet(key) || '0', 10);
    if (!ts) return false;
    return (Date.now() - ts) < COOLDOWN_MS;
  }
  function markSubscribed() { safeLocalSet(KEYS.subscribed, '1'); }
  function markClosed(key) { safeLocalSet(key, String(Date.now())); }

  function submitEmail(email, origem) {
    var data = new URLSearchParams({ email: email, origem: origem });
    return fetch(ENDPOINT, { method: 'POST', body: data, mode: 'no-cors' });
  }
  function isValidEmail(v) { return !!v && /\S+@\S+\.\S+/.test(v); }

  function goToSuccess() { window.location.href = SUCCESS_URL; }

  /* ================= EXIT-INTENT MODAL ================= */
  function buildExitModal() {
    var html = ''
      + '<div class="fc-ec-overlay" id="fc-ec-exit-overlay" role="dialog" aria-modal="true" aria-labelledby="fc-ec-exit-title">'
      +   '<div class="fc-ec-modal">'
      +     '<button type="button" class="fc-ec-close" aria-label="Fechar">&times;</button>'
      +     '<div class="fc-ec-exit-body">'
      +       '<span class="fc-ec-eyebrow">Antes de ir</span>'
      +       '<div class="fc-ec-bar"></div>'
      +       '<h2 class="fc-ec-title" id="fc-ec-exit-title">Baixe o Dicionário Contábil grátis</h2>'
      +       '<p class="fc-ec-desc">400+ definições de contabilidade explicadas com clareza. Download imediato em PDF, sem complicação.</p>'
      +       '<form class="fc-ec-form" novalidate>'
      +         '<input type="email" placeholder="Seu melhor e-mail" required autocomplete="email">'
      +         '<button type="submit">Quero o PDF grátis</button>'
      +       '</form>'
      +       '<p class="fc-ec-fineprint">Você pode cancelar quando quiser.</p>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  }

  function showExit() {
    var overlay = document.getElementById('fc-ec-exit-overlay');
    if (!overlay) return;
    overlay.classList.add('fc-ec-show');
    document.documentElement.style.overflow = 'hidden';
  }
  function hideExit() {
    var overlay = document.getElementById('fc-ec-exit-overlay');
    if (!overlay) return;
    overlay.classList.remove('fc-ec-show');
    document.documentElement.style.overflow = '';
  }

  function initExitIntent() {
    if (isSubscribed()) return;
    if (recentlyClosed(KEYS.exitClosedAt)) return;

    buildExitModal();

    var overlay = document.getElementById('fc-ec-exit-overlay');
    var closeBtn = overlay.querySelector('.fc-ec-close');
    var form = overlay.querySelector('.fc-ec-form');

    var armed = false;
    setTimeout(function () { armed = true; }, ARM_DELAY_MS);

    var shown = false;
    function trigger() {
      if (shown || !armed) return;
      if (isSubscribed() || recentlyClosed(KEYS.exitClosedAt)) return;
      shown = true;
      showExit();
    }

    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) trigger();
    });

    var lastY = window.scrollY;
    var lastT = Date.now();
    var mobileArmed = false;
    setTimeout(function () { mobileArmed = true; }, 20000);

    window.addEventListener('scroll', function () {
      if (!mobileArmed || shown) return;
      var y = window.scrollY;
      var t = Date.now();
      var dy = lastY - y;
      var dt = t - lastT;
      if (dy > 400 && dt < 600 && y < 500) trigger();
      lastY = y;
      lastT = t;
    }, { passive: true });

    closeBtn.addEventListener('click', function () {
      hideExit();
      markClosed(KEYS.exitClosedAt);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        hideExit();
        markClosed(KEYS.exitClosedAt);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('fc-ec-show')) {
        hideExit();
        markClosed(KEYS.exitClosedAt);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var btn = form.querySelector('button');
      var email = (input.value || '').trim();
      if (!isValidEmail(email)) {
        input.focus();
        input.style.borderColor = '#C0392B';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      submitEmail(email, 'dicionario_exit_intent').finally(function () {
        markSubscribed();
        goToSuccess();
      });
    });
  }

  /* ================= STICKY BAR ================= */
  function buildSticky() {
    var html = ''
      + '<div class="fc-ec-sticky" id="fc-ec-sticky" role="complementary" aria-label="Baixe o dicion\u00e1rio">'
      +   '<div class="fc-ec-sticky-text">'
      +     '<strong>Dicion\u00e1rio Cont\u00e1bil gr\u00e1tis</strong> — 400+ defini\u00e7\u00f5es em PDF. Download imediato.'
      +   '</div>'
      +   '<form class="fc-ec-sticky-form" novalidate>'
      +     '<input type="email" placeholder="Seu melhor e-mail" required autocomplete="email">'
      +     '<button type="submit">Baixar</button>'
      +   '</form>'
      +   '<button type="button" class="fc-ec-sticky-close" aria-label="Fechar barra">&times;</button>'
      + '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  }

  function showSticky() {
    var el = document.getElementById('fc-ec-sticky');
    if (!el) return;
    el.classList.add('fc-ec-show');
  }
  function hideStickyIfAny() {
    var el = document.getElementById('fc-ec-sticky');
    if (el) el.classList.remove('fc-ec-show');
  }

  function initSticky() {
    if (isSubscribed()) return;
    if (recentlyClosed(KEYS.stickyClosedAt)) return;

    buildSticky();

    var el = document.getElementById('fc-ec-sticky');
    var form = el.querySelector('.fc-ec-sticky-form');
    var closeBtn = el.querySelector('.fc-ec-sticky-close');

    var shown = false;
    function trigger() {
      if (shown) return;
      if (isSubscribed() || recentlyClosed(KEYS.stickyClosedAt)) return;
      shown = true;
      showSticky();
    }

    window.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0) return;
      if ((window.scrollY / h) >= STICKY_SCROLL_PCT) trigger();
    }, { passive: true });

    setTimeout(trigger, STICKY_DELAY_MS);

    closeBtn.addEventListener('click', function () {
      hideStickyIfAny();
      markClosed(KEYS.stickyClosedAt);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var btn = form.querySelector('button');
      var email = (input.value || '').trim();
      if (!isValidEmail(email)) {
        input.focus();
        input.style.borderColor = '#C0392B';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      submitEmail(email, 'dicionario_sticky_bar').finally(function () {
        markSubscribed();
        goToSuccess();
      });
    });
  }

  /* ================= INIT ================= */
  function init() {
    // Não rodar na própria página de obrigado.html
    if (/obrigado\.html?$/i.test(window.location.pathname)) return;
    try { initExitIntent(); } catch (e) {}
    try { initSticky(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
