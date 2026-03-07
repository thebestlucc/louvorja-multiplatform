import type { ScheduleDepartment } from "./bindings";

export function getScheduleDepartmentLabel(
  department: Pick<ScheduleDepartment, "code" | "namePt" | "nameEn" | "nameEs"> | null | undefined,
  locale: string,
) {
  if (!department) {
    return "--";
  }

  const language = locale.split("-")[0];
  const candidates = language === "pt"
    ? [department.namePt, department.nameEn, department.nameEs]
    : language === "es"
      ? [department.nameEs, department.namePt, department.nameEn]
      : [department.nameEn, department.namePt, department.nameEs];

  return candidates.find((value) => value && value.trim().length > 0)
    ?? department.code
    ?? "--";
}
