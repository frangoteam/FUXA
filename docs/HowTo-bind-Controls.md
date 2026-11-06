To bind a **Output** Control to the Device Tag (Variable): going in editor and select the View.
![](images/fuxa-output-control.gif)

To bind a **Input** Control to Device Tag.
![](images/fuxa-input-control.gif)

To bind a **Select** Control to Device Tag.
![](images/fuxa-select-control.gif)

To bind a **Slider** Control to Device Tag.
![](images/fuxa-slider-control.gif)

## Switch

Bind a **Switch** to the Tag it should control in the **Properties** tab. The
Switch displays the Tag's state and writes its configured **On Value** or
**Off Value** when operated. No **Toggle Value** click event is required.

Do not add a **Toggle Value** click event targeting the same Tag (and the same
bits when using a bitmask). Both the binding and the event write the Tag, so the
event can undo the Switch's change. Remove the duplicate event and keep the
binding.

For an event-driven toggle, use a shape or button with a
[Toggle Value event](HowTo-configure-events.md#toggle-value) and select its
target Tag. A bound Switch can still run scripts, navigate, or toggle a
different Tag or different bits through events.
