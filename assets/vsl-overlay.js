/* P1 (início com som) + S1 (retomar). A prévia local não é o player de audiência.
   Protocolo oficial: https://docs.pandavideo.com/reference/send-events
   O receptor vsl.js continua sendo o único emissor dos marcos no dataLayer. */
(function () {
  'use strict';
  var frame = document.getElementById('heroVslFrame');
  var start = document.getElementById('vslStartOverlay');
  var pause = document.getElementById('vslPauseOverlay');
  var teaser = document.getElementById('vslTeaser');
  var status = document.getElementById('vslOverlayStatus');
  if (!frame || !start || !pause || !teaser || !status || frame.dataset.overlayInstalled) return;
  var url;
  try { url = new URL(frame.getAttribute('src'), window.location.href); } catch (error) { return; }
  if (url.protocol !== 'https:' || !/^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(url.hostname) || !url.searchParams.get('v')) return;
  frame.dataset.overlayInstalled = 'true';
  var videoId = url.searchParams.get('v');
  var startButton = start.querySelector('button');
  var pauseButton = pause.querySelector('button');
  var initialTabindex = frame.getAttribute('tabindex');
  var ready = false, begun = false, state = 'initial', pending = null, sent = false;
  var currentTime = 0, duration = Number(document.getElementById('heroVsl').dataset.vslDuration);
  var timeout = null, pauseTimer = null, inView = true;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);

  function preview() {
    if (state !== 'initial' || !inView || document.visibilityState === 'hidden' || reducedMotion.matches || saveData) {
      teaser.pause(); return;
    }
    if (!teaser.getAttribute('src')) teaser.src = teaser.dataset.src;
    teaser.muted = true;
    var playing = teaser.play();
    if (playing && playing.catch) playing.catch(function () {});
  }
  function clearPending() {
    clearTimeout(timeout); timeout = null; pending = null; sent = false;
    startButton.disabled = false; pauseButton.disabled = false;
    startButton.removeAttribute('aria-busy'); pauseButton.removeAttribute('aria-busy');
  }
  function draw(next) {
    state = next;
    start.hidden = next !== 'initial' && next !== 'starting';
    pause.hidden = next !== 'paused' && next !== 'resuming';
    if (start.hidden && pause.hidden) {
      if (initialTabindex === null) frame.removeAttribute('tabindex');
      else frame.setAttribute('tabindex', initialTabindex);
    } else frame.setAttribute('tabindex', '-1');
    preview();
  }
  function fallback() {
    clearPending(); clearTimeout(pauseTimer); draw('native');
    status.textContent = 'Use o botão de play do vídeo para continuar.';
    status.hidden = false;
    frame.focus({ preventScroll: true });
  }
  function post(type, parameter) {
    var command = { type: type };
    if (parameter !== undefined) command.parameter = parameter;
    frame.contentWindow.postMessage(command, url.origin);
  }
  function sendPending() {
    if (!ready || !pending || sent) return;
    sent = true;
    try {
      // Só a P1 volta ao início e ativa o som. A S1 preserva tempo e volume.
      if (pending === 'start') { post('currentTime', 0); post('volume', 1); }
      post('play');
    } catch (error) { fallback(); }
  }
  function requestPlay(kind) {
    if (pending) return;
    pending = kind; sent = false; status.hidden = true;
    var button = kind === 'start' ? startButton : pauseButton;
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    draw(kind === 'start' ? 'starting' : 'resuming');
    timeout = setTimeout(fallback, 8000);
    sendPending();
  }
  function playing() {
    if (state === 'native') return;
    var focusedOverlay = start.contains(document.activeElement) || pause.contains(document.activeElement);
    begun = true; clearPending(); clearTimeout(pauseTimer); status.hidden = true; draw('playing');
    if (focusedOverlay) frame.focus({ preventScroll: true });
  }
  function paused() {
    if (!begun || pending || state === 'native' || state === 'ended') return;
    // Alguns players enviam pause antes de ended. Não cobrir o fim com S1.
    if (duration > 0 && currentTime >= duration - 0.25) { draw('ended'); return; }
    draw('paused');
    if (document.activeElement === frame && !document.fullscreenElement) pauseButton.focus({ preventScroll: true });
  }
  startButton.addEventListener('click', function () { requestPlay('start'); });
  pauseButton.addEventListener('click', function () { requestPlay('resume'); });
  window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow || event.origin !== url.origin) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || typeof data.message !== 'string' ||
        (data.video && data.video !== videoId) || data.isMutedIndicator === true) return;
    if (typeof data.currentTime === 'number' && Number.isFinite(data.currentTime)) currentTime = data.currentTime;
    // allData é o mesmo sinal de prontidão usado pelo SDK oficial api.v2.js.
    if (data.message === 'panda_ready' || (data.message === 'panda_allData' && data.playerData && data.playerData.duration > 0)) {
      ready = true; sendPending();
    }
    switch (data.message) {
      case 'panda_play': playing(); break;
      case 'panda_pause':
        clearTimeout(pauseTimer); pauseTimer = setTimeout(paused, 80); break;
      case 'panda_ended':
        clearTimeout(pauseTimer); clearPending(); draw('ended'); break;
      case 'panda_error': fallback(); break;
    }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting; preview();
    }, { threshold: 0.1 }).observe(start);
  }
  document.addEventListener('visibilitychange', preview);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', preview);
  window.addEventListener('pagehide', function () { teaser.pause(); clearTimeout(pauseTimer); });
  window.addEventListener('pageshow', preview);
  draw('initial');
})();
