/**
 * A trava da página no vídeo cumpre o contrato do componente?
 *
 * O componente mora no site principal (`fluencia-contabil/assets/vsl-trava.js`,
 * o mesmo da assinatura.html) e é carregado aqui por URL absoluta. Como o
 * receptor vsl.js, ele é silencioso: sem `data-vsl-trava`, sem `#vslTrava` ou
 * com o id provisório do vídeo, ele simplesmente não trava, e a oferta fica
 * aberta para todos sem ninguém perceber. Do outro lado, se o CSS desta página
 * não esconder a oferta, a classe `vsl-trava` entra e nada some.
 *
 * Este arquivo repete aqui as guardas dele. Não importa o componente (o CI
 * deste repositório não enxerga o outro): a duplicação é intencional, como em
 * vsl-slot.test.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const slotTag = html.match(/<div[^>]*id="heroVsl"[^>]*>/s)[0];
const atributo = (tag, chave) => (tag.match(new RegExp(`${chave}="([^"]*)"`)) || [])[1] ?? null;
const mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
// O seletor inteiro, e não um pedaço dele: `#mainNavX` não esconde o #mainNav.
const regex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escondeNaTrava = seletor => new RegExp(`html\\.vsl-trava ${regex(seletor)}\\s*[,{]`).test(css);

// Filhos diretos do <body>, contando a profundidade das tags. Comentários e o
// conteúdo de <script>/<style> ficam de fora; elementos vazios não abrem nível.
function filhosDoBody() {
  const vazios = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const corpo = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/g, '<$1$2></$1>');
  const filhos = [];
  let nivel = 0;
  for (const [, fecha, tag, attrs] of corpo.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const nome = tag.toLowerCase();
    if (fecha) { nivel--; continue; }
    if (nivel === 0) filhos.push([nome, attrs]);
    if (!vazios.has(nome) && !attrs.endsWith('/')) nivel++;
  }
  return filhos;
}

test('a trava libera no pitch da VSL 1,25x (2:46 = 166 s), decisão de 30/09/2026', () => {
  // O Vinícius decidiu travar a oferta até a apresentação do Dicionário: o
  // Bloco 7 do roteiro ("Preço, garantia e o que não volta") começa em 2:46
  // na versão 1,25x (era 3:27 = 207 s na de 1x).
  const trava = Number(atributo(slotTag, 'data-vsl-trava'));
  const pitch = Number(atributo(slotTag, 'data-vsl-pitch'));
  const duracao = Number(atributo(slotTag, 'data-vsl-duration'));
  assert.equal(trava, 166);
  assert.equal(pitch, 166);
  assert.equal(duracao, 200.2);
  assert.equal(atributo(slotTag, 'data-vsl-version'), 'dicionario-125x-20260930');
  // Acima da duração o componente nunca liberaria por tempo assistido.
  assert.ok(trava > 0 && trava < duracao, 'data-vsl-trava fora do vídeo');
});

test('o aviso tem o markup que o componente procura, nasce oculto e o texto sem JS bate com o do script', () => {
  const aviso = html.match(/<div[^>]*id="vslTrava"[^>]*>[\s\S]*?data-vsl-trava-barra[\s\S]*?<\/div>/);
  assert.ok(aviso, 'faltou o #vslTrava com [data-vsl-trava-barra]');
  const abre = aviso[0].match(/<div[^>]*id="vslTrava"[^>]*>/)[0];
  // Sem `hidden`, o aviso apareceria para quem está sem JS, e ali a trava não existe.
  assert.match(abre, /\bhidden\b/, 'o #vslTrava tem de nascer hidden');
  const texto = (aviso[0].match(/data-vsl-trava-txt>([^<]+)</) || [])[1];
  const trava = Number(atributo(slotTag, 'data-vsl-trava'));
  // O script reescreve este texto; o estático é o que ele escreveria ao abrir.
  assert.equal(texto, `Assista mais ${mmss(trava)} para liberar a página`);
  // Na pré-trava o aviso ainda está hidden: ele já segura o espaço, e o vídeo não pula quando o componente assume.
  assert.match(css, /html\.vsl-trava \.vsl-trava-aviso\[hidden\]\s*\{[^}]*display:\s*block/);
});

test('a página carrega o componente do site principal na versão do PR #111, com defer', () => {
  // 20260930f: só abre a página sozinha com sinal de falha do player e lê o FC_VSL_PLAYER_OK do
  // trecho ouvinte. Uma versão anterior volta a abrir aos ~16 s para quem tem o player funcionando.
  assert.match(
    html,
    /<script[^>]+src="https:\/\/fluenciacontabil\.com\.br\/assets\/vsl-trava\.js\?v=20260930f"[^>]*\bdefer\b/,
    'faltou o <script defer> do vsl-trava.js?v=20260930f',
  );
});

// O trecho ouvinte do PR #111: marca FC_VSL_PLAYER_OK na 1ª mensagem do player, mesmo que o
// vsl-trava.js (defer, de outro domínio) ainda não tenha começado a ouvir.
const ouvinte = (html.match(/<script data-vsl-trava-ouvinte>([\s\S]*?)<\/script>/) || [])[1];

test('o trecho ouvinte vem antes do iframe do vídeo', () => {
  assert.ok(ouvinte, 'faltou o <script data-vsl-trava-ouvinte>');
  const iframe = html.search(/<iframe[^>]*id="heroVslFrame"/);
  assert.ok(iframe > 0 && html.indexOf('data-vsl-trava-ouvinte') < iframe,
    'o ouvinte tem de vir antes do <iframe id="heroVslFrame">: depois dele, o panda_ready pode passar antes');
});

test('o trecho ouvinte só aceita mensagem do próprio player do Panda', () => {
  const ORIGEM = 'https://player-vz-7867cfdb-be1.tv.pandavideo.com.br';
  const roda = ({ origem = ORIGEM, doFrame = true, data = { message: 'panda_ready' } } = {}) => {
    const ouvintes = {};
    const frame = { contentWindow: {} };
    const window = {
      addEventListener: (n, fn) => { ouvintes[n] = fn; },
      removeEventListener: (n, fn) => { if (ouvintes[n] === fn) delete ouvintes[n]; },
    };
    const document = { getElementById: id => (id === 'heroVslFrame' ? frame : null) };
    vm.runInContext(ouvinte, vm.createContext({ window, document }));
    ouvintes.message?.({ source: doFrame ? frame.contentWindow : {}, origin: origem, data });
    return { ok: window.FC_VSL_PLAYER_OK === true, saiu: !ouvintes.message };
  };
  assert.deepEqual(roda(), { ok: true, saiu: true });
  assert.equal(roda({ origem: 'https://evil.example' }).ok, false, 'aceitou outra origem');
  assert.equal(roda({ origem: 'https://player-x.tv.pandavideo.com.br.evil.example' }).ok, false, 'aceitou origem parecida');
  assert.equal(roda({ doFrame: false }).ok, false, 'aceitou mensagem de outra janela');
  assert.equal(roda({ data: 'panda_ready' }).ok, false, 'aceitou mensagem sem objeto');
});

test('travada, a página é só o palco do vídeo: tudo fora do hero some, inclusive a oferta', () => {
  for (const seletor of ['#topbar', '#mainNav', '.mobile-menu', 'body > section:not(#hero)', 'body > footer']) {
    assert.ok(escondeNaTrava(seletor), `o CSS não esconde ${seletor} na trava`);
  }
  // Tudo o que está no primeiro nível do <body> precisa ser coberto pelas regras
  // acima. Um bloco novo nesse nível (uma barra fixa de compra, por exemplo)
  // ficaria à vista com a página travada.
  const soltos = filhosDoBody()
    .filter(([tag]) => !['script', 'style', 'noscript'].includes(tag))
    .filter(([tag, attrs]) => !(tag === 'section' || tag === 'footer' ||
      /id="(topbar|mainNav)"/.test(attrs) || /class="mobile-menu"/.test(attrs)));
  assert.deepEqual(soltos.map(([tag, attrs]) => `<${tag}${attrs}>`), [], 'bloco de primeiro nível que a trava não esconde');
});

test('o hero não tem preço nem checkout: travada, nada de oferta fica à vista', () => {
  const inicio = html.indexOf('<section id="hero"');
  const hero = html.slice(inicio, html.indexOf('</section>', inicio));
  assert.ok(!hero.includes('pay.kiwify.com.br'), 'link de checkout dentro do hero');
  assert.ok(!/R\$/.test(hero), 'preço dentro do hero');
  // O botão e os selos do hero ("Pagamento único") também saem na trava.
  for (const seletor of ['#hero a.vsl-cta', '#hero .hero-trust', '#hero .hero-vsl-sub']) {
    assert.ok(escondeNaTrava(seletor), `o CSS não esconde ${seletor} na trava`);
  }
});

// O script inline que segura o vídeo na tela quando a trava libera.
function rolagem({ motivo = 'assistiu', topo = 514, altura = 362, tela = 768, preTravada = false, menu = 0, menuDepois = menu, recuo = 0 } = {}) {
  const fonte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    .find(s => s.includes('vsl_pagina_liberada'));
  assert.ok(fonte, 'faltou o script que segura o vídeo na tela ao liberar');
  const classes = new Set(preTravada ? ['vsl-trava'] : []);
  let observador = null, observado = null;
  const rolou = [], depois = [];
  const raiz = { classList: { contains: c => classes.has(c) } };
  const window = {
    innerHeight: tela, pageYOffset: 0, dataLayer: [],
    MutationObserver: class { constructor(fn) { observador = fn; } observe(alvo, opcoes) { observado = { alvo, opcoes }; } },
    // rolar move o vídeo na tela, como no navegador; a segunda conferida (setTimeout) roda no fim
    scrollTo: o => { rolou.push(o); window.pageYOffset = o.top; },
    setTimeout: fn => depois.push(fn),
  };
  // Só o iframe do vídeo tem retângulo: o slot (#heroVsl) mede outra coisa.
  // Depois da 1ª rolagem a página esconde a faixa dourada: o cabeçalho encolhe (menuDepois) e o conteúdo sobe (recuo).
  const y = () => topo - window.pageYOffset - (rolou.length ? recuo : 0);
  const frame = { getBoundingClientRect: () => ({ top: y(), bottom: y() + altura, height: altura }) };
  // O menu fixo (#mainNav) entra no cálculo quando está à vista; sem ele, o topo livre começa em 0.
  const nav = { getClientRects: () => [1], getBoundingClientRect: () => ({ top: 0, bottom: rolou.length ? menuDepois : menu }) };
  const document = { documentElement: raiz, getElementById: id => ({ heroVslFrame: frame, ...(menu ? { mainNav: nav } : {}) })[id] ?? null };
  vm.runInContext(fonte, vm.createContext({ window, document, Math }));
  // O observer tem de olhar a classe do <html>: com outro alvo ou outro atributo, nunca dispara no navegador.
  assert.ok(observador && observado, 'o script não instalou o observer (achou o #heroVslFrame?)');
  assert.equal(observado.alvo, raiz, 'o observer não observa o <html>');
  assert.ok(observado.opcoes.attributes !== false && [...(observado.opcoes.attributeFilter || [])].includes('class'),
    'o observer não observa o atributo class');
  if (!preTravada) { classes.add('vsl-trava'); observador(); }  // a trava entra (sem a pré-trava)
  classes.delete('vsl-trava');                                   // libera() tira a classe...
  if (motivo !== 'desistiu_sem_evento') window.dataLayer.push({ event: 'vsl_pagina_liberada', motivo }); // ...e avisa o dataLayer
  observador();
  depois.splice(0).forEach(fn => fn()); // a conferida de 350 ms: com o vídeo já no lugar, não rola de novo
  return JSON.parse(JSON.stringify(rolou)); // objetos do vm vêm de outro realm
}

test('liberou assistindo e o vídeo saiu da tela: a página rola até ele caber, centralizado', () => {
  // 1366×768: o vídeo passa de y=130 (travado) para y=514 com 362 px de altura, e a base sai da tela.
  assert.deepEqual(rolagem(), [{ top: 514 - (768 - 362) / 2, behavior: 'instant' }]);
});

test('não rola quando o vídeo já cabe nem quando a trava abriu por falha do player', () => {
  assert.deepEqual(rolagem({ topo: 375, altura: 197, tela: 844 }), []); // celular: continua inteiro
  assert.deepEqual(rolagem({ motivo: 'player_mudo' }), []);
  assert.deepEqual(rolagem({ motivo: 'erro_player' }), []);
  assert.deepEqual(rolagem({ motivo: 'player_travado' }), []);
});

test('o fim do vídeo (fim_do_video, PR #111) também segura o vídeo na tela', () => {
  assert.deepEqual(rolagem({ motivo: 'fim_do_video' }), [{ top: 514 - (768 - 362) / 2, behavior: 'instant' }]);
});

test('com a pré-trava do <head>, a classe já nasce no <html> e a rolagem continua valendo', () => {
  assert.deepEqual(rolagem({ preTravada: true }), [{ top: 514 - (768 - 362) / 2, behavior: 'instant' }]);
  assert.deepEqual(rolagem({ preTravada: true, motivo: 'desistiu_sem_evento' }), []);
});

// A pré-trava inline do <head>: põe a classe já no parse, com as exceções do componente, e desiste
// se ele não assumir. Roda numa VM com DOM falso; os prazos são chamados à mão.
function preTrava({ hash = '', search = '', ua = 'Mozilla/5.0 (iPhone)', liberada = false, slotOk = true } = {}) {
  const fonte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("'desistiu'"));
  assert.ok(fonte, 'faltou a pré-trava no <head>');
  assert.ok(html.indexOf(fonte) < html.indexOf('</head>'), 'a pré-trava tem de ficar no <head>');
  const classes = new Set(), ouvintes = {}, docOuvintes = {}, prazos = [];
  const versao = atributo(slotTag, 'data-vsl-version');
  const slot = { hidden: false, getAttribute: k => ({ 'data-vsl-trava': '166', 'data-vsl-version': slotOk ? versao : 'outra' })[k] ?? null };
  const frame = { getAttribute: k => (k === 'src' ? 'https://player-vz-x.tv.pandavideo.com.br/embed/?v=abc' : null) };
  const window = {
    location: { hash, search }, navigator: { userAgent: ua },
    localStorage: { getItem: k => (liberada && k === `fc_vsl_liberada:${versao}` ? '1' : null) },
    addEventListener: (n, fn) => { ouvintes[n] = fn; },
  };
  const document = {
    documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) } },
    getElementById: id => ({ heroVsl: slot, heroVslFrame: frame, vslTrava: {} })[id] ?? null,
    addEventListener: (n, fn) => { docOuvintes[n] = fn; },
  };
  const ctx = vm.createContext({ window, document, Number, setTimeout: (fn, ms) => prazos.push({ fn, ms }) });
  vm.runInContext(fonte, ctx);
  return {
    travada: () => classes.has('vsl-trava'), window,
    domPronto: () => docOuvintes.DOMContentLoaded?.(),
    carregou: () => ouvintes.load?.(),
    vencePrazos: () => prazos.splice(0).forEach(p => p.fn()),
    prazos: () => prazos.map(p => p.ms),
    scriptFalhou: src => ouvintes.error?.({ target: { tagName: 'SCRIPT', src } }),
    componenteAssume: () => { window.FC_VSL_TRAVA = true; },
  };
}

test('pré-trava: trava já no parse e sai do caminho quando o componente assume', () => {
  const r = preTrava();
  assert.equal(r.travada(), true);
  r.domPronto(); r.componenteAssume(); r.carregou(); r.vencePrazos();
  assert.equal(r.travada(), true);
  assert.equal(r.window.FC_VSL_TRAVA, true);
});

test('pré-trava: prazo só para componente ausente, nunca mais curto que o do próprio componente', () => {
  // O componente abre por player mudo aos 15 s de vida dele; a pré-trava não pode abrir antes disso,
  // e o prazo depois do load (4 s) só corre se o componente, que roda antes do DOMContentLoaded, faltou.
  const r = preTrava();
  r.carregou();
  const prazos = r.prazos();
  assert.ok(prazos.length >= 2, 'faltou prazo da pré-trava');
  assert.ok(Math.max(...prazos) >= 15000, 'teto absoluto da pré-trava abaixo de 15 s');
  assert.ok(Math.min(...prazos) >= 4000, 'prazo depois do load abaixo de 4 s');
});

test('pré-trava: componente que não chega (lento demais, 404 ou erro) não deixa a página trancada', () => {
  const lento = preTrava();
  lento.domPronto(); lento.carregou(); lento.vencePrazos();
  assert.equal(lento.travada(), false);
  // o componente, se chegar depois, vê 'desistiu' e não tranca por cima
  assert.equal(lento.window.FC_VSL_TRAVA, 'desistiu');
  const r404 = preTrava();
  r404.scriptFalhou('https://fluenciacontabil.com.br/assets/vsl-trava.js?v=20260930e');
  assert.equal(r404.travada(), false);
  const outro = preTrava();
  outro.scriptFalhou('https://fluenciacontabil.com.br/assets/vsl-overlay.js?v=20260929');
  assert.equal(outro.travada(), true, 'falha de outro script não mexe na trava');
  const invalido = preTrava({ slotOk: false });
  invalido.domPronto();
  assert.equal(invalido.travada(), false);
});

test('pré-trava: mesmas exceções do componente (âncora, ?semtrava=1, robô, quem já liberou)', () => {
  for (const opts of [{ hash: '#cta-final' }, { search: '?semtrava=1' }, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    { ua: 'Mozilla/5.0 HeadlessChrome/140' }, { liberada: true }]) {
    assert.equal(preTrava(opts).travada(), false, JSON.stringify(opts));
  }
});

test('sem JS a página é a de sempre: o <html> não nasce com a classe', () => {
  assert.doesNotMatch(html.match(/<html[^>]*>/)[0], /vsl-trava/);
});

test('a rolagem desconta o cabeçalho fixo; vídeo mais alto que o espaço encosta no cabeçalho', () => {
  // 1366×768 com o menu de 72 px: centraliza no espaço abaixo dele.
  assert.deepEqual(rolagem({ menu: 72 }), [{ top: 514 - 72 - (768 - 72 - 362) / 2, behavior: 'instant' }]);
  // celular deitado (844×390): 362 px de vídeo não cabem nos 318 px livres; o topo fica logo abaixo do menu.
  assert.deepEqual(rolagem({ menu: 72, topo: 514, altura: 362, tela: 390 }), [{ top: 514 - 72, behavior: 'instant' }]);
  // a faixa dourada some com a rolagem (cabeçalho 102 -> 72 px, conteúdo sobe 38 px): a conferida
  // de 350 ms leva o topo do vídeo de volta ao pé do menu.
  assert.deepEqual(rolagem({ menu: 102, menuDepois: 72, recuo: 38, topo: 514, altura: 362, tela: 390 }),
    [{ top: 514 - 102, behavior: 'instant' }, { top: 514 - 102 + (514 - 412 - 38) - 72, behavior: 'instant' }]);
  // já inteiro e abaixo do menu: não mexe.
  assert.deepEqual(rolagem({ menu: 64, topo: 375, altura: 197, tela: 844 }), []);
});
