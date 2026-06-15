// ⏱ 2026-06-15 22:56 WIB — forceAuth + forms scope fix
/**
 * PROJECT 2: NERD STUDIO FORM PORTAL RENDERER
 * ============================================
 * Stateless White-Label SaaS Engine.
 *
 * Execute As: Me (Owner)
 * Access: Anyone
 *
 * Menerima parameter URL ?f=<base64_token>, mendekripsi instruksi UI,
 * menginjeksi data wilayah hardcode, dan me-render form untuk User B.
 * Zero database. Zero DriveApp. Zero external API.
 */

function doGet(e) {
  var context = {
    ok: false,
    html: null,
    error: null
  };

  if (!e || !e.parameter || !e.parameter.f) {
    return HtmlService.createHtmlOutput(
      '<div style="padding:2rem;font-family:system-ui;text-align:center;max-width:480px;margin:4rem auto;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">⚡</div>' +
      '<h2 style="color:#0f172a;">Nerd Studio Form Portal Renderer</h2>' +
      '<p style="color:#64748b;">SaaS Engine Active — awaiting configuration token.</p>' +
      '<p style="color:#94a3b8;font-size:0.8rem;margin-top:2rem;">Back to <a href="https://nerdstudio.online" style="color:#3b82f6;">nerdstudio.online</a></p>' +
      '</div>'
    );
  }

  try {
    // Dekripsi base64 token dari URL
    var decodedBytes = Utilities.base64DecodeWebSafe(e.parameter.f);
    var decodedString = Utilities.newBlob(decodedBytes).getDataAsString();
    var configObj = JSON.parse(decodedString);

    // Proteksi null/undefined
    if (!configObj.branding) configObj.branding = {};
    if (!configObj.regions) configObj.regions = {};
    if (!configObj.fields) configObj.fields = [];

    // Check if form is closed via FormApp (same user = no permission issue)
    var isClosed = false;
    if (configObj._formEditUrl) {
      isClosed = !FormApp.openByUrl(configObj._formEditUrl).isAcceptingResponses();
    }
    if (isClosed) {
      var ct = configObj.branding.title || 'Form';
      return HtmlService.createHtmlOutput(
        '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+ct+'</title>' +
        '<style>body{background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;text-align:center}' +
        'h1{font-size:1.8rem;margin:0 0 .5rem}</style></head><body><div>' +
        '<div style="font-size:4rem;margin-bottom:1rem;">🔒</div>' +
        '<h1>'+ct+'</h1><p style="color:#94a3b8;font-size:1rem;">Form sudah ditutup dan tidak menerima respons baru.</p>' +
        '<p style="color:#64748b;font-size:.8rem;margin-top:2rem;">— Nerd Studio Form Constructor</p></div></body></html>'
      ).setTitle(ct);
    }

    // Inject data wilayah hardcode
    var template = HtmlService.createTemplateFromFile('form_render');
    template.config = configObj;
    template.dataProv = PROVINSI;
    template.dataKab = KABKOTA;
    template.dataKec = KECAMATAN;

    return template.evaluate()
      .setTitle(configObj.branding.title || 'Form')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="padding:2rem;font-family:system-ui;max-width:540px;margin:4rem auto;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">' +
      '<h2 style="color:#dc2626;">Configuration Error</h2>' +
      '<p style="color:#7f1d1d;font-size:0.9rem;">' + err.message + '</p>' +
      '<small style="color:#991b1b;display:block;margin-top:0.5rem;">Line: ' + (err.lineNumber || 'N/A') + '</small>' +
      '</div>'
    );
  }
}


// Force OAuth scope detection — run this once from editor to trigger Forms permission
function forceAuth() { FormApp.getActiveForm(); }

// ── Test Endpoint (debugging) ──────────────────────────────────────
function testRender() {
  var testConfig = {
    branding: {
      title: "Test Form Generator",
      themeStyle: "dark"
    },
    regions: {
      provinsi: true,
      kabkota: true,
      kecamatan: true
    },
    formActionUrl: "https://docs.google.com/forms/d/e/test/formResponse",
    fields: [
      { label: "Nama Lengkap", entry: "entry.123456789" }
    ]
  };

  var encoded = Utilities.base64EncodeWebSafe(JSON.stringify(testConfig));
  return "https://script.google.com/macros/s/" + ScriptApp.getScriptId() + "/exec?f=" + encoded;
}
