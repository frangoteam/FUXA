# noUiSlider vendored build

Upstream version: noUiSlider 15.8.1.

FUXA custom changes are kept in `nouislider.js` and then minified to
`nouislider.min.js`:

- `shape.baseColor`, `shape.connectColor`, and `shape.handleColor` style the
  slider base, connect segment, and handles.
- `shape.barWidth`, `shape.handleWidth`, and `shape.handleHeight` are applied by
  the Angular wrapper to set the slider bar thickness and handle size, keeping
  the handle centered.
- `marker.color`, `marker.subWidth`, `marker.subHeight`, `marker.divWidth`,
  `marker.divHeight`, and `marker.fontSize` style pips markers and values.
- `nouislider.min.css` appends the FUXA tooltip visibility rule so tooltips are
  hidden by default and shown while the handle is active, unless the wrapper
  forces them visible.
- `nouislider.min.css` removes the upstream handle and target borders, and
  removes handle inset shadows so the configured handle color renders flat,
  keeping only the FUXA outer shadow.

When updating noUiSlider, start from the upstream `dist/nouislider.js`, reapply
the marked `FUXA custom` blocks, then regenerate `nouislider.min.js`.
