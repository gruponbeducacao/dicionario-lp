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

test('a página carrega o componente do site principal, com cache-buster e defer', () => {
  assert.match(
    html,
    /<script[^>]+src="https:\/\/fluenciacontabil\.com\.br\/assets\/vsl-trava\.js\?v=[0-9a-z]+"[^>]*\bdefer\b/,
    'faltou o <script defer> do vsl-trava.js, com cache-buster',
  );
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
function rolagem({ motivo = 'assistiu', topo = 514, altura = 362, tela = 768, preTravada = false } = {}) {
  const fonte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    .find(s => s.includes('vsl_pagina_liberada'));
  assert.ok(fonte, 'faltou o script que segura o vídeo na tela ao liberar');
  const classes = new Set(preTravada ? ['vsl-trava'] : []);
  let observador = null, observado = null;
  const rolou = [];
  const raiz = { classList: { contains: c => classes.has(c) } };
  const window = {
    innerHeight: tela, pageYOffset: 0, dataLayer: [],
    MutationObserver: class { constructor(fn) { observador = fn; } observe(alvo, opcoes) { observado = { alvo, opcoes }; } },
    scrollTo: o => rolou.push(o),
  };
  // Só o iframe do vídeo tem retângulo: o slot (#heroVsl) mede outra coisa.
  const frame = { getBoundingClientRect: () => ({ top: topo, bottom: topo + altura, height: altura }) };
  const document = { documentElement: raiz, getElementById: id => (id === 'heroVslFrame' ? frame : null) };
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
