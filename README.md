# Nerd Studio Form Constructor

Two-project stateless Google Apps Script architecture for white-label form generation with Indonesian administrative region dropdowns.

## Architecture

```
Project 1 (Dashboard)          Project 2 (Renderer)
┌──────────────────┐           ┌──────────────────────┐
│ User A creates   │──Base64──▶│ Stateless rendering  │
│ Google Form      │  token    │ + wilayah dropdowns  │
│ Execute As: User │           │ Execute As: Me       │
└──────────────────┘           └─────────┬────────────┘
                                         │
                                  User B fills form
                                  POST → Google Form User A
```

## Project 1 — Dashboard Generator

- **Code.gs**: FormApp.create(), parseGoogleForm(), generateLiveSaaSLink()
- **index.html**: Tailwind UI with form builder, region selector, multi-page management
- **Deploy**: Execute As: User accessing | Access: Anyone with Google

## Project 2 — Form Portal Renderer

- **Code.gs**: doGet() — decode base64 token, inject wilayah data, render template
- **form_render.html**: Client-side dynamic multi-page form with dependent dropdowns
- **provinsi.gs**: 38 provinces (1 KB)
- **kabkota.gs**: 514 regencies/cities (29 KB)
- **kecamatan.gs**: 7,265 districts (360 KB)
- **Deploy**: Execute As: Me | Access: Anyone

## Data Source

Wilayah data from Kepmendagri No 300.2.2-2430/2025 via github.com/cahyadsn/wilayah

## Key Features

- Dynamic multi-page forms (unlimited pages)
- Dependent dropdowns: Provinsi → Kab/Kota → Kecamatan
- Chrome autofill compatible
- Direct POST to Google Form (zero-knowledge — owner never sees user data)
- Dark/light/corporate themes
- Tailwind CSS + SweetAlert2 + Font Awesome
- Zero database, zero DriveApp, zero external API calls
