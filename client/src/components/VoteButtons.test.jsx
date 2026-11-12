// Like / dislike buttons: what visitors and members see, and how voting behaves.
// The server and the signed-in user are replaced with stand-ins (vi.mock),
// so these tests run offline in a fake browser.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VoteButtons from "./VoteButtons.jsx";
import votesApi from "../services/voteApi.js";
import { useAuth } from "../auth/AuthContext.jsx";

vi.mock("../services/voteApi.js", () => ({
  default: { totals: vi.fn(), mine: vi.fn(), set: vi.fn(), clear: vi.fn() },
}));
vi.mock("../auth/AuthContext.jsx", () => ({ useAuth: vi.fn() }));

const POST = "a".repeat(24);
const ME = { id: "c".repeat(24), username: "jah" };

// MemoryRouter: VoteButtons uses <Link>, which needs a router around it.
const show = () => render(<VoteButtons postId={POST} />, { wrapper: MemoryRouter });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VoteButtons", () => {
  test("a visitor sees totals and a sign-in link, but no buttons", async () => {
    useAuth.mockReturnValue({ user: null });
    votesApi.totals.mockResolvedValue({ likes: 1, dislikes: 0 });
    show();

    expect(await screen.findByText(/1 like · 0 dislikes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to vote" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(votesApi.mine).not.toHaveBeenCalled(); // visitors never ask for "my vote"
  });

  test("a member can like; the button reads as pressed and the change is announced", async () => {
    useAuth.mockReturnValue({ user: ME });
    votesApi.mine.mockResolvedValue({ likes: 3, dislikes: 1, myVote: null });
    votesApi.set.mockResolvedValue({ likes: 4, dislikes: 1, myVote: 1 });
    show();

    const like = await screen.findByRole("button", { name: /^Like 3/ });
    expect(like).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(like);

    expect(votesApi.set).toHaveBeenCalledWith(POST, 1);
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveTextContent("4");
    expect(screen.getByRole("status")).toHaveTextContent("You liked this post.");
  });

  test("switching to dislike sends -1; pressing it again removes the vote", async () => {
    useAuth.mockReturnValue({ user: ME });
    votesApi.mine.mockResolvedValue({ likes: 4, dislikes: 1, myVote: 1 });
    votesApi.set.mockResolvedValue({ likes: 3, dislikes: 2, myVote: -1 });
    votesApi.clear.mockResolvedValue({ likes: 3, dislikes: 1, myVote: null });
    show();

    const dislike = await screen.findByRole("button", { name: /^Dislike/ });
    await userEvent.click(dislike);
    expect(votesApi.set).toHaveBeenCalledWith(POST, -1);
    expect(dislike).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Like/ })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(dislike);
    expect(votesApi.clear).toHaveBeenCalledWith(POST);
    expect(dislike).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Vote removed.");
  });

  test("QA 3.4: keyboard focus stays on the button after voting", async () => {
    useAuth.mockReturnValue({ user: ME });
    votesApi.mine.mockResolvedValue({ likes: 0, dislikes: 0, myVote: null });
    votesApi.set.mockResolvedValue({ likes: 1, dislikes: 0, myVote: 1 });
    votesApi.clear.mockResolvedValue({ likes: 0, dislikes: 0, myVote: null });
    show();

    const like = await screen.findByRole("button", { name: /^Like/ });
    like.focus();
    await userEvent.keyboard("{Enter}");
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like).toHaveFocus(); // was the page body before the aria-disabled fix

    await userEvent.keyboard(" "); // Space right after, without clicking first
    expect(votesApi.clear).toHaveBeenCalledTimes(1);
    expect(like).toHaveAttribute("aria-pressed", "false");
  });

  test("a fast double click only sends ONE vote", async () => {
    useAuth.mockReturnValue({ user: ME });
    votesApi.mine.mockResolvedValue({ likes: 0, dislikes: 0, myVote: null });
    let finish;
    votesApi.set.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    show();

    const like = await screen.findByRole("button", { name: /^Like/ });
    await userEvent.click(like);
    await userEvent.click(like); // the first vote is still saving
    expect(votesApi.set).toHaveBeenCalledTimes(1);
    expect(like).toHaveAttribute("aria-disabled", "true");
    finish({ likes: 1, dislikes: 0, myVote: 1 });
  });

  test("if the totals don't load, it says so instead of spinning forever", async () => {
    useAuth.mockReturnValue({ user: null });
    votesApi.totals.mockRejectedValue(new Error("offline"));
    show();
    expect(await screen.findByText(/Likes didn't load/)).toBeInTheDocument();
  });
});
