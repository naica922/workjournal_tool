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
  it("renders first name, last name, email and password fields", () => {
    const { container } = render(<RegisterForm />);

    for (const name of ["firstName", "lastName", "email", "password"]) {
      expect(
        container.querySelector(`md-outlined-text-field[name="${name}"]`),
      ).toBeInTheDocument();
    }
  });

  it("requires birth date and apprenticeship start for apprentices", () => {
    const { container } = render(<RegisterForm />);

    expect(container.querySelector('input[name="birthday"]')).toBeRequired();
    expect(
      container.querySelector('input[name="apprenticeshipStart"]'),
    ).toBeRequired();
  });

  it("offers the apprentice and host roles with apprentice preselected", () => {
    const { container } = render(<RegisterForm />);

    const apprentice = container.querySelector('md-radio[value="apprentice"]');
    const host = container.querySelector('md-radio[value="host"]');
    expect(apprentice).toBeInTheDocument();
    expect(host).toBeInTheDocument();
  });

  it("hides the apprenticeship start date for hosts", async () => {
    const { container } = render(<RegisterForm />);

    const hostLabel = screen.getByText("Host").closest("label")!;
    hostLabel.click();

    // React re-renders after the click; wait a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      container.querySelector('input[name="apprenticeshipStart"]'),
    ).not.toBeInTheDocument();
  });

  it("links back to the login page", () => {
    render(<RegisterForm />);

    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
