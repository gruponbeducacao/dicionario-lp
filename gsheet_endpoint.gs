/**
 * gsheet_endpoint.gs
 * Endpoint Apps Script STANDALONE para a LP Dicionário Contábil.
 *
 * Grava leads na planilha "Recebimento de Leads - 1", aba "Repositório Geral",
 * usando o MESMO formato já existente (colunas A–E):
 *   A: Data do Cadastro   (dd/MM/yyyy HH:mm:ss — horário de Brasília)
 *   B: Nome
 *   C: Email
 *   D: WhatsApp           (somente dígitos)
 *   E: Origem             (valor fixo: "LP - Dicionário Contábil")
 *
 * Este script é INDEPENDENTE do script vinculado à planilha (que trata
 * do "Site - Lista de Espera"). Cada um tem sua própria URL /exec.
 * Mudar este arquivo não afeta o outro, e vice-versa.
 *
 * ─── SETUP ──────────────────────────────────────────────────────────
 * 1. Abra https://script.google.com e clique em "+ Novo projeto".
 * 2. Apague o boilerplate. Cole este arquivo inteiro. Ctrl+S.
 * 3. Nome do projeto: "LP Dicionario - Endpoint".
 * 4. Implantar → Nova implantação → tipo "Aplicativo da Web".
 *    - Executar como: Eu (mesma conta que tem acesso à planilha)
 *    - Quem tem acesso: Qualquer pessoa (anônimo, sem login)
 * 5. Autorizar os escopos (Avançado → Acessar → Permitir).
 * 6. Copiar a URL /exec e colar em GSHEET_ENDPOINT no index.html.
 *
 * ─── ATUALIZAR SEM QUEBRAR A URL ────────────────────────────────────
 * Implantar → Gerenciar implantações → lápis (editar) → Nova versão →
 * Implantar. A URL permanece a mesma.
 * ─────────────────────────────────────────────────────────────────── */

var SHEET_ID      = '1Vhqu7ieYPcawvNsAOm4VV72UxVueQqgM2enKeAVw-y4';
var SHEET_NAME    = 'Repositório Geral';
var ORIGEM_LABEL  = 'LP - Dicionário Contábil';

function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('Aba "' + SHEET_NAME + '" não encontrada.');
    }

    var p = (e && e.parameter) ? e.parameter : {};

    var dataFormatada = Utilities.formatDate(
      new Date(),
      'America/Sao_Paulo',
      'dd/MM/yyyy HH:mm:ss'
    );

    // Prioriza telefone_digits; se vazio, extrai dígitos de telefone mascarado
    var whats = p.telefone_digits || String(p.telefone || '').replace(/\D+/g, '');

    // Linha na ordem EXATA das colunas existentes
    var row = [
      dataFormatada,             // A
      (p.nome  || '').trim(),    // B
      (p.email || '').trim(),    // C
      whats,                     // D
      ORIGEM_LABEL               // E
    ];

    sheet.appendRow(row);

    // Log separado de UTMs/metadados (aba auxiliar, não interfere no principal)
    try {
      var meta = ss.getSheetByName('_meta_LP_Dicionario') || ss.insertSheet('_meta_LP_Dicionario');
      if (meta.getLastRow() === 0) {
        meta.appendRow([
          'received_at', 'email', 'pagina',
          'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
          'timestamp_cliente'
        ]);
        meta.getRange(1, 1, 1, 9).setFontWeight('bold');
        meta.setFrozenRows(1);
      }
      meta.appendRow([
        dataFormatada,
        (p.email || '').trim(),
        p.pagina || '',
        p.utm_source  || '',
        p.utm_medium  || '',
        p.utm_campaign|| '',
        p.utm_content || '',
        p.utm_term    || '',
        p.timestamp   || ''
      ]);
    } catch (_) { /* nunca quebra o fluxo principal */ }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    try {
      var ss2 = SpreadsheetApp.openById(SHEET_ID);
      var log = ss2.getSheetByName('_errors') || ss2.insertSheet('_errors');
      log.appendRow([new Date(), String(err), JSON.stringify(e && e.parameter)]);
    } catch (_) {}
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput('LP Dicionário endpoint OK · ' + new Date().toISOString())
    .setMimeType(ContentService.MimeType.TEXT);
}
