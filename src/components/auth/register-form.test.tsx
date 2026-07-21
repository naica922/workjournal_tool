import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./register-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  signUp: { email: vi.fn() },
}));

describe("RegisterForm", () => {
  it("renders name, email and password fields", () => {
    const { container } = render(<RegisterForm />);

    for (const name of ["name", "email", "password"]) {
      expect(
        container.querySelector(`md-outlined-text-field[name="${name}"]`),
      ).toBeInTheDocument();
    }
  });

  it("offers the apprentice and host roles with apprentice preselected", () => {
    const { container } = render(<RegisterForm />);

    const apprentice = container.querySelector('md-radio[value="apprentice"]');
    const host = container.querySelector('md-radio[value="host"]');
    expect(apprentice).toBeInTheDocument();
    expect(host).toBeInTheDocument();
    expect(apprentice).toHaveAttribute("checked");
    expect(host).not.toHaveAttribute("checked");
  });

  it("links back to the login page", () => {
    render(<RegisterForm />);

    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
