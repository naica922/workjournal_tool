import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
}));

describe("LoginForm", () => {
  it("renders email and password fields and a sign-in button", () => {
    const { container } = render(<LoginForm googleEnabled={false} />);

    expect(
      container.querySelector('md-outlined-text-field[name="email"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('md-outlined-text-field[name="password"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('md-filled-button[type="submit"]'),
    ).toBeInTheDocument();
  });

  it("links to the registration page (UC-02)", () => {
    render(<LoginForm googleEnabled={false} />);

    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("hides the Google button when Google sign-in is not configured", () => {
    const { container } = render(<LoginForm googleEnabled={false} />);
    expect(container.querySelector("md-outlined-button")).not.toBeInTheDocument();
  });

  it("shows the Google button when Google sign-in is configured", () => {
    const { container } = render(<LoginForm googleEnabled={true} />);
    expect(container.querySelector("md-outlined-button")).toBeInTheDocument();
  });
});
