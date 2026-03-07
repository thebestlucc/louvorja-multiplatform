import { test } from "node:test";
import { strict as assert } from "node:assert";
import { COLLAPSED_TOAST_LIMIT, getToasterLayout } from "../src/lib/toast-layout";

test("keeps up to three toasts expanded", () => {
  assert.deepEqual(getToasterLayout(1, false), {
    expand: true,
    visibleToasts: COLLAPSED_TOAST_LIMIT,
  });

  assert.deepEqual(getToasterLayout(3, false), {
    expand: true,
    visibleToasts: COLLAPSED_TOAST_LIMIT,
  });
});

test("collapses the stack after the third toast until interaction starts", () => {
  assert.deepEqual(getToasterLayout(4, false), {
    expand: false,
    visibleToasts: COLLAPSED_TOAST_LIMIT,
  });
});

test("reveals the full stack while the toaster is hovered or focused", () => {
  assert.deepEqual(getToasterLayout(4, true), {
    expand: true,
    visibleToasts: 4,
  });

  assert.deepEqual(getToasterLayout(6, true), {
    expand: true,
    visibleToasts: 6,
  });
});
