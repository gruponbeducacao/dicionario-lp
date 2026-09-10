/**
 * O slot da VSL cumpre o contrato do receptor?
 *
 * O receptor mora no site principal (`fluencia-contabil/assets/vsl.js`) e é
 * carregado aqui por URL absoluta. Ele é DELIBERADAMENTE silencioso: se faltar
 * um id, um atributo ou o CTA estiver fora do slot, ele simplesmente não
 * instala e nenhum marco é medido — sem erro no console, sem nada quebrado na
 * página. Foi assim que a VSL ficou de 03/09 a 10/09 no ar sem medir um play
 * sequer.
 *
 * Este arquivo repete aqui as guardas dele. Não importa o receptor (o CI deste
 * repositório não enxerga o outro): a duplicação é intencional e é o preço de
 * detectar, no PR, a edição de HTML que apagaria a medição em silêncio.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const slotTag = html.match(/<div[^>]*id="heroVsl"[^>]*>/s);
const frameTag = html.match(/<iframe[^>]*id="heroVslFrame"[^>]*>/s);
const atributo = (tag, chave) => (tag.match(new RegExp(`${chave}="([^"]*)"`)) || [])[1] ?? null;

test('o slot e o iframe existem com os ids que o receptor procura', () => {
  assert.ok(slotTag, 'faltou o elemento id="heroVsl"');
  assert.ok(frameTag, 'faltou o iframe id="heroVslFrame"');
  assert.ok(!/\bhidden\b/.test(slotTag[0]), 'o slot está hidden: o receptor não instala');
});

test('o endereço do vídeo é https e de uma biblioteca do Panda, com o parâmetro v', () => {
  const src = atributo(frameTag[0], 'src') || atributo(frameTag[0], 'data-src');
  assert.ok(src, 'o iframe não tem src nem data-src');
  const url = new URL(src);
  assert.equal(url.protocol, 'https:');
  assert.match(url.hostname, /^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/);
  assert.ok(url.searchParams.get('v'), 'o endereço não traz o id do vídeo em ?v=');
  assert.ok(!src.includes('__PANDA_ID__'), 'o id do vídeo continua com o placeholder');
});

test('versão, duração e pitch estão preenchidos e são coerentes', () => {
  const versao = atributo(slotTag[0], 'data-vsl-version');
  const duracao = Number(atributo(slotTag[0], 'data-vsl-duration'));
  const pitch = Number(atributo(slotTag[0], 'data-vsl-pitch'));

  assert.ok(versao, 'data-vsl-version vazio: o receptor trata como gravação não configurada');
  assert.ok(Number.isFinite(duracao) && duracao > 0, 'data-vsl-duration inválida');
  // O pitch é a posição da oferta DENTRO do vídeo. Fora desse intervalo o
  // receptor recusa instalar — inclusive quando alguém troca o vídeo por um
  // mais curto e esquece de rever o pitch.
  assert.ok(Number.isFinite(pitch) && pitch > 0 && pitch < duracao, 'data-vsl-pitch fora do vídeo');
});

test('o CTA marcado está DENTRO do slot, senão o clique não é contado', () => {
  // O receptor exige `slot.contains(botao)`. Um CTA marcado fora do slot passa
  // despercebido: o atributo está lá, e o evento nunca sai.
  const inicio = html.indexOf(slotTag[0]);
  const fim = html.indexOf('</div>', html.indexOf('hero-trust', inicio));
  const dentro = html.slice(inicio, fim);
  assert.ok(dentro.includes('data-fc-vsl-cta'), 'nenhum CTA com data-fc-vsl-cta dentro do slot');
});

test('a página carrega o receptor do site principal', () => {
  assert.match(
    html,
    /<script[^>]+src="https:\/\/fluenciacontabil\.com\.br\/assets\/vsl\.js\?v=\d+"[^>]*\bdefer\b/,
    'faltou o <script defer> do vsl.js, com cache-buster',
  );
});

test('a oferta é declarada, e não é a da assinatura', () => {
  // Sem `data-vsl-content` o receptor assume `assinatura_2026`, e os marcos
  // desta página se misturariam aos da outra na mesma conversão da Meta.
  const conteudo = atributo(slotTag[0], 'data-vsl-content');
  assert.ok(conteudo, 'data-vsl-content ausente: os marcos sairiam como assinatura_2026');
  assert.notEqual(conteudo, 'assinatura_2026');
});
