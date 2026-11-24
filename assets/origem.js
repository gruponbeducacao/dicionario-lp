/* Fluência Contábil — origem.js
   Preserva a origem na sessão, entre páginas públicas e até a Kiwify.
   O GTM continua sendo o único emissor de tags: checkout_click é intenção
   de compra (ClicouComprar), não InitiateCheckout nem Purchase.
   Não grava cookies nem chama serviços externos. Falha de storage/pixel
   não pode impedir a navegação.
   Desde 24/11/2026 também guarda o primeiro e o último toque da pessoa
   (localStorage `fc_toques`, 90 dias) para os formulários de captura. Isso
   não muda nada no checkout: a Kiwify continua recebendo a origem da sessão. */
(function () {
  'use strict';

  if (window.FC_ORIGEM && window.FC_ORIGEM.instalada) return;
  var CHAVE = 'fc_origem';
  var VERSAO = 'origem-js-2026-11-24';
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

  /* ---------- Primeiro e último toque (contrato de 24/11/2026) ----------
     Toque = chegada com parâmetro de campanha OU com referrer de domínio de
     fora da marca. Visita direta não cria toque. O primeiro só é trocado
     quando o registro expira (90 dias sem toque novo); o último é sempre o
     mais recente. Fica só neste navegador (localStorage, nunca cookie) e só
     sai daqui no corpo dos formulários de captura. Não alimenta o checkout. */
  var CHAVE_TOQUES = 'fc_toques';
  var VALIDADE_TOQUES = 90 * 24 * 60 * 60 * 1000;
  var LIMITE_VALOR = 300;
  var DE_CAMPANHA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                     'src', 'fbclid', 'gclid'];
  // Domínios da marca e do checkout (e seus subdomínios): referrer daqui é
  // navegação interna, não toque.
  var DA_CASA = ['fluenciacontabil.com.br', 'kiwify.com.br'];

  // Valor longo é descartado, não truncado. E-mail nunca entra como origem.
  function valorLimpo(v) {
    if (typeof v !== 'string' || !v || v.length > LIMITE_VALOR) return '';
    if (/[^\s@\/?&=]+@[^\s@\/?&=]+\.[a-z]{2,}/i.test(v.replace(/%40/gi, '@'))) return '';
    return v;
  }

  function daCasa(host) {
    host = String(host || '').toLowerCase();
    if (!host || host === String(window.location.hostname || '').toLowerCase()) return true;
    for (var i = 0; i < DA_CASA.length; i++) {
      var d = DA_CASA[i];
      if (host === d || host.slice(-(d.length + 1)) === '.' + d) return true;
    }
    return false;
  }

  // Só host + caminho: sem query, sem fragmento, sem porta.
  function hostCaminho(u) {
    return valorLimpo(String(u.hostname || '').toLowerCase() + (u.pathname || ''));
  }

  function referrerExterno() {
    try {
      if (!document.referrer) return null;
      var u = new URL(document.referrer);
      // android-app:// é o que apps como Instagram e Gmail mandam no Android.
      if (['http:', 'https:', 'android-app:'].indexOf(u.protocol) === -1) return null;
      if (daCasa(u.hostname)) return null;
      return { valor: hostCaminho(u) };
    } catch (e) { return null; }
  }

  function toqueDestaVisita(agora) {
    var t = { em: agora, pagina: '', referrer: '' };
    var temCampanha = false;
    try {
      var p = new URLSearchParams(window.location.search);
      DE_CAMPANHA.forEach(function (k) {
        var v = p.get(k);
        if (v) temCampanha = true;
        t[k] = valorLimpo(v);
      });
    } catch (e) {}
    var ref = referrerExterno();
    if (!temCampanha && !ref) return null;
    t.referrer = ref ? ref.valor : '';
    try { t.pagina = hostCaminho(window.location); } catch (e) {}
    return t;
  }

  function toqueValido(t, agora) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
    // Relógio adiantado em mais de um dia invalida o registro em vez de
    // impedir que ele expire.
    if (typeof t.em !== 'number' || !isFinite(t.em) || t.em <= 0 || t.em > agora + 86400000) return null;
    var limpo = { em: t.em };
    ['pagina', 'referrer'].concat(DE_CAMPANHA).forEach(function (k) { limpo[k] = valorLimpo(t[k]); });
    return limpo;
  }

  function registroValido(bruto, agora) {
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
    var primeiro = toqueValido(bruto.primeiro, agora);
    var ultimo = toqueValido(bruto.ultimo, agora);
    if (!primeiro || !ultimo || primeiro.em > ultimo.em) return null;
    if (agora - ultimo.em > VALIDADE_TOQUES) return null;
    return { v: 1, primeiro: primeiro, ultimo: ultimo };
  }

  function lerToques(agora) {
    try {
      return registroValido(JSON.parse(window.localStorage.getItem(CHAVE_TOQUES) || 'null'), agora);
    } catch (e) { return null; }
  }

  // Cópia em memória: com o storage bloqueado, ao menos o toque desta página
  // chega ao formulário.
  var toquesDaPagina = null;
  try {
    var agoraToques = Date.now();
    toquesDaPagina = lerToques(agoraToques);
    var novoToque = toqueDestaVisita(agoraToques);
    if (novoToque) {
      toquesDaPagina = { v: 1, primeiro: toquesDaPagina ? toquesDaPagina.primeiro : novoToque, ultimo: novoToque };
      try { window.localStorage.setItem(CHAVE_TOQUES, JSON.stringify(toquesDaPagina)); } catch (e) {}
    } else if (!toquesDaPagina) {
      // Expirado ou ilegível: descarta os dois.
      try { window.localStorage.removeItem(CHAVE_TOQUES); } catch (e) {}
    }
  } catch (e) { toquesDaPagina = null; }

  function emIso(ms) {
    try { return new Date(ms).toISOString(); } catch (e) { return ''; }
  }

  // Objeto plano com os campos do contrato, todos string ('' quando não há).
  function camposDoLead() {
    var c = {
      pt_source: '', pt_medium: '', pt_campaign: '', pt_content: '', pt_term: '', pt_src: '',
      pt_pagina: '', pt_referrer: '', pt_em: '', entrada: '', ut_em: '', fbclid: '', gclid: ''
    };
    try {
      var agora = Date.now();
      var t = lerToques(agora) || registroValido(toquesDaPagina, agora);
      if (!t) return c;
      var p = t.primeiro, u = t.ultimo;
      c.pt_source = p.utm_source; c.pt_medium = p.utm_medium; c.pt_campaign = p.utm_campaign;
      c.pt_content = p.utm_content; c.pt_term = p.utm_term; c.pt_src = p.src;
      c.pt_pagina = p.pagina; c.pt_referrer = p.referrer; c.pt_em = emIso(p.em);
      c.entrada = u.pagina; c.ut_em = emIso(u.em); c.fbclid = u.fbclid; c.gclid = u.gclid;
    } catch (e) {}
    return c;
  }

  // Acrescenta os campos ao corpo do POST (URLSearchParams, FormData ou
  // objeto) sem sobrescrever nada que o formulário já mande.
  function anexarCamposDoLead(corpo) {
    try {
      var c = camposDoLead();
      Object.keys(c).forEach(function (k) {
        if (corpo && typeof corpo.append === 'function' && typeof corpo.has === 'function') {
          if (!corpo.has(k)) corpo.append(k, c[k]);
        } else if (corpo && typeof corpo === 'object' && !Object.prototype.hasOwnProperty.call(corpo, k)) {
          corpo[k] = c[k];
        }
      });
    } catch (e) {}
    return corpo;
  }

  // Mesmo contexto que assets/email-capture.js manda (página, referrer,
  // utm_* e src da sessão, dispositivo) mais os campos de toque. Para os
  // formulários que não passam por ele, como a newsletter dos posts.
  function contextoDoLead() {
    var c = {};
    try { c.pagina = window.location.pathname + window.location.search; } catch (e) {}
    try { c.referrer = document.referrer || ''; } catch (e) {}
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src'].forEach(function (k) {
      c[k] = typeof origem[k] === 'string' ? origem[k] : '';
    });
    try { c.dispositivo = window.matchMedia('(max-width: 720px)').matches ? 'Mobile' : 'Desktop'; } catch (e) {}
    return anexarCamposDoLead(c);
  }

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
  window.FC_ORIGEM = {
    origem: origem, versao: VERSAO, instalada: true,
    camposDoLead: camposDoLead, anexarCamposDoLead: anexarCamposDoLead, contextoDoLead: contextoDoLead
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aoCarregar, { once: true });
  else aoCarregar();
})();
