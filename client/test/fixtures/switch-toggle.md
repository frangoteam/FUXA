# Switch click Toggle regression (#2554)

`switch-toggle.fuxap` contains two internal boolean tags, initialized to `false`
and `true`. Each tag is shared by two switches and a value display. Every switch
has a click / Toggle Value event using its bound tag. No PLC or backend is needed.

For a browser-only reproduction:

1. Back up `src/assets/project.demo.fuxap` and replace it with this fixture.
2. Run `npm run demo` from `client` and open the displayed local URL. Use a fresh
   browser profile (the demo can load a previously saved project from storage).
3. Click either switch in the initially false row. Both switches must show ON,
   and the value display must read `1` after this single click.
4. Click its peer. Both switches must show OFF and the value must read `0`.
5. Repeat with the initially true row; its first click must produce OFF / `0`.
6. Press Space on a focused switch. Both switches and the displayed value must
   follow the same toggle. Repeat clicks on either peer, then reload and verify
   the initial states and first click again.
7. Restore the original demo asset when finished. Do not commit that replacement
   or generated build output.

On the affected code, checkbox change writes the new value before the deferred
click Toggle reads it and writes the opposite value. In this fixture the value
returns to its original state on each click. This demonstrates the conflicting
write paths; it does not reproduce the exact second-click timing in the original
Safari video, whose project was not supplied.

Run `npm run test:switch-toggle` for the regression suite. It executes the real
switch, gauge manager, view event handling, models and HMI service, with Angular
decorators, unrelated UI modules, DOM references and device transport stubbed.
The browser check covers the real Angular template and native event ordering.
The simulated device transport checks one command per click and delayed server
echoes separately from optimistic local state. Physical PLC and Safari testing
are outside this fixture's coverage.
