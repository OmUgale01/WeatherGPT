def build_weather_intelligence(weather):
    current = weather.get("current", {})
    daily = weather.get("daily", {})
    alerts_data = weather.get("alerts", {})

    temperature = current.get("temperature_2m")
    feels_like = current.get("apparent_temperature")
    humidity = current.get("relative_humidity_2m")
    wind = current.get("wind_speed_10m")
    precipitation = current.get("precipitation")
    weather_code = current.get("weather_code")

    rain_probabilities = daily.get(
        "precipitation_probability_max",
        []
    )

    max_temperature = None

    max_temperatures = daily.get(
        "temperature_2m_max",
        []
    )

    if max_temperatures:
        max_temperature = max(max_temperatures)

    max_rain_probability = None

    if rain_probabilities:
        max_rain_probability = max(rain_probabilities)

    # -----------------------------------------------------
    # Risk Factors
    # -----------------------------------------------------

    risks = []

    if temperature is not None:

        if temperature >= 40:
            risks.append("extreme heat")

        elif temperature >= 35:
            risks.append("high temperature")

    if wind is not None and wind >= 40:
        risks.append("strong wind")

    if weather_code in [95, 96, 99]:
        risks.append("thunderstorm")

    if weather_code in [65, 82]:
        risks.append("heavy rain")

    if precipitation is not None and precipitation >= 10:
        risks.append("significant rainfall")

    if max_rain_probability is not None:
        if max_rain_probability >= 80:
            risks.append("high probability of rain")

    # -----------------------------------------------------
    # Travel Recommendation
    # -----------------------------------------------------

    travel_level = "favorable"
    travel_reason = "Current conditions appear generally favorable for travel."

    if (
        weather_code in [95, 96, 99]
        or weather_code in [65, 82]
        or wind is not None and wind >= 60
        or temperature is not None and temperature >= 40
    ):
        travel_level = "high_caution"

        travel_reason = (
            "Current weather conditions may make travel difficult "
            "or uncomfortable. Exercise caution and consider "
            "delaying non-essential travel."
        )

    elif (
        max_rain_probability is not None
        and max_rain_probability >= 80
    ) or (
        wind is not None
        and wind >= 40
    ) or (
        temperature is not None
        and temperature >= 35
    ):
        travel_level = "caution"

        travel_reason = (
            "Travel is possible, but weather conditions may "
            "cause discomfort or disruptions. Plan accordingly."
        )

    # -----------------------------------------------------
    # Outdoor Activity
    # -----------------------------------------------------

    outdoor_level = "favorable"

    if (
        weather_code in [95, 96, 99]
        or weather_code in [65, 82]
        or wind is not None and wind >= 50
    ):
        outdoor_level = "not_recommended"

    elif (
        max_rain_probability is not None
        and max_rain_probability >= 70
    ):
        outdoor_level = "caution"

    # -----------------------------------------------------
    # Temperature Comfort
    # -----------------------------------------------------

    temperature_condition = "comfortable"

    if temperature is not None:

        if temperature >= 40:
            temperature_condition = "extremely hot"

        elif temperature >= 35:
            temperature_condition = "hot"

        elif temperature <= 10:
            temperature_condition = "cold"

    # -----------------------------------------------------
    # Overall Risk
    # -----------------------------------------------------

    overall_risk = "low"

    if (
        weather_code in [95, 96, 99]
        or weather_code in [65, 82]
        or temperature is not None and temperature >= 40
        or wind is not None and wind >= 60
    ):
        overall_risk = "high"

    elif risks:
        overall_risk = "moderate"

    # -----------------------------------------------------
    # Return Intelligence
    # -----------------------------------------------------

    return {
        "overall_risk": overall_risk,

        "travel": {
            "level": travel_level,
            "recommendation": travel_reason,
        },

        "outdoor_activity": {
            "level": outdoor_level,
        },

        "temperature_condition": temperature_condition,

        "risk_factors": risks,

        "current_conditions": {
            "temperature_c": temperature,
            "feels_like_c": feels_like,
            "humidity_percent": humidity,
            "wind_kmh": wind,
            "precipitation_mm": precipitation,
        },

        "forecast": {
            "maximum_temperature_c": max_temperature,
            "maximum_rain_probability_percent": max_rain_probability,
        },

        "alerts": alerts_data,
    }