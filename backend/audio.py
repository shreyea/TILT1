# backend/audio.py
# YouTube audio extraction via yt-dlp — no downloads, just streamable URLs
import yt_dlp
import logging

logger = logging.getLogger(__name__)


def get_audio_url(song_title: str, artist: str) -> dict:
    """
    Search YouTube for the song and return a direct streamable audio URL.
    
    IMPORTANT: Audio URLs expire in ~6 hours.
    Always fetch fresh on each play, never cache the URL itself.
    """
    query = f'{song_title} {artist} official audio'
    
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'noplaylist': True,
        'extract_flat': False,
        'no_warnings': True,
        'socket_timeout': 15,
        'retries': 3,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f'ytsearch1:{query}',
                download=False
            )
            
            if not info or 'entries' not in info or not info['entries']:
                raise ValueError(f'No results found for: {query}')
            
            entry = info['entries'][0]
            
            return {
                'url': entry['url'],
                'title': entry.get('title', song_title),
                'duration': entry.get('duration', 0),
                'youtube_id': entry.get('id', ''),
                'thumbnail': entry.get('thumbnail', ''),
            }
    except Exception as e:
        logger.error(f'Audio extraction failed for "{song_title}" by {artist}: {e}')
        raise


def get_audio_url_by_id(youtube_id: str) -> dict:
    """Extract audio URL from a known YouTube video ID."""
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 15,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f'https://www.youtube.com/watch?v={youtube_id}',
                download=False
            )
            return {
                'url': info['url'],
                'title': info.get('title', ''),
                'duration': info.get('duration', 0),
            }
    except Exception as e:
        logger.error(f'Audio extraction failed for YouTube ID {youtube_id}: {e}')
        raise
