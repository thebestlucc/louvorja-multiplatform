import { useTranslation } from "react-i18next";
import { emit } from "@tauri-apps/api/event";
import { Badge } from "../ui/badge";
import {
  useVideoPlayerStore,
  type LocalTarget,
  type LiveTarget,
} from "../../stores/video-player-store";

const LOCAL_OPTIONS: readonly LocalTarget[] = ["projector", "return"];
const LIVE_OPTIONS: readonly LiveTarget[] = ["projector", "return"];

export function VideoTargetToggle() {
  const { t } = useTranslation();
  const mode = useVideoPlayerStore((s) => s.mode);
  const targets = useVideoPlayerStore((s) => s.videoPlaybackTargets);
  const liveTarget = useVideoPlayerStore((s) => s.liveTarget);
  const setTargets = useVideoPlayerStore((s) => s.setVideoPlaybackTargets);
  const setLiveTarget = useVideoPlayerStore((s) => s.setLiveTarget);

  if (mode == null) return null;

  if (mode.kind === "local") {
    const toggle = (target: LocalTarget) => {
      const options = targets.includes(target)
        ? targets.filter((x) => x !== target)
        : [...targets, target];
      const next = options.filter(
        (x): x is LocalTarget => x === "projector" || x === "return",
      );
      setTargets(next);
      emit("remote-video-set-targets", { targets: next }).catch(() => {});
    };
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{t("videoTargets.label")}</span>
        {LOCAL_OPTIONS.map((target) => (
          <label key={target} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={targets.includes(target)}
              onChange={() => toggle(target)}
              className="accent-primary"
            />
            {t(`videoTargets.${target}`)}
          </label>
        ))}
        <Badge variant="outline" className="ml-1 text-[10px]">
          {t("videoTargets.modeLocal")}
        </Badge>
      </div>
    );
  }

  // mode.kind === "live-youtube"
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{t("videoTargets.liveLabel")}</span>
      {LIVE_OPTIONS.map((target) => (
        <label key={target} className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="live-target"
            checked={liveTarget === target}
            onChange={() => {
              const v = target as LiveTarget;
              if (v === "projector" || v === "return") {
                setLiveTarget(v);
                emit("remote-video-set-live-target", { target: v }).catch(() => {});
              }
            }}
            className="accent-primary"
          />
          {t(`videoTargets.${target}`)}
        </label>
      ))}
      <Badge variant="outline" className="ml-1 text-[10px]">
        {t("videoTargets.modeLive")}
      </Badge>
    </div>
  );
}
