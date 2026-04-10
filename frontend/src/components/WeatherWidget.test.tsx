import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  getWeatherInsights: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  api: {
    getWeatherInsights: apiMock.getWeatherInsights,
  },
}));

import { WeatherWidget } from "./WeatherWidget";

describe("WeatherWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders successful weather response", async () => {
    apiMock.getWeatherInsights.mockResolvedValueOnce({
      location: "Moscow",
      source: "OpenWeather",
      generatedAt: "2026-04-10T00:00:00Z",
      items: [
        {
          time: "2026-04-10 12:00:00",
          temperatureC: 18,
          windSpeedMps: 4,
          condition: "Clear",
        },
      ],
    });

    render(<WeatherWidget location="Moscow" />);

    expect(screen.getByText("Loading forecast...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Clear")).toBeInTheDocument());
    expect(screen.getByText("18°C")).toBeInTheDocument();
  });

  it("renders graceful degradation on error", async () => {
    apiMock.getWeatherInsights.mockRejectedValueOnce(new Error("provider unavailable"));

    render(<WeatherWidget location="Moscow" />);

    await waitFor(() =>
      expect(screen.getByText(/The dashboard continues to work without the external API/)).toBeInTheDocument()
    );
  });
});
