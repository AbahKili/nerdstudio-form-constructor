/**
 * PROJECT 1: NERD STUDIO DASHBOARD GENERATOR
 * ===========================================
 * Stateless White-Label Compiler Engine.
 *
 * Execute As: User accessing the web app
 * Access: Anyone with Google account
 *
 * User A login dengan akun Google mereka, membuat form,
 * dan mendistribusikan link ke User B.
 * Owner TIDAK memiliki akses ke Google Form/Spreadsheet User A.
 */

// GANTI dengan URL Web App Project 2 (Renderer)
var RENDERER_URL = "https://script.google.com/macros/s/PASTE_RENDERER_DEPLOY_ID_HERE/exec";

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Nerd Studio — Form Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Membuat Google Form baru di Drive User A.
 * Owner TIDAK bisa akses form ini — murni milik User A.
 */
function autoCreateGoogleForm(formData) {
  try {
    var form = FormApp.create(formData.title || 'Form Baru');
    form.setCollectEmail(false);
    form.setDescription(formData.description || 'Dibuat oleh Nerd Studio Form Generator');

    (formData.fields || []).forEach(function(f) {
      var item;
      switch (f.type) {
        case 'paragraph':
          item = form.addParagraphTextItem();
          break;
        case 'choice':
          item = form.addMultipleChoiceItem();
          if (f.options) item.setChoices(f.options.map(function(o) { return item.createChoice(o); }));
          break;
        default:
          item = form.addTextItem();
      }
      item.setTitle(f.label).setRequired(f.required !== false);
    });

    return { success: true, url: form.getPublishedUrl(), id: form.getId() };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * Menganalisis struktur Google Form dari URL publik.
 */
function parseGoogleForm(formUrl) {
  try {
    var html = UrlFetchApp.fetch(formUrl, { muteHttpExceptions: true }).getContentText();
    var match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);/s);
    if (!match) throw new Error("Struktur form tidak terbaca. Pastikan URL viewform valid.");

    var data = JSON.parse(match[1]);
    var questions = data[1][1];
    var formActionUrl = formUrl.replace(/\/viewform.*/, '/formResponse');

    var fields = [];
    questions.forEach(function(q) {
      var title = q[1];
      var entryId = '';
      try { entryId = q[4][0][0]; } catch (e) {}
      if (entryId && title) {
        fields.push({ label: title, entry: 'entry.' + entryId, type: 'text' });
      }
    });

    return { success: true, formActionUrl: formActionUrl, fields: fields };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * Generate Base64 token untuk dikirim ke Project 2.
 */
function generateLiveSaaSLink(configObj) {
  try {
    var json = JSON.stringify(configObj);
    var token = Utilities.base64EncodeWebSafe(json);
    var finalUrl = RENDERER_URL + "?f=" + token;
    return { success: true, liveUrl: finalUrl, token: token };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
