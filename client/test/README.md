# Frontend regression tests

Run the existing component tests with `node --test test/*.test.cjs`.

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
