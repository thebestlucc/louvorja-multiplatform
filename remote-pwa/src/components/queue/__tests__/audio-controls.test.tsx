import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SeekSlider } from "../SeekSlider";
import { VolumeSlider } from "../VolumeSlider";
import { TargetChips } from "../TargetChips";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "remote.queue.target_projector": "Projector",
        "remote.queue.target_return": "Return",
        "remote.queue.seek": "Seek",
        "remote.queue.volume": "Volume",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("SeekSlider — G6", () => {
  it("renders with current position", () => {
    render(<SeekSlider position={30} duration={120} onSeek={vi.fn()} />);
    const slider = screen.getByRole("slider", { name: /seek/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveValue("30");
  });

  it("calls onSeek with new value on pointer up", () => {
    const onSeek = vi.fn();
    render(<SeekSlider position={0} duration={120} onSeek={onSeek} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "60" } });
    fireEvent.pointerUp(slider);
    expect(onSeek).toHaveBeenCalledWith(60);
  });
});

describe("VolumeSlider — G6", () => {
  it("renders with current volume", () => {
    render(<VolumeSlider volume={75} onVolumeChange={vi.fn()} />);
    const slider = screen.getByRole("slider", { name: /volume/i });
    expect(slider).toHaveValue("75");
  });

  it("calls onVolumeChange on pointer up", () => {
    const onVolumeChange = vi.fn();
    render(<VolumeSlider volume={50} onVolumeChange={onVolumeChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "80" } });
    fireEvent.pointerUp(slider);
    expect(onVolumeChange).toHaveBeenCalledWith(80);
  });
});

describe("TargetChips — G7", () => {
  it("renders projector and return chips", () => {
    render(<TargetChips targets={["projector"]} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /projector/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /return/i })).toBeInTheDocument();
  });

  it("projector chip is checked when in targets", () => {
    render(<TargetChips targets={["projector"]} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /projector/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /return/i })).not.toBeChecked();
  });

  it("clicking return chip calls onChange with both targets", () => {
    const onChange = vi.fn();
    render(<TargetChips targets={["projector"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /return/i }));
    expect(onChange).toHaveBeenCalledWith(["projector", "return"]);
  });

  it("clicking active projector chip removes it from targets", () => {
    const onChange = vi.fn();
    render(<TargetChips targets={["projector", "return"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /projector/i }));
    expect(onChange).toHaveBeenCalledWith(["return"]);
  });
});
