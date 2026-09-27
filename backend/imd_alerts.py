import httpx

from imd_districts import find_imd_district_id
IMD_WARNING_CODES = {
    "1": "No Warning",
    "2": "Heavy Rain",
    "3": "Heavy Snow",
    "4": "Thunderstorm & Lightning",
    "5": "Hailstorm",
    "6": "Dust Storm",
    "7": "Dust Raising Winds",
    "8": "Strong Surface Winds",
    "9": "Heat Wave",
    "10": "Hot Day",
    "11": "Warm Night",
    "12": "Cold Wave",
    "13": "Cold Day",
    "14": "Ground Frost",
    "15": "Fog",
    "16": "Very Heavy Rain",
    "17": "Extremely Heavy Rain",
}


IMD_COLOR_LEVELS = {
    "1": {
        "name": "RED",
        "severity": "EXTREME",
    },
    "2": {
        "name": "ORANGE",
        "severity": "HIGH",
    },
    "3": {
        "name": "YELLOW",
        "severity": "MODERATE",
    },
    "4": {
        "name": "GREEN",
        "severity": "LOW",
    },
}


async def get_imd_district_warning(
    district_id: int
):
    """
    Get official district-wise warnings from IMD.

    IMD endpoint:
    warnings_district_api.php?id=<district_id>
    """

    url = (
         "https://api.imd.gov.in/api/v1/districtwarning"
    )

    try:

        async with httpx.AsyncClient() as client:

            response = await client.get(
                url,
                params={
                    "id": district_id
                },
                timeout=10,
            )

        response.raise_for_status()

        data = response.json()

        return parse_imd_warning(data)

    except Exception as error:

        return {
            "available": False,
            "official": True,
            "source": "IMD",
            "error": str(error),
            "alerts": [],
        }


def parse_imd_warning(data):

    if isinstance(data, list):
        records = data

    elif isinstance(data, dict):

        if "data" in data and isinstance(data["data"], list):
            records = data["data"]

        else:
            records = [data]

    else:
        records = []

    alerts = []

    for record in records:

        if not isinstance(record, dict):
            continue


        district = record.get(
            "District"
        )


        for day in range(1, 6):

            code_key = f"Day_{day}"

            color_key = f"Day{day}_Color"

            warning_codes = record.get(
                code_key
            )

            color_code = record.get(
                color_key
            )


            if not warning_codes:
                continue


            if str(warning_codes).strip() in {
                "",
                "1",
            }:
                continue


            codes = str(
                warning_codes
            ).split(",")


            color_info = IMD_COLOR_LEVELS.get(
                str(color_code),
                {
                    "name": "UNKNOWN",
                    "severity": "UNKNOWN",
                },
            )


            for code in codes:

                code = code.strip()

                warning_name = (
                    IMD_WARNING_CODES.get(
                        code,
                        f"IMD Warning Code {code}",
                    )
                )


                alerts.append({
                    "source": "IMD",
                    "official": True,
                    "district": district,
                    "day": day,
                    "warning_code": code,
                    "title": warning_name,
                    "severity": color_info[
                        "severity"
                    ],
                    "color": color_info[
                        "name"
                    ],
                })


    return {
        "available": True,
        "official": True,
        "source": "IMD",
        "alerts": alerts,
        "has_alerts": len(alerts) > 0,
    }

async def get_imd_warning_by_location(
    district: str,
    state: str | None = None
):
    """
    Fetch official IMD district warning.

    district: District name detected from reverse geocoding
    state: State name detected from reverse geocoding
    """

    # Temporary mapping.
    # We will expand this into a complete India mapping.
    DISTRICT_IMD_IDS = {
        # Maharashtra
        # Add verified IDs here only.
    }

    if not district:
        return {
            "available": False,
            "official": True,
            "source": "IMD",
            "reason": "District not available",
            "alerts": [],
        }

    district_key = district.strip().lower()

    district_id = DISTRICT_IMD_IDS.get(district_key)

    if not district_id:
        return {
            "available": False,
            "official": True,
            "source": "IMD",
            "district": district,
            "state": state,
            "reason": "IMD district ID not mapped",
            "alerts": [],
        }

    return await get_imd_district_warning(district_id)

async def get_imd_warning_for_location(
    district: str,
    state: str = ""
):
    district_id = await find_imd_district_id(
        district,
        state
    )

    if not district_id:
        return {
            "available": False,
            "official": True,
            "source": "IMD",
            "district": district,
            "state": state,
            "reason": "IMD district ID not available",
            "alerts": [],
        }

    result = await get_imd_district_warning(
        district_id
    )

    result["district"] = district
    result["state"] = state
    result["imd_district_id"] = district_id

    return result