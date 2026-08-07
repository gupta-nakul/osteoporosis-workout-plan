import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines the workout tracker product shell", async () => {
  const [page, layout, app, css, hosting] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/workout-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);

  assert.match(page, /<WorkoutApp \/>/);
  assert.match(layout, /osteoporosis-workout-plan/);
  assert.match(app, /Asia\/Kolkata/);
  assert.match(app, /Pain before starting/);
  assert.match(app, /Publish update/);
  assert.match(css, /app-shell/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(page + layout + app + css, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("starter preview folder is removed", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
