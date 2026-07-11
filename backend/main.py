# backend/main.py
# FastAPI server — ties Spotify metadata + YouTube audio extraction together
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from spotify import (
    search_songs, get_track_details, get_recommendations,
    get_trending_tracks, get_new_releases, get_mood_recommendations,
    search_artist_tracks, fetch_spotify_playlist
)
from audio import get_audio_url, get_audio_url_by_id
from playlist import (
    init_db, get_playlists, create_playlist, get_playlist_tracks, add_to_playlist,
    remove_from_playlist, delete_playlist, toggle_like, get_liked_songs, is_liked,
    reorder_playlist_tracks, increment_play_count, get_top_tracks
)
from pydantic import BaseModel
from typing import Optional, List
import re
import logging
import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    """Modern lifespan handler — replaces deprecated @app.on_event('startup')."""
    init_db()
    logger.info("Database initialized")
    yield


app = FastAPI(
    title="Music Streaming API",
    description="Personal music streaming backend — Spotify metadata + YouTube audio",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow connections from Expo dev server and mobile devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # For local dev — restrict in production
    allow_methods=['*'],
    allow_headers=['*'],
)


# ─── Pydantic Models ───────────────────────────────────────

class TrackInput(BaseModel):
    id: Optional[str] = ''
    title: str
    artist: str
    album: Optional[str] = ''
    art_url: Optional[str] = ''
    art_url_small: Optional[str] = ''
    duration_ms: Optional[int] = 0


class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = ''


class SpotifyImportRequest(BaseModel):
    url: str
    enhance_with_recommendations: Optional[bool] = False


def extract_playlist_id(url: str) -> Optional[str]:
    """Extract Spotify playlist ID from various URL formats."""
    patterns = [
        r'spotify\.com/playlist/([A-Za-z0-9]+)',
        r'spotify:playlist:([A-Za-z0-9]+)',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


# ─── Search ─────────────────────────────────────────────────

@app.get('/search')
def search(q: str = Query(..., min_length=2, description="Search query")):
    """Search for songs using Spotify metadata."""
    try:
        results = search_songs(q)
        return {'results': results, 'count': len(results)}
    except Exception as e:
        logger.error(f'Search failed: {e}')
        raise HTTPException(500, f'Search failed: {str(e)}')


@app.get('/track/{track_id}')
def track_details(track_id: str):
    """Get details for a specific track by Spotify ID."""
    try:
        return get_track_details(track_id)
    except Exception as e:
        raise HTTPException(404, f'Track not found: {str(e)}')


@app.get('/recommendations')
def recommendations(track_ids: str = Query(..., description="Comma-separated Spotify track IDs")):
    """Get song recommendations based on seed tracks."""
    ids = [t.strip() for t in track_ids.split(',') if t.strip()]
    if not ids:
        raise HTTPException(400, 'Provide at least one track ID')
    return {'results': get_recommendations(ids)}


@app.get('/based-suggestions')
def based_suggestions():
    """Get recommendations based on most played tracks and recently liked songs."""
    try:
        # Get up to 3 top played tracks
        top = get_top_tracks(3)
        # Get up to 2 recently liked songs
        liked = get_liked_songs()[:2]
        
        seeds = list(set([t.get('spotify_id') or t.get('id') for t in top + liked if t.get('spotify_id') or t.get('id')]))
        
        if not seeds:
            return {'results': [], 'count': 0}
            
        # Spotify allows up to 5 seed tracks
        seeds = seeds[:5]
        
        recs = get_recommendations(seeds, limit=15)
        return {'results': recs, 'count': len(recs)}
    except Exception as e:
        logger.error(f'Based suggestions failed: {e}')
        return {'results': [], 'count': 0}


# ─── Discovery ──────────────────────────────────────────────

@app.get('/trending')
def trending(country: str = 'US', limit: int = 20):
    """Get trending/popular tracks."""
    try:
        results = get_trending_tracks(country, limit)
        return {'results': results, 'count': len(results)}
    except Exception as e:
        logger.error(f'Trending failed: {e}')
        return {'results': [], 'count': 0}


@app.get('/new-releases')
def new_releases(country: str = 'US', limit: int = 15):
    """Get new album releases with lead tracks."""
    try:
        results = get_new_releases(country, limit)
        return {'results': results, 'count': len(results)}
    except Exception as e:
        logger.error(f'New releases failed: {e}')
        return {'results': [], 'count': 0}


@app.get('/mood/{mood}')
def mood_tracks(mood: str, limit: int = 15):
    """Get tracks matching a mood. Valid moods: morning, workout, night, focus, party, sad, happy, relax."""
    try:
        results = get_mood_recommendations(mood, limit)
        return {'results': results, 'count': len(results)}
    except Exception as e:
        logger.error(f'Mood tracks failed: {e}')
        return {'results': [], 'count': 0}


@app.get('/artist/{artist_name}')
def artist_tracks(artist_name: str, limit: int = 15):
    """Get top tracks for an artist + related artist tracks."""
    try:
        results = search_artist_tracks(artist_name, limit)
        return {'results': results, 'count': len(results)}
    except Exception as e:
        logger.error(f'Artist search failed: {e}')
        return {'results': [], 'count': 0}


# ─── Audio Streaming ────────────────────────────────────────

@app.get('/stream')
def stream(
    request: Request,
    title: str = Query(..., description="Song title"),
    artist: str = Query(..., description="Artist name"),
    id: str = Query(None, description="YouTube Video ID")
):
    """
    Get a streamable audio URL.
    Proxies through the backend to bypass YouTube's IP restrictions.
    """
    try:
        # If we have the exact YouTube ID from YTMusic metadata, stream it directly!
        if id and len(id) == 11 and not id.startswith('spotify'):
            result = get_audio_url_by_id(id)
        else:
            # Fallback to searching YouTube
            result = get_audio_url(title, artist)
            
        raw_url = result.get('url')
        if not raw_url:
            raise ValueError("No URL found")
            
        # Construct proxy URL
        import urllib.parse
        base_url = str(request.base_url).rstrip('/')
        proxy_url = f"{base_url}/proxy-stream?url={urllib.parse.quote(raw_url)}"
        
        result['url'] = proxy_url
        return result
    except Exception as e:
        logger.error(f'Stream failed for "{title}" by {artist}: {e}')
        raise HTTPException(500, f'Audio extraction failed: {str(e)}')

@app.get('/proxy-stream')
def proxy_stream(request: Request, url: str = Query(...)):
    """
    Proxies the audio stream from YouTube to the client.
    This bypasses the IP lock that Google enforces on googlevideo.com URLs.
    """
    import requests
    headers = {}
    if 'Range' in request.headers:
        headers['Range'] = request.headers['Range']
        
    try:
        r = requests.get(url, headers=headers, stream=True, timeout=10)
        
        def generate():
            try:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
            finally:
                r.close()
                
        # Pass through essential streaming headers
        response_headers = {}
        for k, v in r.headers.items():
            if k.lower() in ('content-type', 'content-length', 'content-range', 'accept-ranges'):
                response_headers[k] = v
                
        return StreamingResponse(
            generate(), 
            status_code=r.status_code, 
            headers=response_headers
        )
    except Exception as e:
        logger.error(f"Proxy stream error: {e}")
        raise HTTPException(502, "Failed to proxy media stream")

# ─── Playlists ──────────────────────────────────────────────

@app.get('/playlists')
def list_playlists():
    """Get all playlists."""
    return {'playlists': get_playlists()}


@app.post('/playlists')
def new_playlist(data: PlaylistCreate):
    """Create a new playlist."""
    try:
        pl = create_playlist(data.name, data.description)
        return pl
    except ValueError as e:
        raise HTTPException(409, str(e))


@app.get('/playlists/{playlist_id}/tracks')
def playlist_tracks(playlist_id: int):
    """Get all tracks in a playlist."""
    tracks = get_playlist_tracks(playlist_id)
    return {'tracks': tracks, 'count': len(tracks)}


@app.post('/playlists/{playlist_id}/tracks')
def add_track(playlist_id: int, track: TrackInput):
    """Add a track to a playlist."""
    add_to_playlist(playlist_id, track.model_dump())
    return {'status': 'added'}

class ReorderInput(BaseModel):
    track_ids: list[int]

@app.put('/playlists/{playlist_id}/tracks/reorder')
def reorder_tracks(playlist_id: int, data: ReorderInput):
    """Reorder tracks in a playlist."""
    reorder_playlist_tracks(playlist_id, data.track_ids)
    return {'status': 'reordered'}


@app.delete('/playlists/tracks/{track_db_id}')
def remove_track(track_db_id: int):
    """Remove a track from a playlist."""
    remove_from_playlist(track_db_id)
    return {'status': 'removed'}


@app.delete('/playlists/{playlist_id}')
def del_playlist(playlist_id: int):
    """Delete a playlist and all its tracks."""
    delete_playlist(playlist_id)
    return {'status': 'deleted'}


# ─── Liked Songs ────────────────────────────────────────────

@app.get('/liked')
def liked_songs():
    """Get all liked songs."""
    songs = get_liked_songs()
    return {'songs': songs, 'count': len(songs)}


@app.post('/liked/toggle')
def toggle_liked(track: TrackInput):
    """Toggle like on a track. Returns whether it is now liked."""
    liked = toggle_like(track.model_dump())
    return {'liked': liked}


@app.get('/liked/check/{track_id}')
def check_liked(track_id: str):
    """Check if a track is liked."""
    return {'liked': is_liked(track_id)}


# ─── Play Counts ────────────────────────────────────────────

@app.post('/play')
def log_play(track: TrackInput):
    """Log a play for a track to update play counts."""
    increment_play_count(track.model_dump())
    return {'status': 'logged'}


# ─── Spotify Playlist Import ────────────────────────────────

@app.post('/playlists/import/spotify')
def import_spotify_playlist(req: SpotifyImportRequest):
    """
    Import a Spotify playlist into the app.
    1. Fetch all tracks from Spotify using the URL.
    2. Attempt to match each track against our catalog via search.
    3. Create a new native playlist with matched tracks.
    4. Optionally add recommendations based on matched tracks.
    Returns full results including unmatched tracks.
    """
    # Step 1: Extract playlist ID
    playlist_id = extract_playlist_id(req.url)
    if not playlist_id:
        raise HTTPException(400, 'Invalid Spotify playlist URL. Expected format: https://open.spotify.com/playlist/...')

    # Step 2: Fetch from Spotify
    try:
        sp_data = fetch_spotify_playlist(playlist_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

    sp_tracks = sp_data['tracks']
    if not sp_tracks:
        raise HTTPException(404, 'Playlist is empty or private.')

    # Step 3: Create the native playlist
    try:
        native_pl = create_playlist(
            name=sp_data['name'],
            description=sp_data.get('description', f"Imported from Spotify · {sp_data['owner']}")
        )
    except ValueError:
        # Playlist name already exists — append a suffix
        native_pl = create_playlist(
            name=f"{sp_data['name']} (Spotify)",
            description=f"Imported from Spotify · {sp_data['owner']}"
        )

    pl_id = native_pl['id']

    # Step 4: Add tracks to our native playlist
    matched = []
    unmatched = []

    for track in sp_tracks:
        best = track.copy()
        # Use the playlist cover as a fallback for track art
        if not best.get('art_url'):
            best['art_url'] = sp_data['cover_url']
            best['art_url_small'] = sp_data['cover_url']
            
        try:
            add_to_playlist(pl_id, best)
            matched.append({**best, 'spotify_source': track})
        except Exception:
            unmatched.append(track)

    # Step 5: Optional — enhance with recommendations based on matched tracks
    recommendations_added = []
    if req.enhance_with_recommendations and matched:
        seed_ids = [t['id'] for t in matched[:5] if t.get('id')]
        try:
            recs = get_recommendations(seed_ids, limit=5)
            for rec in recs:
                add_to_playlist(pl_id, rec)
                recommendations_added.append(rec)
        except Exception:
            pass  # Recommendations are best-effort

    return {
        'playlist': native_pl,
        'spotify_metadata': {
            'name': sp_data['name'],
            'owner': sp_data['owner'],
            'cover_url': sp_data['cover_url'],
            'total_tracks': sp_data['total'],
        },
        'stats': {
            'total': len(sp_tracks),
            'matched': len(matched),
            'unmatched': len(unmatched),
            'recommendations_added': len(recommendations_added),
        },
        'matched_tracks': matched,
        'unmatched_tracks': unmatched,
        'recommendations': recommendations_added,
    }


# ─── Health Check ───────────────────────────────────────────

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'music-streaming-api'}


# ─── Root Endpoint ─────────────────────────────────────────

@app.get("/", tags=["Status"])
async def read_root():
    """A simple endpoint to confirm the API is running."""
    return {"status": "ok", "message": "Welcome to the Music Streaming API!"}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
