/**
 * PROJECT 1: NERD STUDIO FORM CONSTRUCTOR
 * Execute As: User accessing | Access: Anyone with Google
 */

var RENDERER_URL = "https://script.google.com/macros/s/AKfycbwu7-149GyerxVvLISW3xxjNSyekrDdK_z5kafvtVY656avehBRx9XjPzVPsg-s5-ct/exec";

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Nerd Studio — Form Constructor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ═══ FORM CREATION & PARSING ═══════════════════════════════════

function autoCreateGoogleForm(formData) {
  try {
    var form = FormApp.create(formData.title || 'Form Baru');
    form.setCollectEmail(false);
    form.setDescription((formData.description || 'Dibuat oleh Nerd Studio Form Constructor') + '\n\n🏗️ Built with Nerd Studio Form Constructor — ' + new Date().toISOString().split('T')[0]);
    (formData.fields || []).forEach(function(f) {
      var item;
      switch (f.type) {
        case 'paragraph': item = form.addParagraphTextItem(); break;
        case 'choice': item = form.addMultipleChoiceItem();
          if (f.options) item.setChoices(f.options.map(function(o) { return item.createChoice(o); }));
          break;
        default: item = form.addTextItem();
      }
      item.setTitle(f.label).setRequired(f.required !== false);
    });
    return { success: true, url: form.getPublishedUrl(), id: form.getId() };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function parseGoogleForm(formUrl) {
  try {
    var html = UrlFetchApp.fetch(formUrl, { muteHttpExceptions: true }).getContentText();
    var match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);/s);
    if (!match) throw new Error("Struktur form tidak terbaca.");
    var data = JSON.parse(match[1]);
    var questions = data[1][1];
    var formActionUrl = formUrl.replace(/\/viewform.*/, '/formResponse');
    var fields = [];
    questions.forEach(function(q) {
      var title = q[1]; var entryId = '';
      try { entryId = q[4][0][0]; } catch (e) {}
      if (entryId && title) fields.push({ label: title, entry: 'entry.' + entryId, type: 'text' });
    });
    return { success: true, formActionUrl: formActionUrl, fields: fields, formId: extractId(formUrl) };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function generateLiveSaaSLink(configObj) {
  try {
    var token = Utilities.base64EncodeWebSafe(JSON.stringify(configObj));
    return { success: true, liveUrl: RENDERER_URL + "?f=" + token, token: token };
  } catch (err) { return { success: false, message: err.toString() }; }
}

// ═══ ADMIN — LINKED SHEET, STATS, AUTO-CLOSE ══════════════════

function extractId(url) { var m = url.match(/\/d\/([^/]+)/); return m ? m[1] : null; }

// Normalize any Google Form URL to edit URL format
function toEditUrl(url) {
  var id = extractId(url);
  if (!id) return url;
  return 'https://docs.google.com/forms/d/' + id + '/edit';
}

function isNerdStudioForm(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl);
    var desc = form.getDescription() || '';
    return desc.indexOf('🏗️ Built with Nerd Studio Form Constructor') !== -1;
  } catch(e) { return false; }
}

function getFormStats(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var responses = form.getResponses();
    var sheetUrl = '';
    try { if (form.getDestinationId()) sheetUrl = 'https://docs.google.com/spreadsheets/d/' + form.getDestinationId() + '/edit'; } catch(e) {}
    var last = responses.length > 0 ? responses[responses.length - 1].getTimestamp().toISOString() : '';
    return { success: true, total: responses.length, lastSubmission: last, accepting: form.isAcceptingResponses(), sheetUrl: sheetUrl, formId: extractId(formUrl), isNerdStudio: isNerdStudioForm(formUrl) };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function linkSheetToForm(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    if (form.getDestinationId()) return { success: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/' + form.getDestinationId() + '/edit', alreadyLinked: true };
    var ss = SpreadsheetApp.create(form.getTitle() + ' — Responses');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    return { success: true, sheetUrl: ss.getUrl() };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function getResponseData(formUrl, limit) {
  try {
    var form = FormApp.openByUrl(toEditUrl);
    var responses = form.getResponses();
    var items = form.getItems();
    limit = Math.min(limit || 30, responses.length);
    var headers = items.map(function(it) { return it.getTitle(); });
    var rows = [];
    for (var i = Math.max(0, responses.length - limit); i < responses.length; i++) {
      var resp = responses[i];
      var itemResponses = resp.getItemResponses();
      var row = [resp.getTimestamp().toLocaleString()];
      items.forEach(function(item) {
        var found = '';
        for (var j = 0; j < itemResponses.length; j++) {
          if (itemResponses[j].getItem().getId() === item.getId()) { found = itemResponses[j].getResponse(); break; }
        }
        row.push(String(found));
      });
      rows.push(row);
    }
    return { success: true, headers: ['Timestamp'].concat(headers), rows: rows, total: responses.length };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function getUniqueCount(formUrl, fieldTitle) {
  try {
    var form = FormApp.openByUrl(toEditUrl);
    var items = form.getItems();
    var targetItem = null;
    for (var i = 0; i < items.length; i++) { if (items[i].getTitle() === fieldTitle) { targetItem = items[i]; break; } }
    if (!targetItem) return { success: false, message: 'Field not found' };
    var seen = {};
    form.getResponses().forEach(function(resp) {
      var ir = resp.getItemResponses();
      for (var j = 0; j < ir.length; j++) {
        if (ir[j].getItem().getId() === targetItem.getId()) { seen[String(ir[j].getResponse()).toLowerCase().trim()] = true; }
      }
    });
    return { success: true, uniqueCount: Object.keys(seen).length, total: form.getResponses().length, field: fieldTitle };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function getAutoCloseConfig(formUrl) {
  var raw = PropertiesService.getUserProperties().getProperty('ac_' + extractId(formUrl));
  return { success: true, config: raw ? JSON.parse(raw) : null };
}

function saveAutoCloseConfig(formUrl, config) {
  PropertiesService.getUserProperties().setProperty('ac_' + extractId(formUrl), JSON.stringify(config));
  return { success: true };
}

function toggleForm(formUrl, shouldAccept) {
  try {
    FormApp.openByUrl(toEditUrl).setAcceptingResponses(shouldAccept);
    return { success: true, accepting: shouldAccept };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function saveFormToList(formUrl, title) {
  var props = PropertiesService.getUserProperties();
  var list = JSON.parse(props.getProperty('form_list') || '[]');
  var id = extractId(formUrl);
  // Dedupe by id
  list = list.filter(function(f) { return f.id !== id; });
  list.unshift({ id: id, url: formUrl, title: title || 'Untitled', savedAt: new Date().toISOString() });
  // Keep max 20
  if (list.length > 20) list = list.slice(0, 20);
  props.setProperty('form_list', JSON.stringify(list));
  return { success: true, list: list };
}

function getFormList() {
  var props = PropertiesService.getUserProperties();
  return { success: true, list: JSON.parse(props.getProperty('form_list') || '[]') };
}
