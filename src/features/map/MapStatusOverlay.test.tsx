import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapStatusOverlay } from "./MapStatusOverlay";

describe("MapStatusOverlay", () => {
  it("読みこみ完了後は何も出さない", () => {
    const { container } = render(<MapStatusOverlay status="ready" onRetry={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("失敗したら案内と「もう一度ためす」を出す", async () => {
    const onRetry = vi.fn();
    render(<MapStatusOverlay status="error" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("地図を読みこめません");
    await userEvent.click(screen.getByRole("button", { name: "もう一度ためす" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("WebGL がない端末ではリトライボタンを出さない", () => {
    render(<MapStatusOverlay status="unsupported" onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("この端末では地図を表示できません");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
