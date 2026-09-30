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
