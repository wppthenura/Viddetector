'use client';

import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [prevTop50, setPrevTop50] = useState<string[]>([]);
  const videoRefs = useRef({});

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youtube');
      const data = await res.json();
      setVideos(data);
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    const interval = setInterval(fetchVideos, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (videos.length === 0) return;

    const videosWithVPH = videos.map((v) => ({
      ...v,
      vph: calculateVPH(v.views, v.publishedAt),
    }));
    const sortedByVPH = [...videosWithVPH].sort((a, b) => b.vph - a.vph).slice(0, 50);
    const currentTop50Ids = sortedByVPH.map((v) => v.videoId);

    setPrevTop50((prev) => {
      if (prev.length === 0) {
        return currentTop50Ids;
      }
      return prev;
    });
  }, [videos]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const calculateVPH = (views: number, publishedAt: string) => {
    const publishedDate = new Date(publishedAt);
    const now = new Date();
    const hours = Math.max((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60), 1);
    return views / hours;
  };

  const videosWithVPH = videos.map((v) => ({
    ...v,
    vph: calculateVPH(v.views, v.publishedAt),
  }));

  const sortedVideos = [...videosWithVPH].sort((a, b) => b.vph - a.vph);

  const top50Videos = sortedVideos.slice(0, 50);

  const newVideoIds = top50Videos
    .filter((v) => prevTop50.length > 0 && !prevTop50.includes(v.videoId))
    .map((v) => v.videoId);

  useEffect(() => {
    if (top50Videos.length > 0) {
      setPrevTop50(top50Videos.map((v) => v.videoId));
    }
  }, [videos]);

  const topVPHVideos = top50Videos.slice(0, 5);

  const recent5Videos = [...top50Videos]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);

  const maxVPH = Math.max(...videosWithVPH.map((v) => v.vph));

  const scrollToVideo = (videoId: string) => {
    const el = videoRefs.current[videoId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-highlight');
      setTimeout(() => el.classList.remove('ring-highlight'), 2000);
    }
  };

  return (
    <main
      className={`w-screen h-screen overflow-hidden font-sans ${
        darkMode
          ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
          : 'bg-gradient-to-br from-white to-gray-100 text-gray-900'
      }`}
    >
      <div className="flex justify-between items-center p-6 shadow-md backdrop-blur-xl">
        <h1 className="text-4xl font-bold drop-shadow-lg">YouTube VPH Monitor</h1>
        <div className="flex gap-4 items-center">
          <div className="flex gap-4 items-center">
  <a
    href="/music-detector"
    className="px-5 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md"
  >
    Music Detector
  </a>
  <button
    onClick={fetchVideos}
    className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md"
  >
    Refresh
  </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-4 py-2 rounded-xl bg-gray-800 text-white hover:bg-gray-700 shadow-md"
          >
            {darkMode ? '☀ Light Mode' : '🌙 Dark Mode'}
          </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-5rem)]">
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {videosWithVPH.map((video, index) => {
            const percent = Math.round((video.vph / maxVPH) * 100);
            const isNew = newVideoIds.includes(video.videoId);

            return (
              <div
                key={video.videoId}
                ref={(el) => (videoRefs.current[video.videoId] = el)}
                className={`relative p-4 rounded-2xl shadow-2xl hover:shadow-3xl transition transform hover:-translate-y-0.5 cursor-default ${
                  darkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                {isNew && (
                  <span
                    className="absolute top-3 right-3 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold select-none"
                    style={{ zIndex: 10 }}
                  >
                    New
                  </span>
                )}

                <h2 className="font-semibold text-lg mb-2">
                  {index + 1}. {video.title}
                </h2>
                <p className="text-sm text-gray-500">Views: {video.views.toLocaleString()}</p>
                <p className="text-sm text-green-400 font-medium mt-1">
                  VPH: {Math.floor(video.vph).toLocaleString()}
                </p>
                <div className="mt-2">
                  <div className={`w-full h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full`}>
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{percent}% Value score</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <p className="text-sm text-blue-400 select-text cursor-pointer">VID ID: {video.videoId}</p>
                  <button
                    onClick={() => copyToClipboard(video.videoId)}
                    className="text-xs px-3 py-1 bg-blue-700 text-white rounded-xl hover:bg-blue-800"
                  >
                    📋 Copy
                  </button>
                  {copiedId === video.videoId && (
                    <span className="text-green-400 text-xs">Copied!</span>
                  )}
                </div>
                <div className="mt-2 flex justify-start">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white bg-red-600 py-2 px-4 rounded-xl hover:bg-red-700 shadow-md"
                  >
                    ▶ Watch on YouTube
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <aside
          className={`w-96 p-6 border-l overflow-y-auto shadow-inner rounded-l-3xl ${
            darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100'
          }`}
        >
          <h2 className="text-2xl font-bold mb-4">Top 5 VPHs</h2>
          <ul className="space-y-4 mb-8">
            {topVPHVideos.map((video, index) => (
              <li key={video.videoId}>
                <p className="font-medium mb-1">{index + 1}. {video.title}</p>
                <p className="text-xs text-gray-500 mb-1">
                  VPH: {Math.floor(video.vph).toLocaleString()}
                </p>
                <button
                  onClick={() => scrollToVideo(video.videoId)}
                  className="text-sm w-full py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow"
                >
                  Go to Video
                </button>
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold mb-4">5 Most Recent Videos</h2>
          <ul className="space-y-4">
            {recent5Videos.map((video, index) => (
              <li key={video.videoId}>
                <p className="font-medium mb-1">{index + 1}. {video.title}</p>
                <p className="text-xs text-gray-500 mb-1">
                 Published: {new Date(video.publishedAt).toLocaleDateString()} {' '}
                 {new Date(video.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </p>
                <button
                  onClick={() => scrollToVideo(video.videoId)}
                  className="text-sm w-full py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow"
                >
                  Go to Video
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <style>{`
        .ring-highlight {
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          transition: box-shadow 0.3s ease;
        }
        button, select {
          cursor: pointer;
        }
      `}</style>
    </main>
  );
}
