import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_PREFIX } from "@/lib/storage";
import { AvatarScreen } from "./AvatarScreen";
import { photoFileToDataUrl } from "./photo";

const router = { push: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./photo", () => ({ photoFileToDataUrl: vi.fn() }));

const png = () => new File([new Uint8Array([1, 2, 3])], "me.png", { type: "image/png" });

describe("AvatarScreen 写真", () => {
  it("写真をえらぶとプレビューに出て、保存できる", async () => {
    const dataUrl = "data:image/jpeg;base64,AAAA";
    vi.mocked(photoFileToDataUrl).mockResolvedValueOnce(dataUrl);
    const user = userEvent.setup();
    render(<AvatarScreen />);
    await user.upload(screen.getByTestId("avatar-photo-input"), png());
    const preview = await screen.findByRole("img", { name: "えらんだアバター：写真" });
    expect(preview).toHaveAttribute("src", dataUrl);
    expect(screen.getByRole("button", { name: "写真" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "この子にする" }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + "avatar")!)).toEqual({ kind: "photo", dataUrl });
  });

  it("読めない写真はやさしいメッセージ", async () => {
    vi.mocked(photoFileToDataUrl).mockRejectedValueOnce(new Error("bad"));
    const user = userEvent.setup();
    render(<AvatarScreen />);
    await user.upload(screen.getByTestId("avatar-photo-input"), png());
    expect(await screen.findByRole("alert")).toHaveTextContent("読みこめませんでした");
    expect(screen.getByRole("button", { name: "うさぎ" })).toHaveAttribute("aria-pressed", "true");
  });
});
