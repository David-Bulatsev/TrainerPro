import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: {
    email: "coach@example.com",
    full_name: "Coach Example",
    permissions: ["athletes:read", "workouts:read"],
  },
  logout: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState,
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows only menu items allowed by permissions", () => {
    render(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText("Спортсмены")).toBeInTheDocument();
    expect(screen.getByText("Тренировки")).toBeInTheDocument();
    expect(screen.queryByText("Медицина")).not.toBeInTheDocument();
    expect(screen.queryByText("Отчеты")).not.toBeInTheDocument();
  });
});
