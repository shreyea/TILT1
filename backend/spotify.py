# backend/spotify.py
# (Kept filename for backward compatibility)
# YouTube Music API wrapper — metadata, search, discovery, and recommendations
# Replaces Spotify to bypass Premium API restrictions
import os
from ytmusicapi import YTMusic
import logging

logger = logging.getLogger(__name__)

# Initialize YTMusic (no auth required for these endpoints!)
yt = YTMusic()

import time
import requests

def _retry_yt_call(func, *args, retries=3, delay=1.0, **kwargs):
    """Generic retry wrapper for YTMusic API calls."""
    for attempt in range(retries):
        try:
            return func(*args, **kwargs)
        except (requests.exceptions.ConnectionError, ConnectionResetError) as e:
            if attempt == retries - 1:
                logger.error(f"YTMusic API failed after {retries} attempts: {e}")
                raise
            logger.warning(f"Connection error on attempt {attempt + 1}, retrying in {delay}s...")
            time.sleep(delay)
        except Exception as e:
            # For other exceptions (like ValueError), do not retry
            logger.error(f"YTMusic API error: {e}")
            raise

def _format_track(item):
    """Shared helper to format a YTMusic track into our standard dict."""
    try:
        # Extract artists
        artists_list = item.get('artists', [])
        artists = ', '.join([a['name'] for a in artists_list if 'name' in a]) if artists_list else 'Unknown Artist'
        
        # Extract album
        album = item.get('album')
        album_name = album.get('name', '') if album else ''
        
        # Extract thumbnails
        thumbnails = item.get('thumbnails', [])
        art_url = thumbnails[0]['url'] if thumbnails else ''
        art_url_small = thumbnails[-1]['url'] if thumbnails else ''
        if art_url:
            # Clean up thumbnail URLs if they have sizing params
            if '=' in art_url: art_url = art_url.split('=')[0] + '=w600-h600-l90-rj'
            if '=' in art_url_small: art_url_small = art_url_small.split('=')[0] + '=w120-h120-l90-rj'
            
        # Extract duration
        duration_sec = item.get('duration_seconds')
        if not duration_sec and item.get('duration'):
            parts = str(item['duration']).split(':')
            if len(parts) == 2:
                duration_sec = int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                duration_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            else:
                duration_sec = 0
                
        duration_ms = (duration_sec or 0) * 1000

        return {
            'id': item.get('videoId', ''),
            'title': item.get('title', 'Unknown Title'),
            'artist': artists,
            'album': album_name,
            'art_url': art_url,
            'art_url_small': art_url_small,
            'duration_ms': duration_ms,
            'popularity': 0, # YTMusic doesn't return exact popularity in search
            'preview_url': None, # We stream the full audio anyway
        }
    except Exception as e:
        logger.error(f"Error formatting track: {e} - Item: {item.get('title')}")
        return None


def search_songs(query: str, limit: int = 10):
    """
    Search YouTube Music for tracks matching the query.
    """
    try:
        results = _retry_yt_call(yt.search, query, filter='songs', limit=limit)
        tracks = [_format_track(item) for item in results]
        return [t for t in tracks if t and t['id']]
    except Exception as e:
        logger.error(f'Search failed for "{query}": {e}')
        return []


def get_track_details(track_id: str):
    """Get full details for a single track by YT videoId."""
    try:
        item = _retry_yt_call(yt.get_song, track_id)
        if not item or 'videoDetails' not in item:
            raise ValueError("Invalid track ID")
        
        details = item['videoDetails']
        thumbnails = details.get('thumbnail', {}).get('thumbnails', [])
        
        return {
            'id': details.get('videoId', track_id),
            'title': details.get('title', ''),
            'artist': details.get('author', ''),
            'album': '', # get_song doesn't reliably return album
            'art_url': thumbnails[-1]['url'] if thumbnails else '',
            'art_url_small': thumbnails[0]['url'] if thumbnails else '',
            'duration_ms': int(details.get('lengthSeconds', 0)) * 1000,
            'popularity': 0,
            'preview_url': None,
        }
    except Exception as e:
        logger.error(f"Track details failed for {track_id}: {e}")
        return None

def get_recommendations(seed_track_ids: list, limit: int = 15):
    """
    Get recommended tracks based on seed tracks using YT Music's 'Up Next' feature (watch playlist).
    """
    if not seed_track_ids:
        return []
    try:
        # Use the first seed track to generate a radio/watch playlist
        vid_id = seed_track_ids[0]
        watch_pl = _retry_yt_call(yt.get_watch_playlist, videoId=vid_id, limit=limit + 5)
        
        tracks = []
        seed_set = set(seed_track_ids)
        for item in watch_pl.get('tracks', []):
            if item.get('videoId') and item.get('videoId') not in seed_set:
                formatted = _format_track(item)
                if formatted:
                    tracks.append(formatted)
                    if len(tracks) >= limit:
                        break
        return tracks
    except Exception as e:
        logger.error(f'Recommendations failed: {e}')
        return []


def get_mood_recommendations(mood: str, limit: int = 15):
    """
    Get tracks matching a mood/activity.
    """
    # Mapping moods to YTMusic categories/queries
    mood_queries = {
        'morning': 'morning acoustic chill',
        'workout': 'workout motivation edm',
        'night': 'late night vibes rnb',
        'focus': 'deep focus study lofi',
        'party': 'party hits dance 2025',
        'sad': 'sad emotional songs',
        'happy': 'feel good upbeat pop',
        'relax': 'relaxing chill lofi',
    }
    
    query = mood_queries.get(mood, 'chill music')
    return search_songs(query, limit)


def get_trending_tracks(country: str = 'US', limit: int = 20):
    """
    Get trending tracks using YTMusic Charts.
    """
    try:
        charts = _retry_yt_call(yt.get_charts, country=country)
        # charts['songs']['items'] usually has top 50
        songs = charts.get('songs', {}).get('items', [])
        
        tracks = []
        for item in songs[:limit]:
            formatted = _format_track(item)
            if formatted and formatted['id']:
                tracks.append(formatted)
                
        # Fallback if charts fail
        if not tracks:
            return search_songs('top hits 2025', limit)
            
        return tracks
    except Exception as e:
        logger.error(f"Trending tracks failed: {e}")
        return search_songs('top hits 2025', limit)


def get_new_releases(country: str = 'US', limit: int = 20):
    """
    Get new track releases.
    """
    try:
        return search_songs('new releases 2025', limit)
    except Exception:
        return []


def search_artist_tracks(artist_name: str, limit: int = 15):
    """
    Search for tracks by a specific artist.
    """
    return search_songs(f'{artist_name} songs', limit)


def fetch_spotify_playlist(playlist_id: str):
    """
    We cannot easily fetch a Spotify playlist anymore without credentials.
    We will mock an error telling the user this feature is disabled due to Spotify API limits.
    """
    raise ValueError("Spotify playlist import is currently disabled because it requires an active Spotify Premium account API key.")
