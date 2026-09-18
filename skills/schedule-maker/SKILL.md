---
name: schedule-maker
description: Turn natural-language itineraries, event plans, and schedules into the schedule-maker schema, an editable web link, and a matching long image. Use when a user wants a schedule organized, visualized, or handed off to the schedule-maker webpage; do not use for ordinary calendar reminders or unrelated spreadsheets.
---

# Schedule Maker

Convert the user's source material into the website's structured schedule without inventing dates, times, people, places, or activities. Ask a question only when a missing fact would materially change the schedule; otherwise preserve uncertainty with a short label such as `待定`.

Read [references/schedule-schema.md](references/schedule-schema.md) before building the data. Keep rows in display order, repeat the date and card title on every row, keep rows for one card adjacent, and preserve useful emoji.

## Workflow

1. Build one JSON object matching the schema reference.
2. Save it to a temporary JSON file and run:

   ```text
   node scripts/prepare_schedule.mjs <input.json>
   ```

   Use the script's normalized `schedule` and `editUrl`; fix validation failures instead of bypassing them.
3. When the open webpage exposes `replace_schedule`, call it with the normalized schedule, then call `get_schedule_image`. Save and return the SVG as the long image, together with `editUrl`.
4. When browser JavaScript execution is available instead, open `editUrl`, wait for `window.ScheduleMaker`, and use `window.ScheduleMaker.getSvg()` to retrieve the same long image. If the user specifically requests PNG and downloads are available, use the webpage's PNG export.
5. If neither webpage tools nor browser execution is available, return the editable link and say plainly that the current agent could not attach the rendered image. Do not claim that an image was generated.

The editable link stores data in its URL fragment and imports it into the user's browser; it is not a server upload. Anyone who receives the full link can read its schedule data, so do not create or share such a link when the user asks to keep the data out of URLs.

