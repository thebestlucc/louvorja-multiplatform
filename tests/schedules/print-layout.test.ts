import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildSchedulePrintPack, getPrintableDepartmentIds } from "../../src/lib/schedule-print";
import type { ScheduleMonthDetail } from "../../src/lib/bindings";

function createMonthDetail(): ScheduleMonthDetail {
  return {
    month: {
      id: 1,
      year: 2026,
      month: 3,
      notes: null,
      createdAt: "2026-03-01",
      updatedAt: "2026-03-01",
    },
    departments: [
      {
        id: 20,
        code: "reception",
        namePt: "Recepção",
        nameEn: "Reception",
        nameEs: "Recepción",
        icon: "handshake",
        color: "#16A34A",
        peoplePerDay: 1,
        sortOrder: 1,
        isSystem: true,
        isActive: true,
        createdAt: "",
        updatedAt: "",
        members: [],
      },
      {
        id: 10,
        code: "music",
        namePt: "Música",
        nameEn: "Music",
        nameEs: "Música",
        icon: "music",
        color: "#A855F7",
        peoplePerDay: 1,
        sortOrder: 2,
        isSystem: true,
        isActive: true,
        createdAt: "",
        updatedAt: "",
        members: [],
      },
      {
        id: 30,
        code: "cleaning",
        namePt: "Limpeza",
        nameEn: "Cleaning",
        nameEs: "Limpieza",
        icon: "sparkles",
        color: "#0891B2",
        peoplePerDay: 1,
        sortOrder: 3,
        isSystem: true,
        isActive: true,
        createdAt: "",
        updatedAt: "",
        members: [],
      },
    ],
    days: [
      {
        id: 1,
        scheduleMonthId: 1,
        serviceDate: "2026-03-08",
        label: null,
        sourceKind: "manual",
        responsibleDepartmentId: 10,
        createdAt: "",
        updatedAt: "",
        responsibleDepartment: null,
        departments: [
          {
            id: 100,
            scheduleDayId: 1,
            departmentId: 10,
            peoplePerDay: 1,
            manualOverride: false,
            createdAt: "",
            updatedAt: "",
            department: null,
            assignments: [
              {
                id: 1000,
                scheduleDayDepartmentId: 100,
                memberId: 10000,
                sortOrder: 0,
                createdAt: "",
                member: {
                  id: 10000,
                  departmentId: 10,
                  name: "Ana",
                  sortOrder: 0,
                  isActive: true,
                  createdAt: "",
                  updatedAt: "",
                },
              },
            ],
          },
          {
            id: 101,
            scheduleDayId: 1,
            departmentId: 20,
            peoplePerDay: 1,
            manualOverride: false,
            createdAt: "",
            updatedAt: "",
            department: null,
            assignments: [
              {
                id: 1001,
                scheduleDayDepartmentId: 101,
                memberId: 10001,
                sortOrder: 0,
                createdAt: "",
                member: {
                  id: 10001,
                  departmentId: 20,
                  name: "Bia",
                  sortOrder: 0,
                  isActive: true,
                  createdAt: "",
                  updatedAt: "",
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

test("print sections preserve department display order", () => {
  const pack = buildSchedulePrintPack(createMonthDetail(), [10, 20], "pt-BR");

  assert.deepEqual(pack.sections.map((section) => section.departmentId), [20, 10]);
  assert.deepEqual(pack.sections.map((section) => section.title), ["Recepção", "Música"]);
});

test("empty or unselected departments are excluded from the printable payload", () => {
  const detail = createMonthDetail();

  assert.deepEqual(getPrintableDepartmentIds(detail), [20, 10]);

  const pack = buildSchedulePrintPack(detail, [10], "pt-BR");
  assert.deepEqual(pack.sections.map((section) => section.departmentId), [10]);
});

test("one printable payload can contain multiple departments on the same page", () => {
  const pack = buildSchedulePrintPack(createMonthDetail(), [10, 20], "pt-BR", {
    pageCapacity: 20,
  });

  assert.equal(pack.pages.length, 1);
  assert.equal(pack.pages[0]?.sections.length, 2);
});
