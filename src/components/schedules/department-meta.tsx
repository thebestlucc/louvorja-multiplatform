import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  Camera,
  Handshake,
  Megaphone,
  Mic2,
  MonitorPlay,
  Music,
  Shield,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";
import type { ScheduleDepartment } from "../../lib/bindings";

const iconByCode: Record<string, LucideIcon> = {
  book: BookOpen,
  calendar: CalendarDays,
  camera: Camera,
  handshake: Handshake,
  megaphone: Megaphone,
  mic: Mic2,
  "monitor-play": MonitorPlay,
  music: Music,
  shield: Shield,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  users: Users2,
};

export const scheduleIconOptions = [
  { value: "music", label: "Music", icon: Music },
  { value: "monitor-play", label: "Monitor Play", icon: MonitorPlay },
  { value: "handshake", label: "Handshake", icon: Handshake },
  { value: "shield", label: "Shield", icon: Shield },
  { value: "shield-check", label: "Shield Check", icon: ShieldCheck },
  { value: "megaphone", label: "Megaphone", icon: Megaphone },
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "users", label: "Users", icon: Users2 },
  { value: "mic", label: "Microphone", icon: Mic2 },
  { value: "camera", label: "Camera", icon: Camera },
  { value: "book", label: "Book", icon: BookOpen },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function getScheduleDepartmentIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) {
    return Users2;
  }

  return iconByCode[icon] ?? Users2;
}

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
