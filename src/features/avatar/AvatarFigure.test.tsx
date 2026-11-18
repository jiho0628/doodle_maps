import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvatarFigure } from "./AvatarFigure";

describe("AvatarFigure", () => {
  it("title を渡すと読み上げ名付きの画像になる", () => {
    render(<AvatarFigure choice={{ kind: "animal", animal: "bear" }} size={56} title="わたし:くま" />);
    const img = screen.getByRole("img", { name: "わたし:くま" });
    expect(img).toHaveAttribute("width", "56");
    expect(img).toHaveAttribute("height", "62");
  });

  it("title がなければ飾り(読み上げない)", () => {
    const { container } = render(<AvatarFigure choice={{ kind: "animal", animal: "cat" }} size={52} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("写真は丸い画像として出す", () => {
    const dataUrl = "data:image/jpeg;base64,AAAA";
    render(<AvatarFigure choice={{ kind: "photo", dataUrl }} size={56} title="わたし:写真" />);
    const img = screen.getByRole("img", { name: "わたし:写真" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", dataUrl);
    expect(img.className).toMatch(/rounded-full/);
  });

  it("色は16進数を直書きしない", () => {
    for (const animal of ["rabbit", "bear", "cat", "chick", "penguin"] as const) {
      const { container, unmount } = render(<AvatarFigure choice={{ kind: "animal", animal }} size={56} />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      unmount();
    }
  });
});
