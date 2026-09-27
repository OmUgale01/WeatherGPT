async def find_imd_district_id(
    district: str,
    state: str = ""
):
    """
    IMD district ID lookup.

    Official IMD district APIs require authentication.
    We therefore do not guess district IDs.
    """

    return None