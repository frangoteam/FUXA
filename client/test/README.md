# Frontend regression tests

Run the existing component tests with `node --test test/*.test.cjs`.

Run `npm run test:tag-paste` to verify that pasting one uniquely matching tag
name binds it in both tag autocomplete controls. The test also covers ambiguous
and unknown names and retains normal autocomplete selection. It executes the
shipped component methods with controlled Angular and device-service boundaries;
full editor rendering, live devices and clipboard behavior on physical browsers
remain outside this test.

The SVG color tests use the real shipped SVG canvas and the application's
`EditorComponent`, `GaugesManager`, `HtmlImageComponent`, `SvgUtils` and `Utils`
methods in Chromium. Angular decorators and unrelated services/controls are
stubbed; the SVG DOM, color editing, widget import, scripts, serialization and
undo manager are real.

```sh
npm ci
npx playwright install chromium
npm run test:svg-colors
```

Set `FUXA_TEST_BROWSER=chrome` or `msedge` to use an installed browser instead.
Set `FUXA_SCREENSHOT_DIR` to save background-edit screenshots. To also check the
original [issue #2472 attachment](https://github.com/frangoteam/FUXA/issues/2472),
download its `Test.json` and set `FUXA_ISSUE_FIXTURE` to that file's absolute path.
One widget in the attachment already contains corrupted colors; the test checks
that editing either widget does not further change its artwork.
