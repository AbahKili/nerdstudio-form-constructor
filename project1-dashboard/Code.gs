/**
 * PROJECT 1: NERD STUDIO FORM CONSTRUCTOR
 * Execute As: User accessing | Access: Anyone with Google
 */

var RENDERER_URL = "https://script.google.com/macros/s/AKfycbwCXR_4721e2n83hTa0x49V2lf4Lk1RML-BJCp-Twg/exec";

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
    // Auto-link Google Sheet
    try {
      var ss = SpreadsheetApp.create(form.getTitle() || 'Form Responses');
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    } catch(e) {}
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
    return { success: true, url: form.getPublishedUrl(), editUrl: 'https://docs.google.com/forms/d/' + form.getId() + '/edit', id: form.getId() };
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

function extractId(url) {
  // Match /d/FORM_ID or /d/e/FORM_ID (viewform format)
  var m = url.match(/\/d\/(?:e\/)?([^/]+)/);
  if (!m) return null;
  var id = m[1];
  // Skip the literal 'e' (viewform prefix)
  if (id === 'e') return null;
  return id;
}

// Normalize any Google Form URL to edit URL format
function toEditUrl(url) {
  var id = extractId(url);
  if (!id) return url;
  return 'https://docs.google.com/forms/d/' + id + '/edit';
}

function isNerdStudioForm(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var desc = form.getDescription() || '';
    return desc.indexOf('🏗️ Built with Nerd Studio Form Constructor') !== -1;
  } catch(e) { return false; }
}

function getFormStats(formUrl) {
  var urls = [toEditUrl(formUrl), formUrl];
  var lastErr = '';
  for (var i = 0; i < urls.length; i++) {
    try {
      var form = FormApp.openByUrl(urls[i]);
      var responses = form.getResponses();
      var sheetUrl = '';
      try { if (form.getDestinationId()) sheetUrl = 'https://docs.google.com/spreadsheets/d/' + form.getDestinationId() + '/edit'; } catch(e) {}
      var last = responses.length > 0 ? responses[responses.length - 1].getTimestamp().toISOString() : '';
      return { success: true, total: responses.length, lastSubmission: last, accepting: form.isAcceptingResponses(), sheetUrl: sheetUrl, formId: extractId(formUrl), isNerdStudio: isNerdStudioForm(urls[i]), triedUrl: urls[i] };
    } catch (err) { lastErr = err.toString(); }
  }
  return { success: false, message: lastErr + ' | tried: ' + urls.join(', ') };
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
    // Try reading from linked Sheet first (picks up manual edits)
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var sheetData = null;
    try {
      var destId = form.getDestinationId();
      if (destId) {
        var ss = SpreadsheetApp.openById(destId);
        var sheet = ss.getSheets()[0];
        var allData = sheet.getDataRange().getValues();
        if (allData.length > 1) {
          sheetData = { headers: allData[0], rows: allData.slice(1) };
        }
      }
    } catch(e) {}

    if (sheetData) {
      limit = Math.min(limit || 30, sheetData.rows.length);
      return { success: true, headers: sheetData.headers, rows: sheetData.rows.slice(-limit), total: sheetData.rows.length, source: 'sheet' };
    }

    // Fallback to form responses
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
    return { success: true, headers: ['Timestamp'].concat(headers), rows: rows, total: responses.length, source: 'form' };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function getUniqueCount(formUrl, fieldTitle) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
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
    FormApp.openByUrl(toEditUrl(formUrl)).setAcceptingResponses(shouldAccept);
    return { success: true, accepting: shouldAccept };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function saveFormToList(formUrl, title) {
  var props = PropertiesService.getUserProperties();
  var list = JSON.parse(props.getProperty('form_list') || '[]');
  var id = extractId(formUrl);
  // ALWAYS get actual form title from Google Form, fallback to passed title, then ID
  try { title = FormApp.openByUrl(toEditUrl(formUrl)).getTitle() || title; } catch(e) {}
  if (!title || !title.trim()) title = 'Form ' + (id ? id.substring(0, 8) : 'Baru');
  // Dedupe by id
  list = list.filter(function(f) { return f.id !== id; });
  list.unshift({ id: id, url: formUrl, title: title, savedAt: new Date().toISOString() });
  if (list.length > 20) list = list.slice(0, 20);
  props.setProperty('form_list', JSON.stringify(list));
  return { success: true, list: list };
}

function deleteFormFromList(formUrl) {
  var props = PropertiesService.getUserProperties();
  var list = JSON.parse(props.getProperty('form_list') || '[]');
  var id = extractId(formUrl);
  list = list.filter(function(f) { return f.id !== id; });
  props.setProperty('form_list', JSON.stringify(list));
  return { success: true };
}

function saveFormLiveLink(formUrl, liveUrl) {
  var props = PropertiesService.getUserProperties();
  var list = JSON.parse(props.getProperty('form_list') || '[]');
  var id = extractId(formUrl);
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { list[i].liveUrl = liveUrl; break; }
  }
  props.setProperty('form_list', JSON.stringify(list));
  return { success: true };
}

function getFormTitle(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    return { success: true, title: form.getTitle() };
  } catch(e) { return { success: false }; }
}

function getFormLiveLink(formUrl) {
  var list = JSON.parse(PropertiesService.getUserProperties().getProperty('form_list') || '[]');
  var id = extractId(formUrl);
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id && list[i].liveUrl) return { success: true, liveUrl: list[i].liveUrl };
  }
  return { success: false };
}

function refreshFormList() {
  var props = PropertiesService.getUserProperties();
  var list = JSON.parse(props.getProperty('form_list') || '[]');
  var cleaned = [];
  for (var i = 0; i < list.length; i++) {
    try {
      var form = FormApp.openByUrl(toEditUrl(list[i].url));
      list[i].title = form.getTitle();
      cleaned.push(list[i]);
    } catch(e) {
      // Form no longer accessible — remove from list
    }
  }
  props.setProperty('form_list', JSON.stringify(cleaned));
  return { success: true, list: cleaned };
}

function getFormList() {
  var props = PropertiesService.getUserProperties();
  return { success: true, list: JSON.parse(props.getProperty('form_list') || '[]') };
}
