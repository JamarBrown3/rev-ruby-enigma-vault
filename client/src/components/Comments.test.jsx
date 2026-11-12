// Comments: reading, posting, editing, deleting, and the accessibility wiring
// (labels, error messages, focus). The server and signed-in user are stand-ins.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Comments from "./Comments.jsx";
import commentsApi from "../services/commentsApi.js";
import { useAuth } from "../auth/AuthContext.jsx";

// Keep the real COMMENTS_PER_PAGE / COMMENT_MAX numbers; fake only the requests.
vi.mock("../services/commentsApi.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, default: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});
vi.mock("../auth/AuthContext.jsx", () => ({ useAuth: vi.fn() }));

const POST = "a".repeat(24);
const ME = { id: "c".repeat(24), username: "jah" };
const SOMEONE = { _id: "d".repeat(24), username: "pixelbard" };
const DAY = "2026-11-11T12:00:00.000Z";

function comment(id, author, body, extra = {}) {
  return { _id: id.repeat(24), postId: POST, authorId: author, body, createdAt: DAY, updatedAt: DAY, ...extra };
}
const theirs = comment("1", SOMEONE, "Great review!");
const mine = comment("2", { _id: ME.id, username: "jah" }, "Thanks!");

const show = () => render(<Comments postId={POST} />, { wrapper: MemoryRouter });
const items = () => screen.getAllByRole("listitem");

beforeEach(() => {
  vi.clearAllMocks();
  commentsApi.list.mockResolvedValue([theirs, mine]);
});

describe("Comments: reading", () => {
  test("a visitor sees the comments and a sign-in link, but no box or Edit buttons", async () => {
    useAuth.mockReturnValue({ user: null });
    show();

    expect(await screen.findByRole("heading", { name: "Comments (2)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Comments (2)" })).toBeInTheDocument(); // aria-labelledby works
    expect(screen.getByText("Great review!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });

  test("shows author, a readable date, and (edited) only on edited comments", async () => {
    useAuth.mockReturnValue({ user: null });
    commentsApi.list.mockResolvedValue([
      theirs,
      comment("3", SOMEONE, "changed", { updatedAt: "2026-11-11T12:05:00.000Z" }),
    ]);
    show();

    await screen.findByText("Great review!");
    const [first, second] = items();
    expect(first).toHaveTextContent(/pixelbard · Nov 11, 2026/);
    expect(first).not.toHaveTextContent("(edited)");
    expect(second).toHaveTextContent("(edited)");
  });

  test("an empty post says so; a load failure says so", async () => {
    useAuth.mockReturnValue({ user: ME });
    commentsApi.list.mockResolvedValueOnce([]);
    const { unmount } = show();
    expect(await screen.findByText(/No comments yet/)).toBeInTheDocument();
    unmount();

    commentsApi.list.mockRejectedValueOnce(new Error("offline"));
    show();
    expect(await screen.findByText("Comments didn't load.")).toBeInTheDocument();
  });

  test("a full page of 50 shows Load more, which adds the next page", async () => {
    useAuth.mockReturnValue({ user: null });
    const page1 = Array.from({ length: 50 }, (_, i) => comment("1", SOMEONE, `c${i}`, { _id: String(i).padStart(24, "0") }));
    commentsApi.list.mockResolvedValueOnce(page1).mockResolvedValueOnce([comment("9", SOMEONE, "the 51st")]);
    show();

    const more = await screen.findByRole("button", { name: "Load more comments" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Comments$/); // total unknown yet
    await userEvent.click(more);
    expect(commentsApi.list).toHaveBeenLastCalledWith(POST, 2);
    expect(await screen.findByText("the 51st")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more comments" })).not.toBeInTheDocument();
  });
});

describe("Comments: writing (signed in)", () => {
  beforeEach(() => useAuth.mockReturnValue({ user: ME }));

  test("only MY comment has Edit and Delete", async () => {
    show();
    await screen.findByText("Thanks!");
    const [theirItem, myItem] = items();
    expect(within(theirItem).queryByRole("button")).not.toBeInTheDocument();
    expect(within(myItem).getByRole("button", { name: "Edit your comment" })).toBeInTheDocument();
    expect(within(myItem).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  test("the box has a real label, and an empty post shows an error linked to the box", async () => {
    show();
    const box = await screen.findByLabelText("Add a comment"); // fails if htmlFor and id don't match
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect(commentsApi.create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Write something before posting.");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription(/0 \/ 2000 characters.*Write something before posting\./);
  });

  test("posting trims the text, adds the comment, clears the box and moves focus to it", async () => {
    commentsApi.create.mockImplementation(async (postId, body) => comment("5", { _id: ME.id, username: "jah" }, body));
    show();
    const box = await screen.findByLabelText("Add a comment");
    await userEvent.type(box, "  Nice one  ");
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect(commentsApi.create).toHaveBeenCalledWith(POST, "Nice one");
    expect(await screen.findByText("Nice one")).toBeInTheDocument();
    expect(box).toHaveValue("");
    expect(items()[2]).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Comment posted.");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Comments (3)");
  });

  test("over 2000 characters: the counter warns and nothing is sent", async () => {
    show();
    const box = await screen.findByLabelText("Add a comment");
    await userEvent.click(box);
    await userEvent.paste("x".repeat(2001));

    expect(screen.getByText("2001 / 2000 characters")).toHaveClass("comment-form__over");
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));
    expect(commentsApi.create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("up to 2000 characters");
  });

  test("a server error is shown and the typed text is kept", async () => {
    commentsApi.create.mockRejectedValue(new Error("Your session ended. Log in again to continue."));
    show();
    const box = await screen.findByLabelText("Add a comment");
    await userEvent.type(box, "don't lose me");
    await userEvent.click(screen.getByRole("button", { name: "Post comment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your session ended.");
    expect(box).toHaveValue("don't lose me");
  });

  test("Edit opens with my text; Escape cancels and puts focus back on Edit", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Edit your comment" }));

    const editBox = screen.getByLabelText("Edit your comment");
    expect(editBox).toHaveValue("Thanks!"); // initialText, not an empty box
    expect(editBox).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByLabelText("Edit your comment")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Edit your comment" })).toHaveFocus());
    expect(commentsApi.update).not.toHaveBeenCalled();
  });

  test("saving an edit updates the text and focuses the comment", async () => {
    commentsApi.update.mockImplementation(async (postId, id, body) => ({ ...mine, body }));
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Edit your comment" }));
    const editBox = screen.getByLabelText("Edit your comment");
    await userEvent.clear(editBox);
    await userEvent.type(editBox, "Thanks a lot!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(commentsApi.update).toHaveBeenCalledWith(POST, mine._id, "Thanks a lot!");
    expect(await screen.findByText("Thanks a lot!")).toBeInTheDocument();
    expect(items()[1]).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Comment updated.");
  });

  test("delete asks first, removes the comment, then focuses the comment box", async () => {
    commentsApi.remove.mockResolvedValue(null);
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(commentsApi.remove).toHaveBeenCalledWith(POST, mine._id);
    expect(screen.queryByText("Thanks!")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Add a comment")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Comment deleted.");
  });
});
