import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  setApiToken: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  api: {
    login: apiMock.login,
    register: apiMock.register,
    getCurrentUser: apiMock.getCurrentUser,
  },
  setApiToken: apiMock.setApiToken,
}));

import { AuthProvider, useAuth } from "./AuthContext";

function Harness() {
  const { user, initializing, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="initializing">{String(initializing)}</div>
      <div data-testid="user-email">{user?.email ?? "anonymous"}</div>
      <button type="button" onClick={() => void login("trainer@gmail.com", "123123")}>
        trigger-login
      </button>
      <button type="button" onClick={logout}>
        trigger-logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("restores session from localStorage", async () => {
    localStorage.setItem("authToken", "saved-token");
    apiMock.getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "trainer@gmail.com",
      is_active: true,
      roles: ["manager"],
      permissions: ["athletes:read"],
      created_at: "",
      updated_at: "",
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("user-email")).toHaveTextContent("trainer@gmail.com");
    expect(apiMock.setApiToken).toHaveBeenCalledWith("saved-token");
  });

  it("clears expired session when profile restore fails", async () => {
    localStorage.setItem("authToken", "expired-token");
    apiMock.getCurrentUser.mockRejectedValueOnce(new Error("expired"));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("user-email")).toHaveTextContent("anonymous");
    expect(localStorage.getItem("authToken")).toBeNull();
  });

  it("logs in and logs out", async () => {
    apiMock.login.mockResolvedValueOnce({ access_token: "fresh-token" });
    apiMock.getCurrentUser
      .mockResolvedValueOnce({
        id: 1,
        email: "trainer@gmail.com",
        is_active: true,
        roles: ["manager"],
        permissions: ["athletes:read", "athletes:write"],
        created_at: "",
        updated_at: "",
      })
      .mockResolvedValueOnce({
      id: 1,
      email: "trainer@gmail.com",
      is_active: true,
      roles: ["manager"],
      permissions: ["athletes:read", "athletes:write"],
      created_at: "",
      updated_at: "",
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "trigger-login" }));

    await waitFor(() => expect(screen.getByTestId("user-email")).toHaveTextContent("trainer@gmail.com"));
    expect(localStorage.getItem("authToken")).toBe("fresh-token");

    await user.click(screen.getByRole("button", { name: "trigger-logout" }));
    expect(screen.getByTestId("user-email")).toHaveTextContent("anonymous");
    expect(localStorage.getItem("authToken")).toBeNull();
  });
});
