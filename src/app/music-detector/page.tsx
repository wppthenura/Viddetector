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
        <div className="text-red-600 mt-4">❌ {result.error}</div>
      )}

      {!result?.error && result?.songTitle && (
        <div className="mt-8 bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">✅ Detection Result</h2>
          <table className="table-auto w-full text-left border">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 border">Video ID</th>
                <th className="p-2 border">Channel ID</th>
                <th className="p-2 border">Open YouTube</th>
                <th className="p-2 border">Song Title</th>
                <th className="p-2 border">Song Owner</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border">{result.videoId}</td>
                <td className="p-2 border">{result.channelId}</td>
                <td className="p-2 border">
                  <a
                    href={result.youtubeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Open
                  </a>
                </td>
                <td className="p-2 border">{result.songTitle}</td>
                <td className="p-2 border">{result.songOwner}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <pre className="mt-8 p-4 bg-gray-200 rounded text-sm overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
