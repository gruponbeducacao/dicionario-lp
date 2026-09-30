/**
 * O overlay de play/pausa da VSL cumpre o contrato do componente, e não repete
 * o que derrubou a LP em 19/09?
 *
 * O componente mora no site principal (`fluencia-contabil/assets/vsl-overlay.js`,
 * o mesmo da assinatura.html) e é carregado aqui por URL absoluta. Ele desiste
 * em silêncio se faltar `#heroVslOverlay`; e o que o torna seguro não está no
 * script, está no CSS desta página: `pointer-events: none`, para o clique
 * atravessar e cair no play do próprio Panda.
 *
 * O overlay de 19/09 (revertido no PR #4) cobria o player com botões próprios,
 * só saía quando o Panda confirmava um play mandado por postMessage, e entrou
 * junto com parâmetros novos no src do player. As guardas abaixo impedem que
 * qualquer um dos três volte sem que alguém perceba no PR.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

const inicioSlot = html.indexOf(html.match(/<div[^>]*id="heroVsl"[^>]*>/s)[0]);
const inicioOv = html.indexOf('id="heroVslOverlay"');
const blocoOv = html.slice(inicioOv, html.indexOf('<div class="vsl-trava-aviso"', inicioOv));
const regra = seletor => (css.match(new RegExp(`(?:^|})\\s*${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm')) || [])[1] ?? '';

test('o overlay existe dentro do slot, nasce oculto no estado de início e tem os três estados', () => {
  assert.ok(inicioOv > inicioSlot, 'faltou o #heroVslOverlay dentro do slot da VSL');
  const abre = html.slice(html.lastIndexOf('<div', inicioOv), html.indexOf('>', inicioOv) + 1);
  // Sem JS o overlay não pode aparecer: não haveria quem o tirasse da frente.
  assert.match(abre, /\bhidden\b/, 'o #heroVslOverlay tem de nascer hidden');
  assert.match(abre, /data-estado="inicio"/);
  for (const estado of ['vsl-ov-inicio', 'vsl-ov-pausa', 'vsl-ov-fim']) {
    assert.ok(blocoOv.includes(`class="${estado}"`), `faltou o estado .${estado}`);
  }
  assert.ok(blocoOv.includes('data-vsl-ov-tempo'), 'faltou o [data-vsl-ov-tempo] da pausa');
});

test('o overlay é só visual: o clique atravessa e cai no player do Panda', () => {
  assert.match(regra('.vsl-ov'), /pointer-events:\s*none/, 'o .vsl-ov perdeu o pointer-events: none');
  // Só os links para a oferta recebem clique. Botão próprio sobre o player é o
  // desenho de 19/09, que parou o play.
  assert.ok(!/<button\b/.test(blocoOv), 'botão dentro do overlay');
  for (const [a] of blocoOv.matchAll(/<a\b[^>]*>/g)) {
    assert.match(a, /href="#cta-final"/, `link do overlay fora da oferta: ${a}`);
    assert.match(a, /data-fc-vsl-cta/, `link do overlay sem data-fc-vsl-cta (o clique não seria medido): ${a}`);
  }
});

test('o player continua com o src cru do Panda, sem os parâmetros que entraram em 19/09', () => {
  const src = (html.match(/<iframe[^>]*id="heroVslFrame"[^>]*\ssrc="([^"]*)"/s) || [])[1];
  assert.match(src, /^https:\/\/player-[a-z0-9-]+\.tv\.pandavideo\.com\.br\/embed\/\?v=[0-9a-f-]{36}$/,
    'o src do player ganhou parâmetros (autoplay, muted, controls...): reveja o revert de 20/09 antes');
});

test('travada, o atalho da pausa e o botão do fim para a oferta saem de cena', () => {
  assert.match(css, /html\.vsl-trava \.vsl-ov-link\s*\{[^}]*display:\s*none/);
  // Pausado no último segundo, o overlay vai para "fim" com a página ainda travada.
  assert.match(css, /html\.vsl-trava \.vsl-ov-cta\s*\{[^}]*display:\s*none/);
});

test('a faixa de baixo é do Panda: nada de texto depois do play, e o fundo some antes dela', () => {
  // No celular a barra de progresso do Panda começa a 68 px da base do vídeo. Texto do overlay
  // ali (o "3 min · com legendas" de antes) é tocado por quem quer dar play e pula o vídeo.
  for (const [estado, prox] of [['vsl-ov-inicio', 'vsl-ov-pausa'], ['vsl-ov-pausa', 'vsl-ov-fim']]) {
    const bloco = blocoOv.slice(blocoOv.indexOf(`class="${estado}"`), blocoOv.indexOf(`class="${prox}"`));
    const depoisDoPlay = bloco.slice(bloco.indexOf('</span>', bloco.indexOf('vsl-ov-play')) + 7);
    assert.match(depoisDoPlay, /^\s*<\/div>\s*<div\s*$/, `.${estado}: há conteúdo depois do play`);
  }
  // O que só cabe em vídeo alto fica escondido por padrão e só volta por container query.
  assert.match(regra('.vsl-ov-titulo,.vsl-ov-pausa .vsl-ov-sub,.vsl-ov-fim .vsl-ov-baixo'), /display:\s*none/);
  assert.match(css, /--vsl-faixa:\s*\d+px/);
  for (const seletor of ['.vsl-ov', '.vsl-ov[data-estado="inicio"],.vsl-ov[data-estado="fim"]']) {
    assert.match(regra(seletor), /rgba\(14,22,38,0\) calc\(100% - var\(--vsl-faixa\)\)\)/,
      `${seletor}: o fundo escurece a faixa de controles do Panda`);
  }
  // Com 1fr puro, texto demais em cima empurraria o play para fora do botão do Panda.
  assert.match(regra('.vsl-ov > div'), /grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
});

test('a página carrega o overlay do site principal, com cache-buster e defer', () => {
  assert.match(
    html,
    /<script[^>]+src="https:\/\/fluenciacontabil\.com\.br\/assets\/vsl-overlay\.js\?v=[0-9a-z]+"[^>]*\bdefer\b/,
    'faltou o <script defer> do vsl-overlay.js, com cache-buster',
  );
});
