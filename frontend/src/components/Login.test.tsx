import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const authMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authMock,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { Login } from "./Login";

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits login form and redirects to dashboard", async () => {
    authMock.login.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("coach@demo.local"), "trainer@gmail.com");
    await user.type(document.querySelector('input[type="password"]') as HTMLInputElement, "123123");
    await user.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => expect(authMock.login).toHaveBeenCalledWith("trainer@gmail.com", "123123"));
    expect(navigateMock).toHaveBeenCalledWith("/app/dashboard");
  });

  it("shows error when login fails", async () => {
    authMock.login.mockRejectedValueOnce(new Error("bad credentials"));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("coach@demo.local"), "trainer@gmail.com");
    await user.type(document.querySelector('input[type="password"]') as HTMLInputElement, "wrong");
    await user.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);

    await waitFor(() => expect(screen.getByText("bad credentials")).toBeInTheDocument());
  });
});
