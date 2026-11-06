To add a **Chart** Control to a View:: going in editor and select the View.
![](images/fuxa-chart.gif)

In **Line charts** you can define your diagrams to be attached to the chart control.
![](images/setup-charts.png)

## Machine states alongside trends

Add the numeric and state tags to the same chart in **Line charts**. Edit each state
tag and change **Series type** to **Machine state**. The series label names its lane.
Numeric trends keep their existing colors, interpolation and Y-axis settings.

Use **Add state** to map a tag value to a label, color and optional description. For
example, map `0` to **Stopped** in red, `1` to **Running** in green and `2` to
**Setup** in orange. Match the values supplied by the tag: `true`/`false` for
booleans, or `0`/`1` for tags that encode them as numbers. Values are compared as
text, so numeric `1` and string `"1"` use the same mapping. Each mapping value must
be unique. Unmapped values, including recipe names, appear as their original text
with the default state color. Hover over an interval to read its full label and
description when it is too narrow to display the text.

Each state continues until the next recorded state change. Repeated samples of the
same value form one interval. A missing sample in another series does not interrupt
the state; an explicit null value marks a gap. Millisecond timestamps are retained.

State lanes share the trend's time range: zooming or panning the trend, changing the
history range, or refreshing updates all lanes together. If mouse-wheel navigation
is enabled, it also works over the state lanes. Multiple lanes can be scrolled
vertically without reducing the numeric plot to an unreadable height.

For historical charts, enable DAQ recording for the state tags. A lane starts at
the first state sample returned for the selected range: the chart does not guess
a state before that sample. Live charts retain the last known state when older
samples leave the visible time window. Existing projects remain numeric trends
unless a series is explicitly changed to **Machine state**.

### Runnable example

Download [machine-states.fuxap](examples/machine-states.fuxap) and open it with the
editor's **Open Project** command in a separate test instance. Opening a project
replaces the currently loaded project; export your existing project first.

1. Use a build containing the machine-state chart feature.
2. Open the example, then switch to **Home**. No PLC or external device is needed.
3. Wait at least 30 seconds. The server script updates the temperature every second,
   cycles **Stopped**, **Running**, and **Setup** every 10 seconds, and alternates
   **Recipe A** and **Recipe B** every 20 seconds.
4. Check that the blue temperature trend appears above two labeled state lanes.
   Hover over a machine-state interval to see its description. Scroll the mouse
   wheel over a lane to zoom the shared time axis.
5. Reload Home. DAQ recording is enabled for all three tags and **Load old values**
   is enabled, so the recent history should reappear. The live window is two minutes.

The mappings are stored in **Line charts** → **Temperature, machine state and
recipe**. The first series is numeric; the other two use **Machine state**. The
recipe series intentionally has no mappings, demonstrating string values displayed
as their original text. In the editor, charts show preview data; use Home to check
the actual simulated values. The `updateMachineStates` server script supplies the
example values and can be disabled or removed after testing.
