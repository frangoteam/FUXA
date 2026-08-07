# HowTo Recipes

Recipes are pre-defined sets of tag values that can be applied to devices on demand. A recipe captures the operating parameters of a machine or process (temperature setpoints, durations, quantities) and lets an operator push those values to the device with a single action (download), or capture the current device values back into a recipe for later reuse (upload).

## Overview

FUXA distinguishes between two kinds of recipes:

- **Recipe Types**: Templates that define which tags participate and what their default values are. Types are created and maintained in the Recipes management page.
- **Recipe Instances**: Concrete copies of a type, each with its own values for the type's tags. The Recipe widget is bound to a type, but displays and operates on that type's instances.

Key features include:

- **Download**: Write all tag values of a recipe to their devices, one entry at a time, with live progress reporting
- **Upload**: Read current device values back into a recipe and persist them
- **Recipe Types**: Reusable templates for sets of tag entries
- **Recipe Instances**: Independent copies of a type, each holding its own values
- **Recipe Widget**: Operator-facing widget bound to a recipe type, with create/edit/delete/download/upload actions
- **Export/Import**: Share recipes as JSON or CSV files
- **Cancellation**: Stop a running download or upload at any time
- **Authorization**: Role-based control over who can manage recipes and interact with the widget

## Recipe Types and Instances

A **recipe type** is the master template. It has a name, an optional description, and a list of tag entries (tag id, tag name, tag type, and a default value). Types are the units that appear in the Recipes management page and in the widget's property panel.

A **recipe instance** is a concrete snapshot derived from a type. Instances share the type's tag set but each one stores its own values, so different products or batches can be saved as separate instances of the same type. An instance is linked to its type through a `typeId` reference; recipes without a `typeId` are types.

## Managing Recipes

Recipes are managed from the Recipes management page. It is reached through the setup card **Recipes** (bookmarks icon, menu label "Recipes") in the editor, which opens the `/recipes` route.

### Recipe List

The page lists all recipe types in a table with **Name**, **Description**, **Entries** and **Actions** columns. Recipes are sorted by name (case-insensitive). From the list you can:

- **Add a recipe type**: Opens the recipe editor dialog for a new type
- **Edit**: Opens the recipe editor dialog pre-filled with the selected type
- **Delete**: Removes the type after a confirmation prompt (requires a non-guest role, see Authorization)
- **Download**: Pushes the recipe's values to its devices
- **Upload**: Reads the current device values back into the recipe
- **Export**: Downloads the recipe as a JSON or CSV file
- **Import**: Loads a recipe from a JSON or CSV file

### Recipe Editor Dialog

The editor dialog lets you define or change a recipe type:

- **Name**: Required, up to 128 characters
- **Description**: Optional, up to 512 characters
- **Entries**: A table of tag entries with tag name, tag id and tag type; at least one entry is required

Use **Add entry** to open the tag browser and pick tags from your project's devices, and the remove button to drop an entry. Saving requires a name and at least one entry.

### Tag Browser

The tag browser helps select the tags a recipe entry should reference. It lists the devices of the current project; after selecting a device you see its tags and can filter by tag name or id. Selecting a tag adds it to the recipe with its name and type.

### Download, Upload and Progress

Clicking **Download** or **Upload** on a recipe opens a progress dialog (it cannot be closed while an execution is running) that shows:

- The current entry being processed and its status (writing/reading, success, error)
- A progress bar with the percentage completed
- The per-entry error messages, if any
- The final success and error counts

The dialog has a **Cancel** button that stops the running execution and a **Close** button once the execution has finished.

## The Recipe Widget

The Recipe widget is the operator-facing component for working with a recipe type directly in a view.

### Adding the Widget

In the editor's toolbar, select the **Recipe** control (bookmarks icon, tooltip "Recipe"). Drop it onto the view and open its properties.

### Widget Properties

The property panel of the widget offers:

- **Recipe**: Select the recipe type the widget is bound to. Instances of this type are shown at runtime. "No recipe selected" leaves the widget in an idle state.
- **Behavior**: Toggle **Read-only mode**. In read-only mode the widget hides the New, Delete and Save actions, shows values as read-only text, and only offers Download and Upload.
- **Authorization**: Configure which user roles may interact with the widget. The standard FUXA permission dialog is used; it controls both whether the action bar is shown and whether it is enabled.
- **Visible actions**: Independently show or hide the New, Delete, Save, Download and Upload buttons (visibility is independent of the permission setting).
- **Appearance**: Colors for the widget's background, text, border and accent.

### Runtime Operation

At runtime the widget loads all instances of the bound recipe type and displays them one at a time:

- **Navigation**: Previous/next buttons step through the instances, showing the current position (e.g. "2 / 5")
- **Entries**: The entries table shows each tag with a colored type badge and an editable value field (numeric fields use a number input, string values a text input)
- **New**: Creates a new instance of the type from a name/description dialog; the type's default entries are copied into it
- **Delete**: Removes the current instance after a confirmation prompt
- **Save**: Persists the edited values of the current instance
- **Download**: Saves any edited values first, then pushes the instance values to the devices and shows a progress bar ("Sending...")
- **Upload**: Reads the current device values into the current instance, shows progress, and refreshes the displayed entries when finished

In editor mode the widget renders inside the SVG canvas and permission checks are bypassed, so the designer can configure it freely.

## How Download and Upload Work

Both operations are asynchronous: the client starts them with a single API call and follows the live progress over WebSocket.

### Download (write to device)

1. The client calls `POST /api/recipes/download` with the recipe id
2. The server verifies the recipe exists, has at least one entry, and is not already running
3. It answers immediately with `202` and the total entry count, and continues in the background
4. For every entry the server coerces the stored value to the tag type and writes it to the device via `setTagValue`, emitting `recipe:download-progress` events with the status (`writing`, `success`, `error`), the entry index and the total
5. Entries that fail to write are reported individually and the loop continues; on completion a `recipe:download-complete` event carries the success/error counts and the error list

### Upload (read from device)

1. The client calls `POST /api/recipes/upload` with the recipe id
2. Validation is identical to download, and the server also answers `202` first
3. For every entry the server reads the current value from the device via `getTagValue` and updates the entry, emitting `recipe:upload-progress` events (`reading`, `success`, `error`)
4. If at least one entry succeeded, the updated values are persisted; a `recipe:upload-complete` event reports the outcome, and the client reloads the instance list

### Value Coercion

Values are converted to the correct JavaScript type before being written, according to the entry's tag type:

- **bool/boolean**: accepts booleans, `"true"`/`"1"` and `"false"`/`"0"`
- **int/dint/int16/int32**: parsed as integers
- **real/float/double/number**: parsed as floating point
- **byte**: clamped to the range 0-255
- **string/word**: passed through unchanged

### Cancellation and Concurrency

- A recipe that is already running cannot be started again; the API answers `400 "Recipe execution already in progress"`. This guard covers both download and upload of the same recipe.
- The client requests cancellation by emitting `recipe:cancel-execution` over WebSocket (requires write authorization). The server removes the recipe from the running set, the loop stops at the next entry, and a `recipe:cancel-confirmed` event is emitted.

## Authorization

Recipe authorization is enforced in two places:

- **Server (REST API)**: When secure mode is enabled, guest users receive `401` for all write operations — creating or editing (`POST /api/recipes`), deleting (`DELETE`), download, upload and import. Guests can still list and read recipes. Deleting a recipe therefore requires a non-guest role.
- **Recipe widget**: The permission configured in the widget's **Authorization** setting decides at runtime whether the action bar is shown and enabled. Editor mode always bypasses the check. The **Visible actions** setting is independent of the permission and only controls which buttons render.

## Data Storage

Recipes are stored in a SQLite database (`recipes.db` in the server working directory) in a `recipes` table with the recipe id, a JSON payload and creation/update timestamps.

- Recipe ids look like `r_` followed by 12 hex characters; entry ids like `e_` followed by 8
- Validation limits: name required (max 128 chars), description optional (max 512), between 1 and 1000 entries, every entry with a non-empty tag id and a valid tag type

## Usage Examples

### CIP (Clean-In-Place) Recipe Type

- Type: "CIP Cycle"
- Entries: temperature setpoint (real), caustic concentration (real), wash time (int), rinse time (int), pump speed (int)
- Instances: one per product — "Product A", "Product B", "Product C" — each with different setpoints

Before a production run the operator selects the product instance in the Recipe widget and presses **Download**. The server writes every value in order to the tank PLC; the widget shows the progress. When the line changes to another product, the operator picks a different instance and downloads it again.

### Capture Current Operating Values

An operator tunes the process manually and wants to keep the result. In the widget they select an instance and press **Upload**. The server reads the live values from the device into the instance, persists them, and the widget shows the new values. The instance can later be downloaded again to reproduce the same conditions.

## Best Practices

1. **Design types first**: define a recipe type for each machine or process, then create instances for the concrete parameter sets
2. **Keep entries manageable**: a recipe supports up to 1000 entries; split unrelated tags into separate types for clarity
3. **Verify device connectivity**: download/upload report per-entry failures, but a disconnected device fails every entry — check the device status first
4. **Use read-only mode for operator screens**: if operators should only apply values, enable read-only mode so the values cannot be edited in the view
5. **Limit the visible actions**: use the widget's visibility settings to show only the actions operators actually need
6. **Test with a single entry**: start with a small recipe to validate the flow before working with large ones

## Troubleshooting

### Common Issues

- **"Recipe execution already in progress"**: the recipe is still running (or a previous execution did not finish). Wait for it to complete or cancel it from the progress dialog.
- **"Write failed for tag" / "Read failed for tag"**: the device is not reachable or the tag id is no longer valid in the project.
- **Download completes with errors**: the per-entry error list in the progress dialog names the failing tags; check their values and types.
- **Guest cannot save or delete recipes**: when secure mode is enabled, write operations require a non-guest role.
- **Widget shows "No recipe type configured"**: open the widget properties and select a recipe type.
- **Widget action bar is hidden**: the configured authorization or the visible-actions settings are hiding the buttons; in editor mode the permission check is bypassed.

### Debug Information

Recipe operations log to the server console and log files with details about:

- Recipe data validation errors (invalid name, entries, tag types or values)
- Download/upload start, per-entry write/read results, and completion summaries
- Execution cancellations and unauthorized requests
- Storage errors (database access, JSON parsing)
