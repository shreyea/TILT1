# backend/playlist.py
# SQLite-based playlist and likes manager — no external database needed
import sqlite3
from datetime import datetime
import os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playlists.db')


def get_connection():
    """Get a database connection with row factory."""
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db():
    """Initialize the database tables."""
    con = get_connection()
    con.execute('''CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        cover_url TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    con.execute('''CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT DEFAULT '',
        art_url TEXT DEFAULT '',
        art_url_small TEXT DEFAULT '',
        spotify_id TEXT,
        duration_ms INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )''')
    con.execute('''CREATE TABLE IF NOT EXISTS liked_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spotify_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT DEFAULT '',
        art_url TEXT DEFAULT '',
        art_url_small TEXT DEFAULT '',
        duration_ms INTEGER DEFAULT 0,
        liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    con.commit()
    con.close()


# ─── Playlists ──────────────────────────────────────────────

def get_playlists():
    """Get all playlists with track counts."""
    con = get_connection()
    rows = con.execute('''
        SELECT p.*, COUNT(t.id) as track_count 
        FROM playlists p LEFT JOIN tracks t ON p.id = t.playlist_id 
        GROUP BY p.id ORDER BY p.updated_at DESC
    ''').fetchall()
    con.close()
    return [dict(r) for r in rows]


def get_playlist_tracks(playlist_id: int):
    """Get all tracks in a playlist."""
    con = get_connection()
    rows = con.execute(
        'SELECT * FROM tracks WHERE playlist_id=? ORDER BY position, added_at',
        (playlist_id,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def create_playlist(name: str, description: str = ''):
    """Create a new playlist."""
    con = get_connection()
    try:
        cur = con.execute(
            'INSERT INTO playlists (name, description) VALUES (?, ?)',
            (name, description)
        )
        con.commit()
        playlist_id = cur.lastrowid
        con.close()
        return {'id': playlist_id, 'name': name, 'description': description}
    except sqlite3.IntegrityError:
        con.close()
        raise ValueError(f'Playlist "{name}" already exists')


def add_to_playlist(playlist_id: int, track: dict):
    """Add a track to a playlist."""
    con = get_connection()
    # Get next position
    pos = con.execute(
        'SELECT COALESCE(MAX(position), 0) + 1 FROM tracks WHERE playlist_id=?',
        (playlist_id,)
    ).fetchone()[0]

    con.execute('''INSERT INTO tracks 
        (playlist_id, title, artist, album, art_url, art_url_small, spotify_id, duration_ms, position) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (playlist_id, track.get('title', ''), track.get('artist', ''),
         track.get('album', ''), track.get('art_url', ''),
         track.get('art_url_small', ''), track.get('id', ''),
         track.get('duration_ms', 0), pos))
    
    # Update playlist timestamp & cover
    if track.get('art_url'):
        con.execute('UPDATE playlists SET updated_at=?, cover_url=? WHERE id=?',
                     (datetime.now(), track['art_url'], playlist_id))
    else:
        con.execute('UPDATE playlists SET updated_at=? WHERE id=?',
                     (datetime.now(), playlist_id))
    con.commit()
    con.close()


def remove_from_playlist(track_db_id: int):
    """Remove a track from a playlist by its database ID."""
    con = get_connection()
    con.execute('DELETE FROM tracks WHERE id=?', (track_db_id,))
    con.commit()
    con.close()


def delete_playlist(playlist_id: int):
    """Delete a playlist and all its tracks."""
    con = get_connection()
    con.execute('DELETE FROM tracks WHERE playlist_id=?', (playlist_id,))
    con.execute('DELETE FROM playlists WHERE id=?', (playlist_id,))
    con.commit()
    con.close()

def reorder_playlist_tracks(playlist_id: int, track_ids: list):
    """Reorder tracks in a playlist. track_ids is a list of track DB IDs in the new order."""
    con = get_connection()
    try:
        # Update each track's position based on its index in the array
        for index, track_id in enumerate(track_ids):
            con.execute('UPDATE tracks SET position = ? WHERE id = ? AND playlist_id = ?', 
                       (index, track_id, playlist_id))
        con.execute('UPDATE playlists SET updated_at=? WHERE id=?',
                    (datetime.now(), playlist_id))
        con.commit()
    finally:
        con.close()


# ─── Liked Songs ────────────────────────────────────────────

def get_liked_songs():
    """Get all liked songs, most recent first."""
    con = get_connection()
    rows = con.execute('SELECT * FROM liked_songs ORDER BY liked_at DESC').fetchall()
    con.close()
    return [dict(r) for r in rows]


def is_liked(spotify_id: str) -> bool:
    """Check if a track is liked."""
    con = get_connection()
    row = con.execute('SELECT 1 FROM liked_songs WHERE spotify_id=?', (spotify_id,)).fetchone()
    con.close()
    return row is not None


def toggle_like(track: dict) -> bool:
    """Toggle like status. Returns True if now liked, False if unliked."""
    con = get_connection()
    existing = con.execute(
        'SELECT id FROM liked_songs WHERE spotify_id=?',
        (track.get('id', ''),)
    ).fetchone()
    
    if existing:
        con.execute('DELETE FROM liked_songs WHERE spotify_id=?', (track.get('id', ''),))
        con.commit()
        con.close()
        return False
    else:
        con.execute('''INSERT INTO liked_songs 
            (spotify_id, title, artist, album, art_url, art_url_small, duration_ms) 
            VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (track.get('id', ''), track.get('title', ''), track.get('artist', ''),
             track.get('album', ''), track.get('art_url', ''),
             track.get('art_url_small', ''), track.get('duration_ms', 0)))
        con.commit()
        con.close()
        return True

