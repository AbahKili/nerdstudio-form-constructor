/**
 * PROJECT 1: NERD STUDIO FORM CONSTRUCTOR
 * Execute As: User accessing | Access: Anyone with Google
 */

// UPDATE this whenever renderer is redeployed
var RENDERER_URL = "https://script.google.com/macros/s/AKfycbxUr-3dcJ298LyJzPhta4wI8KbhOxrBDQ_JWCF0WSnbNI5ExeZYsn5tmiuusMADSEbP/exec";

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
      var sheetName = formData.title || form.getTitle() || 'Form Responses';
      var ss = SpreadsheetApp.create(sheetName + ' — Responses');
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

// ═══ FORM STATUS ══════════════════════════════════════════════

function extractId(url) {
  var m = url.match(/\/d\/(?:e\/)?([^/]+)/);
  if (!m || m[1] === 'e') return null;
  return m[1];
}

function toEditUrl(url) {
  var id = extractId(url);
  if (!id) return url;
  return 'https://docs.google.com/forms/d/' + id + '/edit';
}

function getFormStatus(formUrl) {
  try {
    var form = FormApp.openByUrl(toEditUrl(formUrl));
    return { success: true, accepting: form.isAcceptingResponses(), title: form.getTitle() || '', responseCount: form.getResponses().length };
  } catch (err) { return { success: false, message: err.toString() }; }
}

function toggleFormStatus(formUrl, accepting) {
  try {
    FormApp.openByUrl(toEditUrl(formUrl)).setAcceptingResponses(accepting);
    return { success: true, accepting: accepting };
  } catch (err) { return { success: false, message: err.toString() }; }
}
