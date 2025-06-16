import axios from 'axios';

export async function GET() {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos";

  try {
    const res = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: "snippet,statistics",
        chart: "mostPopular",
        regionCode: "US",
        maxResults: 100,
        key: API_KEY
      }
    });

    const videos = res.data.items.map((video) => ({
    videoId: video.id,
    title: video.snippet.title,
    views: Number(video.statistics.viewCount), 
    publishedAt: video.snippet.publishedAt, 
    }));

    return new Response(JSON.stringify(videos), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error("❌ Failed to fetch videos", err.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500
    });
  }
}
