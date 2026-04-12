import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import { LongPressButton } from "../long-press-button";
import { Card, CardHeader, CardTitle, CardContent } from "../card";
import { ListItem } from "../list-item";
import { BottomTab } from "../bottom-tab";

// navigator.vibrate and Element.prototype.animate are stubbed in setup.ts

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("accepts className", () => {
    render(<Button className="extra-class">Btn</Button>);
    expect(screen.getByRole("button")).toHaveClass("extra-class");
  });

  it("fires onClick on pointer-up", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("IconButton", () => {
  it("renders with required aria-label", () => {
    render(<IconButton aria-label="Close"><span>X</span></IconButton>);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("accepts className", () => {
    render(<IconButton aria-label="test" className="custom">icon</IconButton>);
    expect(screen.getByRole("button")).toHaveClass("custom");
  });
});

describe("LongPressButton", () => {
  it("renders children", () => {
    render(<LongPressButton onHoldComplete={vi.fn()}>Hold me</LongPressButton>);
    expect(screen.getByText("Hold me")).toBeInTheDocument();
  });

  it("has correct ARIA role", () => {
    render(<LongPressButton onHoldComplete={vi.fn()}>Hold</LongPressButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("does NOT fire onHoldComplete on quick release", async () => {
    const onHoldComplete = vi.fn();
    render(
      <LongPressButton onHoldComplete={onHoldComplete} duration={600}>
        Hold
      </LongPressButton>,
    );
    const btn = screen.getByRole("button");
    // Simulate quick press-release (no wait)
    fireEvent.pointerDown(btn);
    fireEvent.pointerUp(btn);
    // Should not fire
    await new Promise((r) => setTimeout(r, 50));
    expect(onHoldComplete).not.toHaveBeenCalled();
  });

  it("fires onHoldComplete after full hold duration", async () => {
    const onHoldComplete = vi.fn();
    vi.useFakeTimers();
    render(
      <LongPressButton onHoldComplete={onHoldComplete} duration={600}>
        Hold
      </LongPressButton>,
    );
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    vi.advanceTimersByTime(700);
    expect(onHoldComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("accepts className", () => {
    const { container } = render(<Card className="custom-card">Body</Card>);
    expect(container.firstChild).toHaveClass("custom-card");
  });

  it("CardTitle renders text", () => {
    render(
      <Card>
        <CardHeader><CardTitle>My Title</CardTitle></CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });
});

describe("ListItem", () => {
  it("renders label", () => {
    render(<ListItem label="My Item" />);
    expect(screen.getByText("My Item")).toBeInTheDocument();
  });

  it("renders sublabel when provided", () => {
    render(<ListItem label="Main" sublabel="Secondary" />);
    expect(screen.getByText("Secondary")).toBeInTheDocument();
  });

  it("accepts className", () => {
    render(<ListItem label="test" className="extra" />);
    expect(screen.getByRole("button")).toHaveClass("extra");
  });

  it("fires onClick on pointer-up", () => {
    const onClick = vi.fn();
    render(<ListItem label="click me" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("BottomTab", () => {
  it("renders label", () => {
    render(<BottomTab label="Home" icon={<span>🏠</span>} />);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("has role=tab", () => {
    render(<BottomTab label="Search" icon={<span>🔍</span>} />);
    expect(screen.getByRole("tab")).toBeInTheDocument();
  });

  it("sets aria-selected when active", () => {
    render(<BottomTab label="Live" icon={<span>▶</span>} active />);
    expect(screen.getByRole("tab")).toHaveAttribute("aria-selected", "true");
  });

  it("accepts className", () => {
    render(<BottomTab label="Settings" icon={<span>⚙</span>} className="extra" />);
    expect(screen.getByRole("tab")).toHaveClass("extra");
  });
});
