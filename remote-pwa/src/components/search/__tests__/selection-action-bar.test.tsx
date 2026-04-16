import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { SelectionActionBar } from "../selection-action-bar";

function wrap(ui: React.ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe("SelectionActionBar", () => {
  it("hidden when count=0", () => {
    const { container } = render(wrap(<SelectionActionBar count={0} onPlayNow={vi.fn()} onAddToQueue={vi.fn()} onClear={vi.fn()} />));
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it("shows Play now and Add to queue when count>=1 and wires clicks", () => {
    const playNow = vi.fn(), addToQueue = vi.fn(), clear = vi.fn();
    render(wrap(<SelectionActionBar count={3} onPlayNow={playNow} onAddToQueue={addToQueue} onClear={clear} />));
    fireEvent.click(screen.getByText(/play.now|projetar|proyectar/i));
    fireEvent.click(screen.getByText(/add.to.queue|fila|cola/i));
    expect(playNow).toHaveBeenCalledTimes(1);
    expect(addToQueue).toHaveBeenCalledTimes(1);
  });
});
