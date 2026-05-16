import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PinInput } from "../PinInput";

describe("PinInput", () => {
  it("renders 6 digit boxes", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("auto-advances to next box on digit entry", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "3");

    expect(inputs[1]).toHaveFocus();
  });

  it("goes to previous box on backspace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    // Fill first box - focus moves to inputs[1]
    await user.type(inputs[0], "1");
    // Fill second box - focus moves to inputs[2]
    await user.type(inputs[1], "2");

    // Backspace on currently focused inputs[2] (which is empty) should move focus to inputs[1]
    // and clear the value at index 1 (standard PIN input behavior)
    await user.keyboard("{Backspace}");
    expect(inputs[1]).toHaveFocus();
    expect(inputs[2]).toHaveValue("");
  });

  it("calls onSubmit when all digits are entered", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "123456");

    expect(onSubmit).toHaveBeenCalledWith("123456");
  });

  it("handles paste of 6-digit code", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    // Focus first input and paste
    inputs[0].focus();
    await user.paste("654321");

    expect(onSubmit).toHaveBeenCalledWith("654321");
    for (let i = 0; i < 6; i++) {
      expect(inputs[i]).toHaveValue(String("654321"[i]));
    }
  });

  it("ignores non-numeric characters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "a");

    expect(inputs[0]).toHaveValue("");
    // Focus stays on first input since no valid digit was entered
    expect(inputs[0]).toHaveFocus();
  });

  it("has ARIA labels for accessibility", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} />);

    const inputs = screen.getAllByRole("textbox");
    inputs.forEach((input, index) => {
      expect(input).toHaveAttribute("aria-label", `Digit ${index + 1} of 6`);
    });
  });

  it("resets when value prop changes externally", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PinInput length={6} value="" onChange={onChange} onSubmit={onSubmit} />,
    );

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("");

    rerender(
      <PinInput length={6} value="123456" onChange={onChange} onSubmit={onSubmit} />,
    );

    const newInputs = screen.getAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      expect(newInputs[i]).toHaveValue(String("123456"[i]));
    }
  });

  it("disables inputs when disabled prop is true", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<PinInput length={6} onChange={onChange} onSubmit={onSubmit} disabled />);

    const inputs = screen.getAllByRole("textbox");
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
});
