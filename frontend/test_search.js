async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function findVideoId(title, artist) {
  const query = `${title} ${artist} audio`.trim();
  const instance = 'https://pipedapi.wireway.ch';
  
  console.log(`[Search] Trying Piped search: ${instance} for "${query}"`);
  const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
  const data = await fetchJSON(url);
  const items = data.items || data;

  if (items && items.length > 0) {
    const videoUrl = items[0].url || '';
    const videoId = videoUrl.includes('v=')
      ? videoUrl.split('v=')[1]?.split('&')[0]
      : videoUrl.split('/').pop();

    if (videoId && videoId.length >= 8) {
      console.log(`[Search] ✓ Found videoId: ${videoId} via ${instance}`);
      return videoId;
    }
  }
  return null;
}

findVideoId('About You', 'The 1975').then(id => {
  if (id) console.log('SUCCESS! VideoId:', id);
  else console.error('FAILED to find videoId');
}).catch(err => {
  console.error('ERROR:', err);
});
