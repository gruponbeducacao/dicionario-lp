/* S1 (retomar na pausa). O início é o botão nativo do player.
   Protocolo oficial: https://docs.pandavideo.com/reference/send-events
   O receptor vsl.js continua sendo o único emissor dos marcos no dataLayer. */
(function () {
  'use strict';
  var frame = document.getElementById('heroVslFrame');
  var pause = document.getElementById('vslPauseOverlay');
  var status = document.getElementById('vslOverlayStatus');
  var slot = document.getElementById('heroVsl');
  // O botão e o slot entram nas guardas: sem eles o script parava com TypeError,
  // e exceção aqui interrompe os scripts seguintes da página — inclusive o
  // receptor que mede a VSL. Overlay ausente tem de ser silencioso, nunca fatal.
  var pauseButton = pause && pause.querySelector('button');
  if (!frame || !pause || !status || !slot || !pauseButton || frame.dataset.overlayInstalled) return;
  var url;
  try { url = new URL(frame.getAttribute('src'), window.location.href); } catch (error) { return; }
  if (url.protocol !== 'https:' || !/^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(url.hostname) || !url.searchParams.get('v')) return;
  frame.dataset.overlayInstalled = 'true';
  var videoId = url.searchParams.get('v');
  var initialTabindex = frame.getAttribute('tabindex');
  var ready = false, begun = false, state = 'initial', pending = false, sent = false;
  var currentTime = 0, duration = Number(slot.dataset.vslDuration);
  var timeout = null, pauseTimer = null;

  function clearPending() {
    clearTimeout(timeout); timeout = null; pending = false; sent = false;
    pauseButton.disabled = false; pauseButton.removeAttribute('aria-busy');
  }
  function draw(next) {
    state = next;
    // Sem a P1, o overlay só existe na pausa: em qualquer outro estado o player
    // fica livre, com os próprios controles.
    pause.hidden = next !== 'paused' && next !== 'resuming';
    if (pause.hidden) {
      if (initialTabindex === null) frame.removeAttribute('tabindex');
      else frame.setAttribute('tabindex', initialTabindex);
    } else frame.setAttribute('tabindex', '-1');
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
    // A S1 preserva tempo e volume: só manda continuar.
    try { post('play'); } catch (error) { fallback(); }
  }
  function requestPlay() {
    if (pending) return;
    pending = true; sent = false; status.hidden = true;
    pauseButton.disabled = true; pauseButton.setAttribute('aria-busy', 'true');
    draw('resuming');
    timeout = setTimeout(fallback, 8000);
    sendPending();
  }
  function playing() {
    if (state === 'native') return;
    var focusedOverlay = pause.contains(document.activeElement);
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
  pauseButton.addEventListener('click', function () { requestPlay(); });
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
  window.addEventListener('pagehide', function () { clearTimeout(pauseTimer); });
  draw('initial');
})();
