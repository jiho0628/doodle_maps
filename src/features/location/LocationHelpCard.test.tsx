import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { detectPlatform, LocationHelpCard } from "./LocationHelpCard";

describe("detectPlatform", () => {
  it.each([
    [{ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }, "ios"],
    [{ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 }, "ios"],
    [{ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)" }, "android"],
    [{ userAgent: "Mozilla/5.0 (Windows NT 10.0)" }, "other"],
  ] as const)("%j → %s", (nav, expected) => {
    expect(detectPlatform(nav)).toBe(expected);
  });
});

describe("LocationHelpCard", () => {
  it("拒否されたときは iPhone の設定手順と「もう一度ためす」を出す", async () => {
    const onRetry = vi.fn();
    render(<LocationHelpCard status="denied" platform="ios" onRetry={onRetry} onClose={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("現在地が使えません");
    expect(screen.getByText("「Safari の Web サイト」を「使用中のみ」にする")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "もう一度ためす" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("使えない端末ではリトライを出さない", () => {
    render(<LocationHelpCard status="unsupported" platform="other" onRetry={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "もう一度ためす" })).toBeNull();
    expect(screen.getByRole("button", { name: "とじる" })).toBeInTheDocument();
  });

  it("取れているときは何も出さない", () => {
    const { container } = render(<LocationHelpCard status="ok" platform="ios" onRetry={() => {}} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
