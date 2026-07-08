import re
import json

try:
    html = open('embed.html', encoding='utf-8').read()
    # Spotify embed pages might not use __NEXT_DATA__ anymore, but let's check it or __STATE__ or whatever.
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if m:
        data = json.loads(m.group(1))
        open('embed.json', 'w').write(json.dumps(data, indent=2))
        print("Parsed __NEXT_DATA__")
    else:
        # Spotify might use a different state injection mechanism now.
        m2 = re.search(r'<script id="resource" type="application/json">(.*?)</script>', html)
        if m2:
            data = json.loads(m2.group(1))
            open('embed.json', 'w').write(json.dumps(data, indent=2))
            print("Parsed resource")
        else:
            print("Could not find JSON state.")
            # Let's write the first 1000 characters to see what we have
            print(html[:1000])
except Exception as e:
    print(f"Error: {e}")
