import { expect, test } from "@playwright/test";

const managerUser = {
  id: 1,
  email: "trainer@gmail.com",
  full_name: "Demo Trainer",
  is_active: true,
  roles: ["manager"],
  permissions: [
    "athletes:read",
    "athletes:write",
    "workouts:read",
    "workouts:write",
    "attendance:read",
    "injuries:read",
    "reports:read",
    "files:read",
    "files:write",
  ],
  created_at: "2026-04-10T00:00:00Z",
  updated_at: "2026-04-10T00:00:00Z",
};

const readonlyUser = {
  ...managerUser,
  email: "readonly@example.com",
  roles: ["user"],
  permissions: ["athletes:read", "workouts:read", "attendance:read", "files:read"],
};

async function mockDashboardRoutes(page, weatherStatus: "ok" | "fail" = "ok") {
  await page.route("**/auth/login", async (route) => {
    await route.fulfill({ json: { access_token: "token", token_type: "bearer" } });
  });
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({ json: managerUser });
  });
  await page.route("**/athletes/?limit=200", async (route) => {
    await route.fulfill({
      json: [
        { id: 1, name: "Ivan Sprinter", contact_info: '{"attendance":88,"status":"active","avatar":"IS"}', created_at: "2026-04-10T00:00:00Z" },
      ],
    });
  });
  await page.route("**/workouts/?limit=500", async (route) => {
    await route.fulfill({
      json: [
        {
          id: 10,
          date: "2099-04-10T12:00:00Z",
          time: "12:00",
          location: "Moscow",
          description: "Sprint session",
          created_at: "2026-04-10T00:00:00Z",
        },
      ],
    });
  });
  await page.route("**/attendance/?limit=1000", async (route) => {
    await route.fulfill({
      json: [{ id: 100, athlete_id: 1, workout_id: 10, status: "present", created_at: "2026-04-10T00:00:00Z" }],
    });
  });
  await page.route("**/external/weather?*", async (route) => {
    if (weatherStatus === "fail") {
      await route.fulfill({ status: 503, json: { detail: "Weather provider is unavailable" } });
      return;
    }
    await route.fulfill({
      json: {
        location: "Moscow",
        source: "OpenWeather",
        generatedAt: "2026-04-10T00:00:00Z",
        items: [{ time: "2026-04-10 12:00:00", temperatureC: 18, windSpeedMps: 4, condition: "Clear" }],
      },
    });
  });
}

test("login, restore session, and logout", async ({ page }) => {
  await mockDashboardRoutes(page);

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("trainer@gmail.com");
  await page.locator('input[type="password"]').fill("123123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByText("Team dashboard")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.locator("aside button").last().click();
  await expect(page).toHaveURL(/\/login/);
});

test("weather widget handles provider failure gracefully", async ({ page }) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({ json: managerUser });
  });
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "token");
  });
  await mockDashboardRoutes(page, "fail");

  await page.goto("/app/dashboard");
  await expect(page.getByText(/The dashboard continues to work without the external API/)).toBeVisible();
});

test("role-based athlete page hides write actions for readonly user", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "token");
  });
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({ json: readonlyUser });
  });
  await page.route("**/athletes/paged?*", async (route) => {
    await route.fulfill({
      json: {
        items: [{ id: 1, name: "Read Only Athlete", contact_info: '{"sport":"Sprint","status":"active","attendance":90,"avatar":"RO"}', created_at: "2026-04-10T00:00:00Z" }],
        total: 1,
        page: 1,
        page_size: 20,
      },
    });
  });
  await page.route("**/athletes/?limit=2000", async (route) => {
    await route.fulfill({
      json: [{ id: 1, name: "Read Only Athlete", contact_info: '{"sport":"Sprint","status":"active","attendance":90,"avatar":"RO"}', created_at: "2026-04-10T00:00:00Z" }],
    });
  });

  await page.goto("/app/athletes");

  await expect(page.getByText("Read Only Athlete")).toBeVisible();
  await expect(page.getByRole("button", { name: /добавить спортсмена/i })).toHaveCount(0);
});
