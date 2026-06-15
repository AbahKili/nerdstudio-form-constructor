// ⏱ 2026-06-15 23:08 WIB — trash check with DriveApp.isTrashed()
/**
 * PROJECT 1: NERD STUDIO FORM CONSTRUCTOR
 * Execute As: User accessing | Access: Anyone with Google
 */

var RENDERER_URL = "https://script.google.com/macros/s/AKfycbwAkLxsQlK-mDyNq3EwDtvlknvDdDuL-4ax_oXbmb-w6FwEe8NvjXyC5J8_Ofrx-_Uc/exec";

function forceAuthDrive() { DriveApp.getRootFolder(); }

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
      try { ss.insertSheet("Sheet1"); } catch(e2) {}
      try { DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW); } catch(e3) {}
      try { ss.insertSheet("Sheet1"); } catch(e2) {}
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
    // Check if form is accepting and embed status in token
    if (configObj.formActionUrl) {
      try {
        var gf = FormApp.openByUrl(toEditUrl(configObj.formActionUrl));
        configObj._closed = !gf.isAcceptingResponses();
      } catch(e) {}
    }
    var token = Utilities.base64EncodeWebSafe(JSON.stringify(configObj));
    var liveUrl = RENDERER_URL + "?f=" + token;
    // Write live link DIRECTLY to Sheet1!A1
    // Use _formEditUrl (real form ID) not formActionUrl (published ID)
    var editUrl = configObj._formEditUrl || (configObj.formActionUrl ? toEditUrl(configObj.formActionUrl) : null);
    if (editUrl) {
      var f2 = FormApp.openByUrl(editUrl);
      var destId2 = f2.getDestinationId();
      if (destId2) {
        var ss2 = SpreadsheetApp.openById(destId2);
        var sheet2 = ss2.getSheetByName("Sheet1") || ss2.insertSheet("Sheet1");
        sheet2.getRange("A1").setValue(liveUrl);
      }
    }
    return { success: true, liveUrl: liveUrl, token: token };
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
    var f = FormApp.openByUrl(toEditUrl(formUrl));
    f.setAcceptingResponses(accepting);
    // Write status to Sheet1!A2 so renderer can check
    try {
      var did = f.getDestinationId();
      if (did) {
        var ss = SpreadsheetApp.openById(did);
        var sheet = ss.getSheetByName("Sheet1");
        if (sheet) sheet.getRange("A2").setValue(accepting ? "OPEN" : "CLOSED");
      }
    } catch(e2) {}
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

function saveFormToList(formUrl, title) {
  var props = PropertiesService.getUserProperties();
  var list = JSON.parse(props.getProperty('form_list') || '[]');
  var id = extractId(formUrl);
  if (!title || !title.trim()) {
    try { title = FormApp.openByUrl(toEditUrl(formUrl)).getTitle(); } catch(e) {}
  }
  if (!title || !title.trim()) title = 'Form ' + (id ? id.substring(0, 8) : 'Baru');
  list = list.filter(function(f) { return f.id !== id; });
  list.unshift({ id: id, url: formUrl, title: title, savedAt: new Date().toISOString() });
  if (list.length > 20) list = list.slice(0, 20);
  props.setProperty('form_list', JSON.stringify(list));
  return { success: true, list: list };
}

function getFormClosedStatus(formUrl) {
  var id = extractId(formUrl);
  if (!id) return { success: false };
  // Check UserProperties first
  var status = PropertiesService.getUserProperties().getProperty('form_status_' + id);
  if (status === 'closed') return { success: true, closed: true };
  // Also check the form itself
  try { return { success: true, closed: !FormApp.openByUrl(toEditUrl(formUrl)).isAcceptingResponses() }; } catch(e) {}
  return { success: true, closed: false };
}

function getFormList() {
  var list = JSON.parse(PropertiesService.getUserProperties().getProperty('form_list') || '[]');
  // Filter out deleted/trashed forms
  var cleaned = [];
  for (var i = 0; i < list.length; i++) {
    try {
      var f = FormApp.openByUrl(toEditUrl(list[i].url));
      // Check if file is trashed
      var isTrashed = false;
      try { isTrashed = DriveApp.getFileById(f.getId()).isTrashed(); } catch(e2) {}
      if (!isTrashed) cleaned.push(list[i]);
    } catch(e) {}
  }
  if (cleaned.length < list.length) {
    PropertiesService.getUserProperties().setProperty('form_list', JSON.stringify(cleaned));
  }
  return { success: true, list: cleaned };
}

function saveFormLiveLink(formUrl, liveUrl) {
  PropertiesService.getUserProperties().setProperty('live_' + extractId(formUrl), liveUrl);
  return { success: true };
}

function writeLiveLinkToSheet(formUrl, liveUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var destId = form.getDestinationId();
    if (destId) {
      var ss = SpreadsheetApp.openById(destId);
      var sheet = ss.getSheetByName("Sheet1") || ss.insertSheet("Sheet1");
      sheet.getRange("A1").setValue(liveUrl);
      return { success: true };
    }
    return { success: false, message: "No linked Sheet" };
  } catch(e) { return { success: false, message: e.toString() }; }
}
function readLiveLinkFromSheet(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    var destId = form.getDestinationId();
    if (destId) {
      var ss = SpreadsheetApp.openById(destId);
      var sheet = ss.getSheetByName("Sheet1");
      if (sheet) {
        var val = sheet.getRange("A1").getValue();
        if (val && String(val).indexOf("http") === 0) return { success: true, liveUrl: String(val) };
      }
    }
    return { success: false };
  } catch(e) { return { success: false, message: e.toString() }; }
}


function getFormLiveLink(formUrl) {
  var liveUrl = PropertiesService.getUserProperties().getProperty('live_' + extractId(formUrl));
  if (liveUrl) return { success: true, liveUrl: liveUrl };
  return { success: false };
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
