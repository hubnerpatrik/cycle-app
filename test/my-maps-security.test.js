import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../views/my-maps.js";

test("map IDs are safe for quoted data attributes", () => {
  assert.equal(
    escapeHtml('map\" onclick=\"alert(1)<tag>'),
    "map&quot; onclick=&quot;alert(1)&lt;tag&gt;",
  );
});
