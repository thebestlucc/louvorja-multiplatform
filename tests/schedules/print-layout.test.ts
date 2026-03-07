import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildSchedulePrintPack,
  collectEntryAssigneeNames,
  getPrintableDepartmentIds,
} from "../../src/lib/schedule-print";
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
        shuffleOnGenerate: false,
        groupDatesInPrint: false,
        repeatMembersInGroupedDates: true,
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
        shuffleOnGenerate: false,
        groupDatesInPrint: false,
        repeatMembersInGroupedDates: true,
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
        shuffleOnGenerate: false,
        groupDatesInPrint: false,
        repeatMembersInGroupedDates: true,
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

test("print sections respect the explicit preview order", () => {
  const pack = buildSchedulePrintPack(createMonthDetail(), [10, 20], "pt-BR");

  assert.deepEqual(pack.sections.map((section) => section.departmentId), [10, 20]);
  assert.deepEqual(pack.sections.map((section) => section.title), ["Música", "Recepção"]);
});

test("empty or unselected departments are excluded from the printable payload", () => {
  const detail = createMonthDetail();

  assert.deepEqual(getPrintableDepartmentIds(detail), [20, 10]);

  const pack = buildSchedulePrintPack(detail, [10], "pt-BR");
  assert.deepEqual(pack.sections.map((section) => section.departmentId), [10]);
});

test("an explicit empty preview selection produces an empty printable payload", () => {
  const pack = buildSchedulePrintPack(createMonthDetail(), [], "pt-BR");

  assert.deepEqual(pack.sections, []);
  assert.deepEqual(pack.pages, []);
});

test("inactive departments stay out of printable selectors even if they still have entries", () => {
  const detail = createMonthDetail();
  detail.departments[0] = {
    ...detail.departments[0],
    isActive: false,
  };

  assert.deepEqual(getPrintableDepartmentIds(detail), [10]);

  const pack = buildSchedulePrintPack(detail, [20, 10], "pt-BR");
  assert.deepEqual(pack.sections.map((section) => section.departmentId), [10]);
});

test("one printable payload can contain multiple departments on the same page", () => {
  const pack = buildSchedulePrintPack(createMonthDetail(), [10, 20], "pt-BR", {
    pageContentHeightPx: 9999,
  });

  assert.equal(pack.pages.length, 1);
  assert.equal(pack.pages[0]?.sections.length, 2);
});

test("print packing splits oversized departments into continuation sections across pages", () => {
  const detail = createMonthDetail();
  detail.days = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    scheduleMonthId: 1,
    serviceDate: `2026-03-${String(index + 1).padStart(2, "0")}`,
    label: null,
    sourceKind: "manual",
    responsibleDepartmentId: 10,
    createdAt: "",
    updatedAt: "",
    responsibleDepartment: null,
    departments: [
      {
        id: 100 + index,
        scheduleDayId: index + 1,
        departmentId: 10,
        peoplePerDay: 1,
        manualOverride: false,
        createdAt: "",
        updatedAt: "",
        department: null,
        assignments: [
          {
            id: 1000 + index,
            scheduleDayDepartmentId: 100 + index,
            memberId: 10000 + index,
            sortOrder: 0,
            createdAt: "",
            member: {
              id: 10000 + index,
              departmentId: 10,
              name: `Ana Maria de Souza ${index} • Ministério Central`,
              sortOrder: 0,
              isActive: true,
              createdAt: "",
              updatedAt: "",
            },
          },
        ],
      },
    ],
  }));

  const pack = buildSchedulePrintPack(detail, [10], "pt-BR", {
    pageContentHeightPx: 500,
  });

  assert.ok(pack.pages.length > 1);
  assert.ok(pack.pages.every((page) => page.sections.length === 1));
  assert.ok(pack.pages.every((page) => page.sections[0]?.departmentId === 10));
  assert.equal(
    pack.pages.reduce((total, page) => total + (page.sections[0]?.entries.length ?? 0), 0),
    pack.sections[0]?.entries.length ?? 0,
  );
});

test("departments can group consecutive dates into one printable entry", () => {
  const detail = createMonthDetail();
  detail.departments[1] = {
    ...detail.departments[1],
    groupDatesInPrint: true,
    repeatMembersInGroupedDates: true,
  };
  detail.days.push({
    id: 2,
    scheduleMonthId: 1,
    serviceDate: "2026-03-09",
    label: null,
    sourceKind: "manual",
    responsibleDepartmentId: null,
    createdAt: "",
    updatedAt: "",
    responsibleDepartment: null,
    departments: [
      {
        id: 102,
        scheduleDayId: 2,
        departmentId: 10,
        peoplePerDay: 1,
        manualOverride: false,
        createdAt: "",
        updatedAt: "",
        department: null,
        assignments: [
          {
            id: 1002,
            scheduleDayDepartmentId: 102,
            memberId: 10002,
            sortOrder: 0,
            createdAt: "",
            member: {
              id: 10002,
              departmentId: 10,
              name: "Carla",
              sortOrder: 0,
              isActive: true,
              createdAt: "",
              updatedAt: "",
            },
          },
        ],
      },
    ],
  });

  const pack = buildSchedulePrintPack(detail, [10], "pt-BR");

  assert.equal(pack.sections[0]?.dayCount, 2);
  assert.equal(pack.sections[0]?.entries.length, 1);
  assert.equal(pack.sections[0]?.entries[0]?.days.length, 2);
  assert.equal(pack.sections[0]?.entries[0]?.startDate, "2026-03-08");
  assert.equal(pack.sections[0]?.entries[0]?.endDate, "2026-03-09");
});

test("grouped entries can collapse repeated members into one deduplicated list", () => {
  const detail = createMonthDetail();
  detail.departments[1] = {
    ...detail.departments[1],
    groupDatesInPrint: true,
    repeatMembersInGroupedDates: false,
  };
  detail.days.push({
    id: 2,
    scheduleMonthId: 1,
    serviceDate: "2026-03-09",
    label: "Evening",
    sourceKind: "manual",
    responsibleDepartmentId: 10,
    createdAt: "",
    updatedAt: "",
    responsibleDepartment: null,
    departments: [
      {
        id: 102,
        scheduleDayId: 2,
        departmentId: 10,
        peoplePerDay: 1,
        manualOverride: false,
        createdAt: "",
        updatedAt: "",
        department: null,
        assignments: [
          {
            id: 1002,
            scheduleDayDepartmentId: 102,
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
          {
            id: 1003,
            scheduleDayDepartmentId: 102,
            memberId: 10003,
            sortOrder: 1,
            createdAt: "",
            member: {
              id: 10003,
              departmentId: 10,
              name: "Carla",
              sortOrder: 1,
              isActive: true,
              createdAt: "",
              updatedAt: "",
            },
          },
        ],
      },
    ],
  });

  const pack = buildSchedulePrintPack(detail, [10], "pt-BR");
  const entry = pack.sections[0]?.entries[0];

  assert.equal(pack.sections[0]?.repeatMembersInGroupedDates, false);
  assert.deepEqual(collectEntryAssigneeNames(entry?.days ?? []), ["Ana", "Carla"]);
});
