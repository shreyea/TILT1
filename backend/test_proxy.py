import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        # Get stream URL
        print("Getting stream URL...")
        res = await client.get("http://localhost:8000/stream?title=Shape%20Of%20You&artist=Ed%20Sheeran", timeout=30)
        res.raise_for_status()
        data = res.json()
        print(f"Data: {data}")
        
        url = data['url']
        print(f"Proxy URL: {url}")
        
        # Test proxy stream
        print("Testing proxy stream...")
        async with client.stream("GET", url, headers={"Range": "bytes=0-1000"}) as stream_res:
            print(f"Status: {stream_res.status_code}")
            print(f"Headers: {stream_res.headers}")
            async for chunk in stream_res.aiter_bytes():
                print(f"Received chunk of {len(chunk)} bytes")
                break
                
asyncio.run(test())
