export interface WeatherForecastItem {
  time: string;
  temperatureC: number;
  windSpeedMps: number;
  condition: string;
}

export interface WeatherInsights {
  location: string;
  source: string;
  generatedAt: string;
  items: WeatherForecastItem[];
}

