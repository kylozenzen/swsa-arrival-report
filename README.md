# Arrival Desk 3.3 — Shared Tour Admin

This build keeps daily PDF/report/guest data in browser memory while storing only the shared tour configuration in Netlify Blobs.

## Deploy

1. Put these files in the Netlify-connected repo (or deploy the folder).
2. In Netlify, use `SHIFT_ADMIN_PASSWORD` (recommended if this shares a site with Shift Report) or `ARRIVAL_DESK_ADMIN_PASSWORD`. Either is accepted. Give it Functions scope if your plan exposes scopes. Do **not** put the password in `netlify.toml` or `index.html`.
3. Deploy.
4. Open Arrival Desk, click **Admin**, enter the password, edit tours, and click **Save shared changes**.

The first deploy uses the built-in tour configuration. The first admin save creates the shared `tour-config-v1` Blob. After that, every load reads the shared configuration.

## Privacy behavior

- PDF bytes, OCR output, guest names, emails, phone numbers, reservation data, checklist state, and report crops are not sent to the tour-config function.
- Report data lives in JavaScript memory only and disappears on refresh/close.
- The shared Blob contains tour configuration only.

## Admin fields

Each tour can be enabled/disabled or removed, renamed, matched against report text, enabled for Operational/Non-Operational days, given fixed/report-relative check-in rules, call notes, direction-attachment behavior, Security roundup gate/time behavior, and either an existing branded email template or a custom email subject/body.

## Local HTML behavior

If `index.html` is opened with `file://`, the built-in tour defaults still load, but shared Admin editing is intentionally unavailable because Netlify Functions/Blobs require the deployed site.


## v3.1 UI note

The public header no longer shows tour-config loading/shared/fallback status. The fallback remains automatic and silent for desk users; configuration errors are surfaced only inside Admin where they are actionable.


## v3.2 password compatibility

The admin backend accepts either `SHIFT_ADMIN_PASSWORD` or `ARRIVAL_DESK_ADMIN_PASSWORD`, trims accidental leading/trailing spaces, and reports a missing Netlify environment variable separately from an incorrect password.

## Download an offline copy with the latest tours

On the deployed Arrival Desk, open **Admin**, unlock it, and click **Download offline copy**. The tool first reloads the latest saved shared tour configuration, then downloads a fresh HTML file with those tours baked in as its local defaults.

The downloaded HTML keeps report and guest data local. Note: PDF.js and Tesseract are still loaded from their CDN URLs, so the HTML can be opened as a local file but requires internet access to load those libraries unless they are bundled separately.
