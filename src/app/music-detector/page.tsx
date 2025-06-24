'use client';

import { useState } from 'react';

export default function MusicDetectorPage() {
  const [videoId, setVideoId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const detectMusic = async () => {
    if (!videoId) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/detect-music?videoId=${videoId}`);
      const data = await res.json();
      console.log('Detection result:', data); // Debugging
      setResult(data);
    } catch (err) {
      console.error('Detection failed:', err);
      setResult({ error: 'Failed to fetch music data.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-100 text-gray-900">
      <h1 className="text-3xl font-bold mb-6">🎧 YouTube Music Detector</h1>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Enter YouTube Video ID"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="px-4 py-2 border rounded w-96"
        />
        <button
          onClick={detectMusic}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {loading ? 'Detecting...' : 'Fetch Music'}
        </button>
      </div>

      {result?.error && (
        <div className="text-red-600 mt-4">Error: {result.error}</div>
      )}

      {Array.isArray(result?.metadata?.music) && result.metadata.music.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Detection Result</h2>
          <table className="table-auto w-full text-left border">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 border">Video ID</th>
                <th className="p-2 border">Song Title</th>
                <th className="p-2 border">Artist</th>
                <th className="p-2 border">Timestamp</th>
                <th className="p-2 border">Asset ID</th>
              </tr>
            </thead>
            <tbody>
              {result.metadata.music.map((music: any, index: number) => (
                <tr key={index}>
                  <td className="p-2 border">{videoId}</td>
                  <td className="p-2 border">{music.title || '—'}</td>
                  <td className="p-2 border">{music.artists?.[0]?.name || '—'}</td>
                  <td className="p-2 border">{result.metadata.timestamp || '—'}</td>
                  <td className="p-2 border">{music.acrid || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show raw response for debugging */}
      {result && (
        <pre className="mt-8 p-4 bg-gray-200 rounded text-sm overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
