// ⏱ 2026-06-16T00:15WIB — RENDERER_URL to AKfycbzAYbwXxHRV, auto-close in Step 2, single-page
/**
 * PROJECT 1: NERD STUDIO FORM CONSTRUCTOR
 * Execute As: User accessing | Access: Anyone with Google
 */

var RENDERER_URL = "https://script.google.com/macros/s/AKfycbzAYbwXxHRV_GCoXxP7HQ_QmayOEZxP3vqLiOFyx7sSE_NBNrQwxkVAoEb9xX0UjhKz/exec";

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Nerd Studio — Form Constructor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ═══ UTILS ═══
function extractId(url) {
  var m = url.match(/\/d\/(?:e\/)?([^/]+)/);
  if (!m || m[1] === 'e') return null;
  return m[1];
}
function toEditUrl(url) {
  var id = extractId(url) || (url.match(/\/d\/e\/([^/]+)/) || [])[1];
  return id ? 'https://docs.google.com/forms/d/' + id + '/edit' : url;
}

// ═══ FORM CREATE & PARSE ═══
function autoCreateGoogleForm(formData) {
  try {
    var form = FormApp.create(formData.title || 'Form Baru');
    form.setCollectEmail(false);
    form.setDescription('Dibuat oleh Nerd Studio Form Constructor');
    try {
      var ss = SpreadsheetApp.create((formData.title || 'Form') + ' — Responses');
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    } catch(e) {}
    (formData.fields || []).forEach(function(f) {
      var item = f.type === 'paragraph' ? form.addParagraphTextItem() : form.addTextItem();
      item.setTitle(f.label).setRequired(f.required !== false);
    });
    return { success: true, url: form.getPublishedUrl(), editUrl: 'https://docs.google.com/forms/d/' + form.getId() + '/edit', id: form.getId() };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function parseGoogleForm(formUrl) {
  try {
    var html = UrlFetchApp.fetch(formUrl, { muteHttpExceptions: true }).getContentText();
    var match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);/s);
    if (!match) throw new Error("Struktur form tidak terbaca.");
    var data = JSON.parse(match[1]);
    var fields = [];
    (data[1][1] || []).forEach(function(q) {
      var entryId = '';
      try { entryId = q[4][0][0]; } catch (e) {}
      if (entryId && q[1]) fields.push({ label: q[1], entry: 'entry.' + entryId, type: 'text' });
    });
    return { success: true, formActionUrl: formUrl.replace(/\/viewform.*/, '/formResponse'), fields: fields, formId: extractId(formUrl) };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function generateLiveSaaSLink(configObj) {
  try {
    var token = Utilities.base64EncodeWebSafe(JSON.stringify(configObj));
    return { success: true, liveUrl: RENDERER_URL + "?f=" + token, token: token };
  } catch (err) { return { success: false, message: err.toString() }; }
}

// ═══ FORM MANAGER ═══
function getFullStats(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var responses = form.getResponses();
    var sheetUrl = '';
    try { if (form.getDestinationId()) sheetUrl = 'https://docs.google.com/spreadsheets/d/' + form.getDestinationId() + '/edit'; } catch(e) {}
    var last = responses.length > 0 ? responses[responses.length - 1].getTimestamp().toISOString() : '';
    return { success: true, title: form.getTitle() || '', total: responses.length, lastSubmission: last, accepting: form.isAcceptingResponses(), sheetUrl: sheetUrl };
  } catch(e) { return { success: false, message: e.toString() }; }
}

function toggleAccepting(formUrl, accepting) {
  try {
    FormApp.openByUrl(toEditUrl(formUrl)).setAcceptingResponses(accepting);
    return { success: true, accepting: accepting };
  } catch(e) { return { success: false, message: e.toString() }; }
}

function saveAutoClose(formUrl, config) {
  PropertiesService.getUserProperties().setProperty('ac_' + extractId(formUrl), JSON.stringify(config));
  return { success: true };
}

function getAutoCloseConfig(formUrl) {
  var raw = PropertiesService.getUserProperties().getProperty('ac_' + extractId(formUrl));
  return { success: true, config: raw ? JSON.parse(raw) : null };
}

function getResponseTable(formUrl, limit) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var destId = form.getDestinationId();
    if (destId) {
      var ss = SpreadsheetApp.openById(destId);
      var sheet = ss.getSheets()[0];
      var data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        var rows = data.slice(1).filter(function(r) { return r.some(function(c) { return String(c).trim(); }); });
        return { success: true, headers: data[0], rows: rows.slice(-Math.min(limit||20, rows.length)), total: rows.length };
      }
    }
    return { success: true, headers: [], rows: [], total: 0 };
  } catch(e) { return { success: false, message: e.toString() }; }
}
