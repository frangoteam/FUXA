# FUXA AR Mode

## Goal
Browser-based AR mode for tablets.
The camera detects physical plant markers and displays live FUXA cards/gauges linked to marker IDs.

## MVP Decision
First pass uses a dedicated `/ar` route with camera feed and lightweight live tag cards.
No full SVG View rendering.
No backend changes.
No native app.

## Proposed MVP Stack
- Angular fullscreen route
- Browser `getUserMedia`
- Browser `BarcodeDetector` for first QR/barcode prototype
- FUXA `hmiService.viewsTagsSubscribe(tags, true)`
- FUXA `hmiService.onVariableChanged`

## Later AR Tracking
Replace/extend BarcodeDetector with:
- MindAR for image tracking
- or AR.js for marker tracking

## Files
- `client/src/app/_models/ar.ts`
- `client/src/app/_models/project.ts`
- `client/src/app/ar/ar.component.ts`
- `client/src/app/ar/ar.component.html`
- `client/src/app/ar/ar.component.scss`
- `client/src/app/app.routing.ts`
- `client/src/app/app.module.ts`
- `client/src/app/app.component.ts`

## MVP Scope
- `/ar` route
- fullscreen camera
- marker detection
- markerId → tag card
- live values update
- no editor UI yet

## Open Questions
- Marker format
- Operator auth behavior
- Multi-marker behavior
- Safari/iPad support
- MindAR integration after MVP