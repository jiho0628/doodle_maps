import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

describe("Button", () => {
  it("押せる・既定は type=button・高さ60px以上のクラス", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>はい、出す</Button>);
    const button = screen.getByRole("button", { name: "はい、出す" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toMatch(/min-h-\[60px\]/);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("lg は 64px(min-h-16)", () => {
    render(<Button size="lg">この子にする</Button>);
    expect(screen.getByRole("button").className).toMatch(/min-h-16/);
  });
});

describe("IconButton", () => {
  it("アイコンだけでも読み上げ名を持つ", () => {
    render(
      <IconButton label="現在地にもどる">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "現在地にもどる" })).toBeInTheDocument();
  });
});
