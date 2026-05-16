import { strict as assert } from "node:assert";
import { test } from "node:test";

import { getScheduleDepartmentLabel } from "../../src/lib/schedule-departments";

const department = {
  code: "music",
  namePt: "Música",
  nameEn: "Music",
  nameEs: "Música ES",
};

test("prefers the requested locale when it exists", () => {
  assert.equal(getScheduleDepartmentLabel(department, "pt-BR"), "Música");
  assert.equal(getScheduleDepartmentLabel(department, "en-US"), "Music");
  assert.equal(getScheduleDepartmentLabel(department, "es-ES"), "Música ES");
});

test("falls back through other locales before using the code", () => {
  assert.equal(
    getScheduleDepartmentLabel(
      {
        code: "cleaning",
        namePt: "",
        nameEn: "Cleaning",
        nameEs: null,
      },
      "pt-BR",
    ),
    "Cleaning",
  );

  assert.equal(
    getScheduleDepartmentLabel(
      {
        code: "reception",
        namePt: null,
        nameEn: "",
        nameEs: "Recepción",
      },
      "en-US",
    ),
    "Recepción",
  );
});

test("returns the stable code or placeholder when labels are missing", () => {
  assert.equal(
    getScheduleDepartmentLabel(
      {
        code: "communication",
        namePt: null,
        nameEn: "",
        nameEs: " ",
      },
      "pt-BR",
    ),
    "communication",
  );

  assert.equal(getScheduleDepartmentLabel(null, "pt-BR"), "--");
});
