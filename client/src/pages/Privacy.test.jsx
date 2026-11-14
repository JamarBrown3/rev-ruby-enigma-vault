// Privacy page: the promises it makes, the route, and the footer link.
import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Privacy from "./Privacy.jsx";
import Footer from "../components/Footer.jsx";

const show = () => render(<Privacy />, { wrapper: MemoryRouter });

describe("Privacy", () => {
  test("has one h1 and a heading for each part", () => {
    show();
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy" }),
    ).toBeInTheDocument();
    for (const name of [
      "What REV stores",
      "What REV never does",
      "Google forms and booking",
      "Deleting your account",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });

  test("says how passwords and sessions are handled", () => {
    show();
    expect(screen.getByText(/Argon2id hash/)).toBeInTheDocument();
    expect(screen.getByText(/30 minutes without activity/)).toBeInTheDocument();
    expect(screen.getByText(/CSRF token/)).toBeInTheDocument();
  });

  test("sends account deletion requests to the Contact page", () => {
    show();
    const section = screen.getByRole("region", {
      name: "Deleting your account",
    });
    expect(
      within(section).getByRole("link", { name: "Contact page" }),
    ).toHaveAttribute("href", "/contact");
  });

  test("the Google link opens safely in a new tab", () => {
    show();
    const google = screen.getByRole("link", {
      name: /Google's privacy policy/,
    });
    expect(google).toHaveAttribute(
      "href",
      "https://policies.google.com/privacy",
    );
    expect(google).toHaveAttribute("target", "_blank");
    expect(google).toHaveAttribute(
      "rel",
      expect.stringContaining("noreferrer"),
    );
  });

  test("sets the browser tab title", () => {
    show();
    expect(document.title).toMatch(/^Privacy/);
  });

  test("the footer links to /privacy, and /privacy shows the page", () => {
    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
        <Footer />
      </MemoryRouter>,
    );
    const footer = screen.getByRole("navigation", { name: "Footer" });
    expect(
      within(footer).getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy" }),
    ).toBeInTheDocument();
  });
});
