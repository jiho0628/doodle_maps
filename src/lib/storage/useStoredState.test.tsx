import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STORAGE_KEYS, STORAGE_PREFIX } from "./keys";
import { writeJSON } from "./localStore";
import { useStoredState } from "./useStoredState";

const EMPTY: string[] = [];
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function Probe({ label }: { label: string }) {
  const [items, setItems] = useStoredState(STORAGE_KEYS.favorites, EMPTY, isStringArray);
  return (
    <div>
      <span data-testid={label}>{items.join(",") || "(なし)"}</span>
      <button onClick={() => setItems((prev) => [...prev, label])}>add-{label}</button>
    </div>
  );
}

describe("useStoredState", () => {
  it("保存済みの値で表示し、更新すると他のコンポーネントにも反映される", async () => {
    window.localStorage.setItem(STORAGE_PREFIX + "favorites", '["x"]');
    render(
      <>
        <Probe label="a" />
        <Probe label="b" />
      </>,
    );
    expect(screen.getByTestId("a")).toHaveTextContent("x");

    await userEvent.click(screen.getByText("add-a"));
    expect(screen.getByTestId("a")).toHaveTextContent("x,a");
    expect(screen.getByTestId("b")).toHaveTextContent("x,a");
  });

  it("外から書き込まれた値にも追従する", () => {
    render(<Probe label="a" />);
    expect(screen.getByTestId("a")).toHaveTextContent("(なし)");
    act(() => {
      writeJSON(STORAGE_KEYS.favorites, ["z"]);
    });
    expect(screen.getByTestId("a")).toHaveTextContent("z");
  });
});
