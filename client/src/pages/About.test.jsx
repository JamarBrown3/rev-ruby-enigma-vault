// About page: each project's links say which project they're for and that
// they open a new tab, so a screen reader doesn't just hear "Code" five times.
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import About from "./About.jsx";

vi.mock("../data/site.js", () => ({
  SKILLS: [],
  PROJECTS: [
    {
      name: "Demo store",
      stack: "React",
      about: "A test project.",
      url: "https://demo.example",
      code: "https://code.example/store",
    },
    {
      name: "Code only",
      stack: "Express",
      about: "No live site yet.",
      url: "",
      code: "https://code.example/only",
    },
  ],
}));

const show = () => render(<About />, { wrapper: MemoryRouter });

describe("About projects", () => {
  // The test library drops the space before hidden text; real browsers keep it.
  test("Code links name their project and announce the new tab", () => {
    show();
    const code = screen.getByRole("link", {
      name: /^Code ?for Demo store \(opens in a new tab\)$/,
    });
    expect(code).toHaveAttribute("href", "https://code.example/store");
    expect(code).toHaveAttribute("target", "_blank");
    expect(code).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  test("Live site links do the same", () => {
    show();
    const live = screen.getByRole("link", {
      name: /^Live site ?for Demo store \(opens in a new tab\)$/,
    });
    expect(live).toHaveAttribute("href", "https://demo.example");
  });

  test("an empty url hides the Live site link", () => {
    show();
    expect(
      screen.getByRole("link", { name: /^Code ?for Code only/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Live site ?for Code only/ }),
    ).not.toBeInTheDocument();
  });
});
