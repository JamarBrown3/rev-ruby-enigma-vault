// Runs before every test file.
// jest-dom adds readable checks like expect(button).toHaveAttribute(...).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Remove whatever the last test drew, so tests can't affect each other.
afterEach(() => cleanup());
