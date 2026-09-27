import asyncio
import httpx

from imd_districts import IMD_DISTRICT_LIST_URL


async def main():
    print("Testing IMD endpoint...")
    print(IMD_DISTRICT_LIST_URL)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                IMD_DISTRICT_LIST_URL,
                timeout=15,
            )

        print("\nHTTP status:", response.status_code)
        print("\nResponse headers:")
        print(response.headers)

        print("\nResponse:")
        print(response.text[:5000])

    except Exception as error:
        print("\nERROR:")
        print(error)


asyncio.run(main())