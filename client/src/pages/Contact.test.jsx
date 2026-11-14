// Contact page: the two "Start a project" buttons and the other links.
// CONTACT is replaced with stand-in links (vi.mock) so the tests don't depend
// on the real Google URLs, and the feedback form can never sneak onto the page.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Contact from "./Contact.jsx";
import { CONTACT } from "../data/site.js";

vi.mock("../data/site.js", () => ({ CONTACT: {} }));

const LINKS = {
  booking: "https://calendar.example/book",
  inquiryForm: "https://forms.example/inquiry",
  linkedin: "https://linkedin.example/jah",
  github: "https://github.example/jah",
};

// Swap in a fresh set of links for each test.
const show = (links) => {
  for (const key of Object.keys(CONTACT)) delete CONTACT[key];
  Object.assign(CONTACT, links);
  render(<Contact />, { wrapper: MemoryRouter });
};

beforeEach(() => {
  document.title = "";
});

describe("Contact", () => {
  test("shows the booking call and the inquiry form side by side", () => {
    show(LINKS);
    // The test library drops the space before "(opens in a new tab)"; real browsers keep it.
    const book = screen.getByRole("link", {
      name: /^Book a call ?\(opens in a new tab\)$/,
    });
    const form = screen.getByRole("link", {
      name: /^Describe your project ?\(opens in a new tab\)$/,
    });
    expect(book).toHaveAttribute("href", LINKS.booking);
    expect(form).toHaveAttribute("href", LINKS.inquiryForm);
    // Same row: both buttons sit in the one .form-actions box.
    expect(book.parentElement).toBe(form.parentElement);
  });

  test("new-tab links don't hand the page to the site they open", () => {
    show(LINKS);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute(
        "rel",
        expect.stringContaining("noreferrer"),
      );
    }
  });

  test("an empty link hides only its own button", () => {
    show({ ...LINKS, inquiryForm: "" });
    expect(
      screen.getByRole("link", { name: /book a call/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /describe your project/i }),
    ).not.toBeInTheDocument();
  });

  test("with no booking or form link, it points to Services instead", () => {
    show({ linkedin: LINKS.linkedin });
    expect(screen.getByText("Project bookings open soon.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See services" })).toHaveAttribute(
      "href",
      "/services",
    );
    expect(screen.getByRole("link", { name: /linkedin/i })).toHaveAttribute(
      "href",
      LINKS.linkedin,
    );
    expect(
      screen.queryByRole("link", { name: /github/i }),
    ).not.toBeInTheDocument();
  });
});
