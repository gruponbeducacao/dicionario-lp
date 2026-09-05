/* Fluência Contábil — origem.js
   A origem da visita vai até o checkout da Kiwify, em toda página do site.

   POR QUE EXISTE
   Até 05/09/2026, 45 das 62 vendas chegavam no Gestão sem etiqueta. Não era
   falta de anúncio etiquetado: era o site apagando a etiqueta no caminho.
   cursos.html e assinatura.html têm o link do checkout com utm_campaign fixo
   ("pos_janela_2026") e não herdavam nada da URL de entrada — todo e-mail,
   WhatsApp e link da bio que apontava para elas chegava à Kiwify carimbado
   como orgânico. As LPs herdavam, mas cada uma com o próprio script, em dois
   dialetos. Este arquivo é o único lugar em que isso acontece agora.

   AS REGRAS, e o porquê de cada uma
   · A URL de entrada vence o que está fixo no HTML: é ela que diz de onde a
     pessoa veio. Sem parâmetro de entrada, nada muda — o orgânico continua
     utm_source=site e a Kiwify não ganha um degrau artificial no histórico.
   · A origem fica guardada na sessão (sessionStorage). A pessoa navega entre
     páginas, volta por um link interno, e a query string se perde no caminho;
     a origem dela não mudou. Uma URL nova com parâmetro sobrescreve: se ela
     voltou por outro anúncio, é o novo que vale.
   · O utm_content do HTML é a POSIÇÃO do botão (hero, oferta, sticky, faq…):
     é a única forma de saber QUAL botão converteu. Ele fica. O utm_content
     que vier do anúncio (o criativo) vai para utm_term, quando utm_term
     estiver vazio — assim os dois convivem.
   · Os cookies da Meta (_fbp e _fbc) vão para a Kiwify em s1 e s2, e a página
     em s3. A Kiwify devolve os três no webhook, e é com eles que o servidor
     manda a compra de volta para a Meta com o mesmo navegador que clicou no
     anúncio. Sem isso o casamento é só por e-mail, e a Meta perde a venda de
     quem comprou com outro e-mail ou pagou o pix mais tarde.
   · Reescreve no carregamento E no clique. No carregamento, para quem copia o
     link ou abre em outra aba. No clique, porque o _fbp só existe depois de o
     GTM carregar o pixel, e em 3G isso passa de 10 segundos.
   · Cada clique num link do checkout empurra `checkout_click` no dataLayer,
     com a posição. É o GTM que transforma isso em evento da Meta
     (ClicouComprar). Nenhum fbq é chamado daqui: evento da Meta só nasce no
     container, senão o mesmo clique conta duas vezes — foi assim que 6 vendas
     viraram "21 checkouts iniciados".

   O que NÃO faz: não chama fbq, não chama gtag, não decide grupo de lead.
   Tudo em try/catch: um bloqueador de anúncio não pode derrubar o link. */
(function () {
  'use strict';

  var CHAVE = 'fc_origem';
  var VERSAO = 'origem-js-2026-09-05';
  // O que se guarda da URL de entrada. utm_content entra na lista porque o
  // criativo do anúncio importa — mas ele não sobrescreve a posição (ver
  // reescrever()).
  var GUARDAR = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                 'src', 'sck', 'fbclid', 'gclid'];
  // Estes vão direto para o link, por cima do que está fixo no HTML.
  var HERDA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'src', 'sck', 'fbclid', 'gclid'];

  function daUrl() {
    var fora = {};
    try {
      var p = new URLSearchParams(window.location.search);
      GUARDAR.forEach(function (k) { var v = p.get(k); if (v) fora[k] = v; });
    } catch (e) {}
    return fora;
  }

  function guardada() {
    try { return JSON.parse(sessionStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; }
  }

  function cookie(nome) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + nome + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  // O _fbc só é gravado pelo pixel quando a página carrega com fbclid E o
  // pixel já subiu. Se o fbclid está aqui e o cookie não, monta-se o valor no
  // formato que a Meta documenta (fb.1.<ms>.<fbclid>): é o mesmo que o pixel
  // gravaria, e é o que fecha a atribuição do clique no anúncio.
  function fbc(origem) {
    var c = cookie('_fbc');
    if (c) return c;
    if (origem.fbclid) return 'fb.1.' + Date.now() + '.' + origem.fbclid;
    return '';
  }

  var origem = daUrl();
  if (Object.keys(origem).length) {
    try { sessionStorage.setItem(CHAVE, JSON.stringify(origem)); } catch (e) {}
  } else {
    origem = guardada();
  }

  function reescrever(a) {
    try {
      var u = new URL(a.href);
      HERDA.forEach(function (k) { if (origem[k]) u.searchParams.set(k, origem[k]); });

      // Posição do botão fica; criativo do anúncio vai para utm_term se houver
      // espaço. Um link sem utm_content nenhum (como o do Dicionário) recebe
      // o do anúncio, porque aí não há posição a preservar.
      if (origem.utm_content) {
        if (!u.searchParams.get('utm_content')) {
          u.searchParams.set('utm_content', origem.utm_content);
        } else if (!origem.utm_term && !u.searchParams.get('utm_term')) {
          u.searchParams.set('utm_term', origem.utm_content);
        }
      }

      var fbp = cookie('_fbp');
      var fbcValor = fbc(origem);
      if (fbp) u.searchParams.set('s1', fbp);
      if (fbcValor) u.searchParams.set('s2', fbcValor);
      u.searchParams.set('s3', window.location.pathname);

      a.href = u.toString();
    } catch (e) {}
  }

  function links() {
    return document.querySelectorAll('a[href*="pay.kiwify.com.br"]');
  }

  function reescreverTodos() {
    links().forEach(reescrever);
  }

  // A posição do botão, na ordem em que as páginas a declaram: data-fc-local
  // (LPs), data-cta (Dicionário), utm_content do próprio href (cursos.html).
  function posicao(a) {
    try {
      return a.getAttribute('data-fc-local')
        || a.getAttribute('data-cta')
        || new URL(a.href).searchParams.get('utm_content')
        || '';
    } catch (e) { return ''; }
  }

  function aoCarregar() {
    reescreverTodos();

    // O pixel grava o _fbp depois de o GTM carregar. Reavalia por até 30 s;
    // quem clicar antes disso é coberto pela reescrita no clique.
    var tentativas = 0;
    var espera = setInterval(function () {
      if (cookie('_fbp')) { clearInterval(espera); reescreverTodos(); }
      else if (++tentativas > 120) { clearInterval(espera); }
    }, 250);

    // Captura na fase de captura: roda antes de qualquer handler do botão e
    // antes de o navegador ler o href.
    document.addEventListener('click', function (ev) {
      try {
        var alvo = ev.target && ev.target.closest ? ev.target.closest('a[href*="pay.kiwify.com.br"]') : null;
        if (!alvo) return;
        reescrever(alvo);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'checkout_click',
          cta_location: posicao(alvo),
          pagina: window.location.pathname
        });
      } catch (e) {}
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aoCarregar);
  } else {
    aoCarregar();
  }

  // Para conferência no console: FC_ORIGEM.origem, FC_ORIGEM.versao.
  try { window.FC_ORIGEM = { origem: origem, versao: VERSAO }; } catch (e) {}
})();
