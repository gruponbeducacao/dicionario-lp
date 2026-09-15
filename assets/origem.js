/* Fluência Contábil — origem.js
   Preserva a origem na sessão, entre páginas públicas e até a Kiwify.
   O GTM continua sendo o único emissor de tags: checkout_click é intenção
   de compra (ClicouComprar), não InitiateCheckout nem Purchase.
   Não grava cookies nem chama serviços externos. Falha de storage/pixel
   não pode impedir a navegação. */
(function () {
  'use strict';

  if (window.FC_ORIGEM && window.FC_ORIGEM.instalada) return;
  var CHAVE = 'fc_origem';
  var VERSAO = 'origem-js-2026-09-09';
  var GUARDAR = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                 'src', 'sck', 'fbclid', 'gclid'];
  var HERDA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'src', 'sck', 'fbclid', 'gclid'];
  var PUBLICOS = ['fluenciacontabil.com.br', 'www.fluenciacontabil.com.br', 'dicionario.fluenciacontabil.com.br'];

  function daUrl() {
    var fora = {};
    try {
      var p = new URLSearchParams(window.location.search);
      GUARDAR.forEach(function (k) { var v = p.get(k); if (v) fora[k] = v; });
    } catch (e) {}
    return fora;
  }

  function guardada() {
    try {
      var valor = JSON.parse(sessionStorage.getItem(CHAVE) || '{}');
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
      var fora = {};
      GUARDAR.forEach(function (k) { if (typeof valor[k] === 'string' && valor[k]) fora[k] = valor[k]; });
      if (typeof valor.fbclidEm === 'number' && isFinite(valor.fbclidEm) && valor.fbclidEm > 0 && valor.fbclidEm <= Date.now()) {
        fora.fbclidEm = valor.fbclidEm;
      }
      return fora;
    } catch (e) { return {}; }
  }

  function cookie(nome) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + nome + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  var anterior = guardada();
  var entrada = daUrl();
  var origem = Object.keys(entrada).length ? entrada : anterior;
  // creationTime representa quando este clique foi observado, não cada
  // reescrita do link. Mantém o instante entre botões e páginas da sessão.
  if (origem.fbclid) {
    origem.fbclidEm = origem.fbclid === anterior.fbclid && anterior.fbclidEm
      ? anterior.fbclidEm : Date.now();
  }
  try { sessionStorage.setItem(CHAVE, JSON.stringify(origem)); } catch (e) {}

  function fbc() {
    var c = cookie('_fbc');
    var partes = /^fb\.\d+\.\d+\.(.+)$/.exec(c);
    // Cookie de outro clique não pode encobrir um fbclid recebido agora.
    // Preserva também o sufixo que bibliotecas oficiais podem acrescentar.
    if (partes && (!origem.fbclid || partes[1] === origem.fbclid || partes[1].indexOf(origem.fbclid + '.') === 0)) return c;
    return origem.fbclid ? 'fb.1.' + origem.fbclidEm + '.' + origem.fbclid : '';
  }

  function destino(a) {
    try {
      var u = new URL(a.href, window.location.href);
      if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
      if (u.hostname === 'pay.kiwify.com.br') return { url: u, checkout: true };
      // sessionStorage não atravessa domínios. Leva os parâmetros da origem
      // para o outro site público da marca, sem copiar cookies para a página.
      if (PUBLICOS.indexOf(u.hostname) !== -1 && u.hostname !== window.location.hostname) {
        return { url: u, checkout: false };
      }
    } catch (e) {}
    return null;
  }

  function reescrever(a) {
    var alvo = destino(a);
    if (!alvo) return false;
    try {
      var u = alvo.url;
      (alvo.checkout ? HERDA : GUARDAR).forEach(function (k) {
        if (origem[k]) u.searchParams.set(k, origem[k]);
      });
      if (alvo.checkout) {
        // Posição do botão fica em utm_content; criativo recebido vai para
        // utm_term quando este ainda não existe. Nunca troca produto/oferta.
        if (origem.utm_content) {
          if (!u.searchParams.get('utm_content')) u.searchParams.set('utm_content', origem.utm_content);
          else if (!origem.utm_term && !u.searchParams.get('utm_term')) u.searchParams.set('utm_term', origem.utm_content);
        }
        var fbp = cookie('_fbp');
        var fbcValor = fbc();
        if (fbp) u.searchParams.set('s1', fbp);
        if (fbcValor) u.searchParams.set('s2', fbcValor);
        u.searchParams.set('s3', window.location.host + window.location.pathname);
      }
      a.href = u.toString();
      return alvo.checkout;
    } catch (e) { return false; }
  }

  function reescreverTodos() {
    document.querySelectorAll('a[href]').forEach(reescrever);
  }

  function posicao(a) {
    try {
      return a.getAttribute('data-fc-local') || a.getAttribute('data-cta')
        || new URL(a.href).searchParams.get('utm_content') || '';
    } catch (e) { return ''; }
  }

  function aoClique(ev) {
    try {
      if (ev.type === 'auxclick' ? ev.button !== 1 : ev.button !== undefined && ev.button !== 0) return;
      var alvo = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!alvo || !reescrever(alvo)) return;
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'checkout_click', cta_location: posicao(alvo), pagina: window.location.pathname });
    } catch (e) {}
  }

  var iniciou = false;
  function aoCarregar() {
    if (iniciou) return;
    iniciou = true;
    reescreverTodos();
    // Só espera pelo cookie se a página tiver checkout. Os links novos são
    // cobertos pelo listener delegado, que também atualiza cookies tardios.
    if (Array.prototype.some.call(document.querySelectorAll('a[href]'), function (a) {
      var d = destino(a); return d && d.checkout;
    })) {
      var tentativas = 0;
      var espera = setInterval(function () {
        if (cookie('_fbp')) { clearInterval(espera); reescreverTodos(); }
        else if (++tentativas > 120) clearInterval(espera);
      }, 250);
    }
    document.addEventListener('click', aoClique, true);
    document.addEventListener('auxclick', aoClique, true);
  }

  // Marcador único evita listeners, temporizadores e eventos duplicados
  // mesmo se o asset entrar duas vezes antes de DOMContentLoaded.
  window.FC_ORIGEM = { origem: origem, versao: VERSAO, instalada: true };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aoCarregar, { once: true });
  else aoCarregar();
})();
