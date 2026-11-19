# HowTo Repeater

The Repeater is a control that draws one copy of a view for every item of a list (a "template" view repeated
per item). The list comes from a **Repeater data** source: a URL returning JSON or CSV, or an SQL query on a
DAQ storage or on the FUXA App DB. Typical uses: one card per device, per sensor of a GIS service, per row of a
database table.

## 1. Create the Repeater data

Editor → **Setup** → **Repeater data** → add a data source (name) and a **line** in it. The Repeater uses the
first line of the source. A line has a **Type**:

**URL**

| Field | Meaning |
|---|---|
| URL | `https://...` used as is (a GitHub `.../blob/...` file page is mapped to the raw file). A relative path (`/gis/rest/...`) goes to the FUXA server, e.g. to a [proxy](#proxies) |
| Data type | `JSON` (default) or `CSV` |
| Data properties | comma separated item fields to use, e.g. `name,city,value`. Empty: every field of the item |
| Data path | JSON only, dotted path to the items inside the response, e.g. `data` or `result.items`. Empty: the whole JSON |

Example: URL `https://raw.githubusercontent.com/sharmadhiraj/free-json-datasets/refs/heads/master/docs/climate-weather/countries_by_average_annual_precipitation.json`,
data type `JSON`, data path `data`, data properties `rank,country,average_annual_precipitation_mm,continent`.

- JSON: the items are the array (or the values of the object) found at the data path.
- CSV: the first row is the header, every following row is an item keyed by the header. The delimiter
  (`,` `;` or tab) is detected from the header, quoted fields (RFC 4180) are supported.

To read an external service without CORS problems use a [proxy](#proxies).

**DB**

| Field | Meaning |
|---|---|
| DAQ | the storage the query runs on: the DAQ SQLite databases (one per device) or **FUXA App DB** |
| SQL | a read-only query, every row is an item and every column a field |

The SQL runs on the server **from the saved project**: after editing a line, save the project before testing
it in the view. Queries are read-only (the SQLite databases are opened read-only) and
`ATTACH` of other databases is blocked.

DAQ SQLite example (last values with the tag names, the tags map is attached as `map`):

```sql
SELECT m.name, d.value, d.dt FROM data d JOIN map.data m ON m.mapid = d.id ORDER BY d.dt DESC LIMIT 50
```

### FUXA App DB

The **FUXA App DB** entry reads the FUXA application data (`alarms.fuxap.db`, plus the existing optional ones):

| Table | Content |
|---|---|
| `alarms`, `chronicle` | active alarms and alarm history |
| `notifications.<table>` | notifications (if `notifications.fuxap.db` exists) |
| `recipes.recipes` | recipes (if `recipes.db` exists) |
| `scheduler.schedulers` | scheduler (if `scheduler.db` exists) |
| `devices` | the devices of the running project (built on every query) |

Users, API keys and the project database (passwords and credentials) are not accessible.

`devices` columns: `id`, `name`, `type`, `enabled` (1/0), `polling`, `address`, `port`, `slaveid`,
`tags` (number of tags), `status` (e.g. `connect-ok`), `tagList`.

`tagList` is an object with the tags of the device keyed by tag name, with the current values:

```json
{ "Temperature": { "id": "t1", "name": "Temperature", "label": null, "type": "Float32", "address": 1, "value": 21.5, "timestamp": 1732000000000 } }
```

```sql
-- one item per device, with its tags (live values and colors in the template: @tags.Temperature)
SELECT id, name AS device, type, status, tagList AS tags FROM devices WHERE enabled = 1 ORDER BY name

-- one item per tag (values at query time)
SELECT d.name AS device, t.key AS tag, json_extract(t.value, '$.value') AS value
FROM devices d, json_each(d.tagList) t

-- the tags of the devices whose id starts with 'd_' grouped by device, keeping the whole entries (live)
SELECT d.id, d.name AS device, json_group_object(t.key, json(t.value)) AS tags
FROM devices d, json_each(d.tagList) t
WHERE d.id LIKE 'd\_%' ESCAPE '\' AND d.enabled = 1
GROUP BY d.id ORDER BY d.name
```

Only whole tag entries (objects with `id` and `value`) are live in the template: with
`json_extract(t.value, '$.value')` only the value at query time is kept.

Text values of App DB rows that look like JSON (`{...}` or `[...]`, e.g. `tagList` or your own
`json_object(...)` columns) are returned as objects. Note: in `LIKE`, `_` is a wildcard
(use `LIKE 'd\_%' ESCAPE '\'` for a literal underscore).

## 2. Create the template view

Create a view with the size of one item (e.g. a card) and add the controls showing the item fields:

- **Output / value controls**: set the tag of the control to `@<field>`, e.g. `@name`. Nested fields use a
  dotted path: `@tagList.Temperature.value`, `@tagList.Run.Status.value` (tag names with dots work too).
  An object field without path (`@tagList`) is shown as JSON.
- **Live tag values**: when the bound field is a tag entry (an object with `id` and `value`, as the entries of
  `devices.tagList`), the control shows the current value of that tag and is updated live. With
  `SELECT d.id, d.name AS device, d.tagList AS tags FROM devices d` use `@tags.Temperature`
  (or `@tags.Temperature.value`). Other fields of the entry (`@tags.Temperature.type`) are static.
  Fields with JSON text (e.g. from a URL source) are decoded, so the paths work on them too.
- **Colors by tag value**: a control of the template bound to a tag entry (tag field `@tags.Temperature`, also
  in its actions) works in every item like in a view: Value with ranges (text color), Shapes / Semaphore /
  Progress with ranges (fill and stroke colors), actions (hide, show, blink, ...). E.g. draw a rectangle as item
  background, set its tag to `@tags.Alarm` and its ranges `0 → green`, `1 → red`.
- **Text**: a text whose content is `@<field>` is replaced with the item field value.
- **Events**: the events of the template controls work for each item. *Open view / dialog / card* events get
  the item fields as placeholder values (`@country` → item.country, objects as JSON), so the opened view can
  show them in controls bound to `@country`. CLIENT scripts are run on click.
- **Tags in the opened view**: an object field is passed as JSON (`@tags`). In the opened view a control bound
  to a path of it that is a tag entry, e.g. `@tags.Temperature`, is decoded and bound to that tag: it shows
  the live value like a control bound directly to the tag (format, ranges, actions and events included).

The template view must not contain the Repeater itself (a Repeater cannot repeat the view it is placed in).

## 3. Place the Repeater

In the view, draw a **Repeater** (editor toolbar) and set its properties:

| Property | Meaning |
|---|---|
| Name | name of the control |
| Repeater data | the data source (or create a new one) |
| Property to show | item field used as fallback text for `@` texts without a value |
| View | the template view |

Several Repeaters can be placed in the same view.

In the running view the Repeater shows a search input on top (it stays visible while the items scroll):
only the items containing the text are shown (case insensitive, in any field or text).

Example: one card per Modbus device with its state.

1. Repeater data line, type DB, DAQ **FUXA App DB**:
   `SELECT id, name AS device, status, tagList AS tags FROM devices WHERE type = 'ModbusTCP' ORDER BY name`
2. Template view `Device card`: a rectangle as background with tag `@tags.Alarm` and ranges `0 → green`,
   `1 → red`; an Output with tag `@device`; an Output with tag `@tags.Temperature` (format 1 decimal, unit °C);
   a click event *Open dialog* on the rectangle with the view `Device details`, where an Output with tag
   `@tags.Pressure` shows the live pressure of the clicked device.
3. In the main view draw a Repeater with this data and the view `Device card`.

## Proxies

To use an external HTTP service from the views (Repeater URL, iframe, scripts) without CORS problems, add a
reverse proxy in `server/_appdata/settings.js` (restart the server) and use the relative path:

```js
proxies: [
    { path: '/gis', target: 'https://gis.example.com/gis' },
    { path: '/weather', target: 'http://10.0.0.5:8080', headers: { 'x-api-key': 'KEY' }, timeout: 10000 }
],
```

A request to `http://<fuxa>/gis/rest/query?f=json` is forwarded to `https://gis.example.com/gis/rest/query?f=json`.
FUXA credentials (cookie, authorization, x-access-token) are never forwarded. Optional per proxy: `headers`,
`timeout` (ms, default 30000), `rejectUnauthorized: false` for self-signed certificates.
