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
function ensaio({ url = 'https://fluenciacontabil.com.br/cursos.html', hrefs = [checkout], storage = new Map(), cookie = '', bloqueado = false, carregando = false, agoraInicial = INSTANTE, local = new Map(), localBloqueado = false, referrer = '' } = {}) {
  let agora = agoraInicial;
  const listeners = new Map();
  const timers = new Map();
  const links = hrefs.map((href) => ({ href, getAttribute: () => null }));
  const document = {
    cookie,
    referrer,
    readyState: carregando ? 'loading' : 'complete',
    querySelectorAll: () => links,
    addEventListener(tipo, fn) {
      listeners.set(tipo, [...(listeners.get(tipo) || []), fn]);
    },
  };
  const falhaLocal = () => { if (localBloqueado) throw Error('localStorage bloqueado'); };
  const window = {
    location: new URL(url), dataLayer: [],
    matchMedia: () => ({ matches: false }),
    localStorage: {
      getItem(k) { falhaLocal(); return local.get(k) ?? null; },
      setItem(k, v) { falhaLocal(); local.set(k, String(v)); },
      removeItem(k) { falhaLocal(); local.delete(k); },
    },
  };
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
    window, document, links, storage, local, timers, carregar,
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
    assert.equal(referencia.split('?')[1], 'v=20261124', `${arquivo}: cache atualizado`);
    assert.equal(path.resolve(raiz, path.dirname(arquivo), referencia.split('?')[0]), path.join(raiz, 'assets', 'origem.js'));
  }
  assert.ok(conferidas > 0);
});

/* ---------- Primeiro e último toque (contrato de 24/11/2026) ---------- */
const DIA = 24 * 60 * 60 * 1000;
const CAMPOS_DO_LEAD = ['pt_source', 'pt_medium', 'pt_campaign', 'pt_content', 'pt_term', 'pt_src',
  'pt_pagina', 'pt_referrer', 'pt_em', 'entrada', 'ut_em', 'fbclid', 'gclid'];
const site = 'https://fluenciacontabil.com.br';
// Cada página é um carregamento novo do script, com o mesmo localStorage.
const visita = (local, agora, url, extra = {}) => ensaio({ local, agoraInicial: agora, url, hrefs: [], ...extra });

test('campos do lead: sempre as mesmas chaves, todas string, vazias sem toque', () => {
  const c = visita(new Map(), INSTANTE, `${site}/cursos.html`).window.FC_ORIGEM.camposDoLead();
  assert.deepEqual(Object.keys(c).sort(), [...CAMPOS_DO_LEAD].sort());
  for (const k of CAMPOS_DO_LEAD) assert.equal(c[k], '', k);
});

test('primeiro toque fica fixo; último toque troca a cada nova campanha', () => {
  const local = new Map();
  visita(local, INSTANTE, `${site}/blog/aula.html?utm_source=meta&utm_medium=cpc&utm_campaign=teste&utm_content=peca&utm_term=t1&src=anuncio&fbclid=abc#topo`);
  // Navegação interna, sem parâmetro e com referrer da própria marca: não é toque.
  visita(local, INSTANTE + 1000, `${site}/cursos.html`, { referrer: `${site}/blog/aula.html?utm_source=meta` });
  let c = visita(local, INSTANTE + 2000, `${site}/cursos.html`).window.FC_ORIGEM.camposDoLead();
  assert.equal(c.pt_source, 'meta');
  assert.equal(c.pt_medium, 'cpc');
  assert.equal(c.pt_campaign, 'teste');
  assert.equal(c.pt_content, 'peca');
  assert.equal(c.pt_term, 't1');
  assert.equal(c.pt_src, 'anuncio');
  assert.equal(c.pt_pagina, 'fluenciacontabil.com.br/blog/aula.html');
  assert.equal(c.pt_referrer, '');
  assert.equal(c.pt_em, new Date(INSTANTE).toISOString());
  assert.equal(c.entrada, 'fluenciacontabil.com.br/blog/aula.html');
  assert.equal(c.ut_em, new Date(INSTANTE).toISOString());
  assert.equal(c.fbclid, 'abc');
  assert.equal(c.gclid, '');

  const depois = INSTANTE + 10 * DIA;
  visita(local, depois, `${site}/black.html?utm_source=google&utm_campaign=black&gclid=g123`);
  c = visita(local, depois + 1000, `${site}/index.html`).window.FC_ORIGEM.camposDoLead();
  assert.equal(c.pt_source, 'meta', 'primeiro toque não muda');
  assert.equal(c.pt_campaign, 'teste');
  assert.equal(c.pt_em, new Date(INSTANTE).toISOString());
  assert.equal(c.entrada, 'fluenciacontabil.com.br/black.html');
  assert.equal(c.ut_em, new Date(depois).toISOString());
  assert.equal(c.gclid, 'g123');
  assert.equal(c.fbclid, '', 'id de clique é do último toque, sem misturar com o anterior');
});

test('referrer externo cria toque, guardado só com host e caminho', () => {
  const local = new Map();
  const e = visita(local, INSTANTE, `${site}/blog/dre.html`, { referrer: 'https://www.google.com/search?q=dre+concurso' });
  const c = e.window.FC_ORIGEM.camposDoLead();
  assert.equal(c.pt_referrer, 'www.google.com/search');
  assert.equal(c.pt_source, '');
  assert.equal(c.pt_pagina, 'fluenciacontabil.com.br/blog/dre.html');
  assert.equal(c.entrada, 'fluenciacontabil.com.br/blog/dre.html');
  assert.ok(!local.get('fc_toques').includes('dre+concurso'), 'query do referrer nunca é guardada');
  // App do Instagram no Android.
  const app = visita(new Map(), INSTANTE, `${site}/`, { referrer: 'android-app://com.instagram.android/' });
  assert.equal(app.window.FC_ORIGEM.camposDoLead().pt_referrer, 'com.instagram.android/');
});

test('visita direta e referrer da marca ou do checkout não criam toque', () => {
  for (const referrer of ['', `${site}/`, 'https://www.fluenciacontabil.com.br/cursos.html',
    'https://dicionario.fluenciacontabil.com.br/', 'https://pay.kiwify.com.br/abc', 'https://kiwify.com.br/']) {
    const local = new Map();
    const c = visita(local, INSTANTE, `${site}/cursos.html`, { referrer }).window.FC_ORIGEM.camposDoLead();
    assert.equal(local.has('fc_toques'), false, referrer);
    assert.equal(c.entrada, '', referrer);
  }
  // Parâmetro sck sozinho não é campanha pelo contrato.
  const local = new Map();
  visita(local, INSTANTE, `${site}/cursos.html?sck=x`);
  assert.equal(local.has('fc_toques'), false);
});

test('validade de 90 dias contada do último toque; expirado, os dois somem', () => {
  const local = new Map();
  visita(local, INSTANTE, `${site}/?utm_source=meta&utm_campaign=antiga`);
  // Dia 89: ainda vale.
  assert.equal(visita(local, INSTANTE + 89 * DIA, `${site}/cursos.html`).window.FC_ORIGEM.camposDoLead().pt_campaign, 'antiga');
  // Toque no dia 89 renova a validade dos dois.
  visita(local, INSTANTE + 89 * DIA, `${site}/?utm_source=google&utm_campaign=meio`);
  const renovado = visita(local, INSTANTE + 170 * DIA, `${site}/cursos.html`).window.FC_ORIGEM.camposDoLead();
  assert.equal(renovado.pt_campaign, 'antiga');
  assert.equal(renovado.entrada, 'fluenciacontabil.com.br/');
  // Mais de 90 dias depois do último toque: descarta tudo.
  const expirado = visita(local, INSTANTE + 179 * DIA + 1, `${site}/cursos.html`);
  for (const k of CAMPOS_DO_LEAD) assert.equal(expirado.window.FC_ORIGEM.camposDoLead()[k], '', k);
  assert.equal(local.has('fc_toques'), false);
  // Toque novo depois de expirar vira o novo primeiro.
  const novo = visita(local, INSTANTE + 200 * DIA, `${site}/?utm_source=youtube&utm_campaign=nova`).window.FC_ORIGEM.camposDoLead();
  assert.equal(novo.pt_source, 'youtube');
  assert.equal(novo.pt_em, new Date(INSTANTE + 200 * DIA).toISOString());
});

test('a validade também é conferida no envio, não só ao carregar a página', () => {
  const e = visita(new Map(), INSTANTE, `${site}/?utm_source=meta`);
  e.tempo(90 * DIA + 1);
  assert.equal(e.window.FC_ORIGEM.camposDoLead().pt_source, '');
});

test('valor acima de 300 caracteres é descartado, não truncado; e-mail nunca vira origem', () => {
  const longo = 'x'.repeat(301);
  const c = visita(new Map(), INSTANTE, `${site}/?utm_source=${longo}&utm_campaign=${'y'.repeat(300)}&utm_content=fulano%40example.com&fbclid=${longo}`).window.FC_ORIGEM.camposDoLead();
  assert.equal(c.pt_source, '');
  assert.equal(c.pt_campaign, 'y'.repeat(300));
  assert.equal(c.pt_content, '');
  assert.equal(c.fbclid, '');
  const ref = visita(new Map(), INSTANTE, `${site}/`, { referrer: `https://exemplo.invalid/${'a'.repeat(400)}` }).window.FC_ORIGEM.camposDoLead();
  assert.equal(ref.pt_referrer, '');
  assert.equal(ref.entrada, 'fluenciacontabil.com.br/', 'referrer externo longo ainda conta como toque');
});

test('localStorage bloqueado ou corrompido não lança e não impede o checkout', () => {
  const e = visita(new Map(), INSTANTE, `${site}/?utm_source=meta&fbclid=abc`, { localBloqueado: true, hrefs: [checkout] });
  e.clicar();
  assert.equal(e.parametros().get('utm_source'), 'meta');
  const c = e.window.FC_ORIGEM.camposDoLead();
  assert.equal(c.pt_source, 'meta', 'sem storage, vale o toque desta página');
  assert.equal(c.fbclid, 'abc');
  assert.equal(visita(new Map(), INSTANTE, `${site}/`, { localBloqueado: true }).window.FC_ORIGEM.camposDoLead().pt_source, '');
  for (const lixo of ['{', 'null', '[]', '42', '{"primeiro":{"em":"ontem"},"ultimo":{}}',
    JSON.stringify({ primeiro: { em: INSTANTE + 5 }, ultimo: { em: INSTANTE } }),
    JSON.stringify({ primeiro: { em: INSTANTE + 30 * DIA }, ultimo: { em: INSTANTE + 30 * DIA } })]) {
    const local = new Map([['fc_toques', lixo]]);
    const v = visita(local, INSTANTE, `${site}/cursos.html`);
    assert.equal(v.window.FC_ORIGEM.camposDoLead().pt_em, '', lixo);
    assert.equal(local.has('fc_toques'), false, lixo);
  }
});

test('anexar os campos não sobrescreve o que o formulário já manda', () => {
  const e = visita(new Map(), INSTANTE, `${site}/?utm_source=meta&gclid=g1`);
  const corpo = new URLSearchParams({ email: 'ensaio@example.invalid', gclid: 'do-form' });
  e.window.FC_ORIGEM.anexarCamposDoLead(corpo);
  assert.equal(corpo.get('gclid'), 'do-form');
  assert.equal(corpo.get('pt_source'), 'meta');
  assert.equal(corpo.getAll('gclid').length, 1);
  const obj = e.window.FC_ORIGEM.anexarCamposDoLead({ origem: 'x' });
  assert.equal(obj.origem, 'x');
  assert.equal(obj.entrada, 'fluenciacontabil.com.br/');
  const ctx = e.window.FC_ORIGEM.contextoDoLead();
  for (const k of ['pagina', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'dispositivo', ...CAMPOS_DO_LEAD]) {
    assert.equal(typeof ctx[k], 'string', k);
  }
  assert.equal(ctx.utm_source, 'meta');
  assert.equal(ctx.dispositivo, 'Desktop');
});

test('checkout continua igual: o registro de toques não entra no link da Kiwify', () => {
  const comToques = new Map();
  visita(comToques, INSTANTE - DIA, `${site}/?utm_source=google&utm_campaign=antiga&gclid=g0&fbclid=velho`);
  for (const url of [`${site}/cursos.html`, `${site}/cursos.html?utm_source=meta&utm_content=peca&fbclid=abc`]) {
    const a = ensaio({ url, cookie: `_fbp=fb.1.${INSTANTE}.navegador` });
    const b = ensaio({ url, cookie: `_fbp=fb.1.${INSTANTE}.navegador`, local: new Map(comToques) });
    a.clicar(); b.clicar();
    assert.equal(b.links[0].href, a.links[0].href, url);
    assert.equal(JSON.stringify(b.window.dataLayer), JSON.stringify(a.window.dataLayer));
  }
});
