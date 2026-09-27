def analyze_weather_alerts(weather):
    alerts = []

    current = weather.get("current", {})
    daily = weather.get("daily", {})

    temperature = current.get("temperature_2m")
    wind_speed = current.get("wind_speed_10m")
    precipitation = current.get("precipitation")
    weather_code = current.get("weather_code")

    # -----------------------------
    # Extreme Heat
    # -----------------------------

    if temperature is not None:
        if temperature >= 40:
            alerts.append({
                "type": "extreme_heat",
                "severity": "high",
                "title": "Extreme Heat",
                "message": (
                    f"Temperature is currently {temperature}°C. "
                    "Stay hydrated and avoid prolonged exposure "
                    "to direct sunlight."
                )
            })

        elif temperature >= 35:
            alerts.append({
                "type": "high_temperature",
                "severity": "moderate",
                "title": "High Temperature",
                "message": (
                    f"Temperature is currently {temperature}°C. "
                    "Stay hydrated and limit unnecessary outdoor activity."
                )
            })

    # -----------------------------
    # Strong Wind
    # -----------------------------

    if wind_speed is not None:
        if wind_speed >= 60:
            alerts.append({
                "type": "strong_wind",
                "severity": "high",
                "title": "Strong Wind",
                "message": (
                    f"Wind speed is around {wind_speed} km/h. "
                    "Outdoor travel may become difficult."
                )
            })

        elif wind_speed >= 40:
            alerts.append({
                "type": "strong_wind",
                "severity": "moderate",
                "title": "Strong Winds",
                "message": (
                    f"Wind speed is around {wind_speed} km/h. "
                    "Use caution while travelling outdoors."
                )
            })

    # -----------------------------
    # Thunderstorm
    # -----------------------------

    if weather_code in [95, 96, 99]:
        alerts.append({
            "type": "thunderstorm",
            "severity": "high",
            "title": "Thunderstorm",
            "message": (
                "Thunderstorm conditions are currently detected. "
                "Avoid exposed outdoor areas and seek shelter."
            )
        })

    # -----------------------------
    # Heavy Rain
    # -----------------------------

    if weather_code in [65, 82]:
        alerts.append({
            "type": "heavy_rain",
            "severity": "high",
            "title": "Heavy Rain",
            "message": (
                "Heavy rainfall conditions are currently detected. "
                "Travel may be affected."
            )
        })

    elif precipitation is not None and precipitation >= 10:
        alerts.append({
            "type": "heavy_rain",
            "severity": "moderate",
            "title": "Heavy Rainfall",
            "message": (
                f"Current precipitation is {precipitation} mm. "
                "Be cautious while travelling."
            )
        })

    # -----------------------------
    # High Rain Probability
    # -----------------------------

    rain_probabilities = daily.get(
        "precipitation_probability_max",
        []
    )

    if rain_probabilities:
        max_rain_probability = max(
            rain_probabilities
        )

        if max_rain_probability >= 80:
            alerts.append({
                "type": "rain_probability",
                "severity": "moderate",
                "title": "High Chance of Rain",
                "message": (
                    f"There is up to a "
                    f"{max_rain_probability}% chance "
                    "of precipitation in the forecast."
                )
            })

    # -----------------------------
    # Forecast Heat
    # -----------------------------

    max_temperatures = daily.get(
        "temperature_2m_max",
        []
    )

    if max_temperatures:
        maximum_temperature = max(
            max_temperatures
        )

        if maximum_temperature >= 42:
            alerts.append({
                "type": "forecast_heat",
                "severity": "high",
                "title": "Extreme Heat Forecast",
                "message": (
                    f"The forecast reaches approximately "
                    f"{maximum_temperature}°C."
                )
            })

    # -----------------------------
    # Overall Severity
    # -----------------------------

    severity_order = {
        "low": 1,
        "moderate": 2,
        "high": 3,
        "critical": 4,
    }

    highest_severity = "low"

    for alert in alerts:
        if (
            severity_order[alert["severity"]]
            > severity_order[highest_severity]
        ):
            highest_severity = alert["severity"]

    return {
        "has_alerts": len(alerts) > 0,
        "severity": highest_severity,
        "alerts": alerts,
    }