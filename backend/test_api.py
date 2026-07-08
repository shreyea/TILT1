import requests
import time

print("Testing /trending...")
start = time.time()
try:
    r = requests.get("http://localhost:8000/trending?limit=5", timeout=10)
    print("Status:", r.status_code)
    print("Response:", r.json())
except Exception as e:
    print("Error:", e)
print(f"Took {time.time() - start:.2f} seconds")
