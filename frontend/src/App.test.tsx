import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  setApiToken: vi.fn(),
}));

vi.mock("./lib/api", () => ({
  api: {
    login: apiMock.login,
    register: apiMock.register,
    getCurrentUser: apiMock.getCurrentUser,
  },
  setApiToken: apiMock.setApiToken,
}));

vi.mock("./components/LandingPage", () => ({
  LandingPage: () => <div>Landing Page</div>,
}));
vi.mock("./components/Login", () => ({
  Login: () => <div>Login Screen</div>,
}));
vi.mock("./components/Dashboard", () => ({
  Dashboard: () => <div>Dashboard Screen</div>,
}));
vi.mock("./components/Athletes", () => ({
  Athletes: () => <div>Athletes Screen</div>,
}));
vi.mock("./components/Calendar", () => ({
  Calendar: () => <div>Calendar Screen</div>,
}));
vi.mock("./components/Medical", () => ({
  Medical: () => <div>Medical Screen</div>,
}));
vi.mock("./components/Reports", () => ({
  Reports: () => <div>Reports Screen</div>,
}));
vi.mock("./components/Workouts", () => ({
  Workouts: () => <div>Workouts Screen</div>,
}));
vi.mock("./components/NotFoundPage", () => ({
  NotFoundPage: () => <div>Not Found</div>,
}));

import App from "./App";
import { AuthProvider } from "./context/AuthContext";

describe("App routing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders public landing page", async () => {
    window.history.pushState({}, "", "/");

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    expect(await screen.findByText("Landing Page")).toBeInTheDocument();
  });

  it("redirects protected route to login without session", async () => {
    window.history.pushState({}, "", "/app/dashboard");

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    expect(await screen.findByText("Login Screen")).toBeInTheDocument();
  });

  it("restores valid session for protected route", async () => {
    localStorage.setItem("authToken", "saved-token");
    apiMock.getCurrentUser.mockResolvedValueOnce({
      id: 1,
      email: "trainer@gmail.com",
      full_name: "Trainer",
      is_active: true,
      roles: ["manager"],
      permissions: ["athletes:read"],
      created_at: "",
      updated_at: "",
    });
    window.history.pushState({}, "", "/app/dashboard");

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("Dashboard Screen")).toBeInTheDocument());
  });

  it("drops expired session and returns to login", async () => {
    localStorage.setItem("authToken", "expired-token");
    apiMock.getCurrentUser.mockRejectedValueOnce(new Error("expired"));
    window.history.pushState({}, "", "/app/dashboard");

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("Login Screen")).toBeInTheDocument());
    expect(localStorage.getItem("authToken")).toBeNull();
  });
});
