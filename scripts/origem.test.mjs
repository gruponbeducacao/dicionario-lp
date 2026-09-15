import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonte = readFileSync(new URL('../assets/origem.js', import.meta.url), 'utf8');
const INSTANTE = 1788955200000;
const checkout = 'https://pay.kiwify.com.br/oferta-sintetica?utm_source=site&utm_content=oferta';
function ensaio({ url = 'https://fluenciacontabil.com.br/cursos.html', hrefs = [checkout], storage = new Map(), cookie = '', bloqueado = false, carregando = false, agoraInicial = INSTANTE } = {}) {
  let agora = agoraInicial;
  const listeners = new Map();
  const timers = new Map();
  const links = hrefs.map((href) => ({ href, getAttribute: () => null }));
  const document = {
    cookie,
    readyState: carregando ? 'loading' : 'complete',
    querySelectorAll: () => links,
    addEventListener(tipo, fn) {
      listeners.set(tipo, [...(listeners.get(tipo) || []), fn]);
    },
  };
  const window = { location: new URL(url), dataLayer: [] };
  const contexto = vm.createContext({
    window, document, URL, URLSearchParams,
    Date: class extends Date { static now() { return agora; } },
    sessionStorage: {
      getItem(k) { if (bloqueado) throw Error('Storage bloqueado'); return storage.get(k) || null; },
      setItem(k, v) { if (bloqueado) throw Error('Storage bloqueado'); storage.set(k, v); },
    },
    setInterval(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
  });
  const carregar = () => vm.runInContext(fonte, contexto, { timeout: 100 });
  const emitir = (tipo, ev = {}) => {
    for (const fn of listeners.get(tipo) || []) fn({ type: tipo, ...ev });
  };
  carregar();
  return {
    window, document, links, storage, timers, carregar,
    tempo(ms) { agora += ms; },
    pronto() { emitir('DOMContentLoaded'); },
    clicar(i = 0, tipo = 'click', button = 0) {
      let bloqueou = false;
      emitir(tipo, { button, target: { closest: () => links[i] }, preventDefault() { bloqueou = true; } });
      assert.equal(bloqueou, false, 'atribuição não deve bloquear navegação');
    },
    parametros(i = 0) { return new URL(links[i].href).searchParams; },
  };
}

test('a origem acompanha entrada sem checkout, navegação interna e compra', () => {
  const storage = new Map();
  const blog = ensaio({ url: 'https://fluenciacontabil.com.br/blog/aula.html?utm_source=anuncio&utm_campaign=turma&fbclid=clique_sintetico&utm_content=criativo', hrefs: [], storage });
  assert.equal(blog.timers.size, 0);
  const cursos = ensaio({ storage });
  assert.equal(cursos.parametros().get('utm_source'), 'anuncio');
  assert.equal(cursos.parametros().get('utm_campaign'), 'turma');
  assert.equal(cursos.parametros().get('utm_content'), 'oferta');
  assert.equal(cursos.parametros().get('utm_term'), 'criativo');
  assert.equal(cursos.parametros().get('s3'), 'fluenciacontabil.com.br/cursos.html');
});

test('o mesmo fbclid mantém creationTime entre botões, reescritas e páginas', () => {
  const a = ensaio({ url: 'https://fluenciacontabil.com.br/?fbclid=clique_sintetico', hrefs: [checkout, checkout] });
  const esperado = `fb.1.${INSTANTE}.clique_sintetico`;
  assert.equal(a.parametros().get('s2'), esperado);
  a.tempo(10000);
  a.clicar(1);
  assert.equal(a.parametros(1).get('s2'), esperado);
  a.tempo(10000);
  a.clicar(0);
  assert.equal(a.parametros().get('s2'), esperado);
  const b = ensaio({ storage: a.storage, agoraInicial: INSTANTE + 60000 });
  b.tempo(10000);
  b.clicar();
  assert.equal(b.parametros().get('s2'), esperado);
});

test('cookie de outro clique não sobrescreve o fbclid novo; cookie correspondente é preservado', () => {
  const e = ensaio({ url: 'https://fluenciacontabil.com.br/?fbclid=novo', cookie: `_fbc=fb.1.${INSTANTE - 1000}.antigo` });
  assert.equal(e.parametros().get('s2'), `fb.1.${INSTANTE}.novo`);
  e.document.cookie = `_fbp=fb.1.${INSTANTE}.navegador;_fbc=fb.2.${INSTANTE - 500}.novo.sufixo`;
  e.clicar();
  assert.equal(e.parametros().get('s2'), `fb.2.${INSTANTE - 500}.novo.sufixo`);
  assert.equal(e.parametros().get('s1'), `fb.1.${INSTANTE}.navegador`);
});

test('sem fbclid ou cookie não fabrica identificador; cookie válido continua utilizável', () => {
  assert.equal(ensaio().parametros().get('s2'), null);
  assert.equal(ensaio({ cookie: '_fbc=invalido' }).parametros().get('s2'), null);
  const valor = `fb.1.${INSTANTE}.cookie_sintetico`;
  assert.equal(ensaio({ cookie: `_fbc=${valor}` }).parametros().get('s2'), valor);
});

test('nova campanha substitui a origem anterior sem misturar os parâmetros', () => {
  const a = ensaio({ url: 'https://fluenciacontabil.com.br/?utm_source=meta&utm_campaign=antiga&fbclid=antigo' });
  const b = ensaio({ url: 'https://fluenciacontabil.com.br/?utm_campaign=nova', storage: a.storage });
  assert.equal(b.parametros().get('utm_campaign'), 'nova');
  assert.equal(b.parametros().get('utm_source'), 'site');
  assert.equal(b.parametros().get('fbclid'), null);
  assert.equal(b.parametros().get('s2'), null);
});

test('storage inválido ou bloqueado não impede herança da URL nem navegação', () => {
  for (const armazenado of ['null', '[]', '42', '{invalido', '{"utm_source":{"objeto":true}}']) {
    const a = ensaio({ storage: new Map([['fc_origem', armazenado]]) });
    a.clicar();
    assert.equal(a.parametros().get('utm_source'), 'site');
  }
  const b = ensaio({ bloqueado: true, url: 'https://fluenciacontabil.com.br/?fbclid=clique_sintetico&utm_campaign=campanha' });
  b.tempo(5000);
  b.clicar();
  assert.equal(b.parametros().get('utm_campaign'), 'campanha');
  assert.equal(b.parametros().get('s2'), `fb.1.${INSTANTE}.clique_sintetico`);
});

for (const carregando of [false, true]) {
  test(`carregamento duplicado do script não duplica eventos ou timers (DOM pendente: ${carregando})`, () => {
    const e = ensaio({ carregando });
    e.carregar();
    e.pronto();
    e.pronto();
    assert.equal(e.timers.size, 1);
    e.clicar();
    assert.equal(e.window.dataLayer.length, 1);
    assert.equal(e.window.dataLayer[0].event, 'checkout_click');
    assert.equal(e.window.dataLayer[0].cta_location, 'oferta');
    e.clicar(0, 'auxclick', 1);
    assert.equal(e.window.dataLayer.length, 2);
    e.clicar(0, 'auxclick', 2);
    assert.equal(e.window.dataLayer.length, 2);
  });
}

test('link dinâmico recebe cookies tardios sem precisar reinstalar o script', () => {
  const e = ensaio({ hrefs: [] });
  e.links.push({ href: checkout, getAttribute: (k) => k === 'data-cta' ? 'novo-botao' : null });
  e.document.cookie = `_fbp=fb.1.${INSTANTE}.navegador`;
  e.clicar();
  assert.equal(e.parametros().get('s1'), `fb.1.${INSTANTE}.navegador`);
  assert.equal(e.window.dataLayer[0].cta_location, 'novo-botao');
});

test('somente o checkout HTTPS exato recebe cookies e evento de intenção de compra', () => {
  for (const href of [
    'https://pay.kiwify.com.br.example.invalid/oferta',
    'https://example.invalid/?destino=pay.kiwify.com.br',
    'https://pay.kiwify.com.br@example.invalid/oferta',
    'https://usuario@pay.kiwify.com.br/oferta',
    'http://pay.kiwify.com.br/oferta',
    'https://pay.kiwify.com.br:8443/oferta',
  ]) {
    const e = ensaio({ hrefs: [href], cookie: `_fbp=fb.1.${INSTANTE}.navegador` });
    e.clicar();
    assert.equal(e.links[0].href, href);
    assert.equal(e.window.dataLayer.length, 0);
  }
});

test('a origem atravessa site e Dicionário, sem enviar cookies nem evento de checkout na passagem', () => {
  const e = ensaio({ url: 'https://fluenciacontabil.com.br/?utm_campaign=campanha&fbclid=clique_sintetico', hrefs: ['https://dicionario.fluenciacontabil.com.br/'], cookie: `_fbp=fb.1.${INSTANTE}.navegador` });
  e.clicar();
  assert.equal(e.window.dataLayer.length, 0);
  assert.equal(e.parametros().get('s1'), null);
  assert.equal(e.parametros().get('utm_campaign'), 'campanha');
  const d = ensaio({ url: e.links[0].href });
  assert.equal(d.parametros().get('utm_campaign'), 'campanha');
  assert.equal(d.parametros().get('fbclid'), 'clique_sintetico');
});

test('todas as páginas públicas com GTM carregam uma única cópia atual do script', () => {
  const arquivos = execFileSync('git', ['-c', `safe.directory=${raiz.replaceAll('\\', '/')}`, 'ls-files', '-z', '*.html'], { cwd: raiz, encoding: 'utf8' }).split('\0').filter(Boolean);
  let conferidas = 0;
  for (const arquivo of arquivos) {
    const html = readFileSync(path.join(raiz, arquivo), 'utf8');
    if (!html.includes('googletagmanager.com/gtm.js')) continue;
    conferidas++;
    const referencias = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']*assets\/origem\.js[^"']*)["'][^>]*>/g)];
    assert.equal(referencias.length, 1, `${arquivo}: uma única inclusão`);
    const referencia = referencias[0][1];
    assert.equal(referencia.split('?')[1], 'v=20260909', `${arquivo}: cache atualizado`);
    assert.equal(path.resolve(raiz, path.dirname(arquivo), referencia.split('?')[0]), path.join(raiz, 'assets', 'origem.js'));
  }
  assert.ok(conferidas > 0);
});
