// src/app/api/detect-music/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';

const ACR_KEY = process.env.ACR_KEY;
const ACR_SECRET = process.env.ACR_SECRET;
const ACR_HOST = process.env.ACR_HOST;

function buildSignature(str, secret) {
  return crypto.createHmac('sha1', secret).update(str).digest('base64');
}
const execFileAsync = promisify(execFile);

export async function GET(req) {
  const videoId = new URL(req.url).searchParams.get('videoId');
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });

  const outputPath = `/tmp/audio-${videoId}.mp3`;
  let channelId = 'Unknown';

  try {
    // 1. fetch metadata
    const { stdout: metaJson } = await execFileAsync('/snap/bin/yt-dlp', [
      '-j', `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    const meta = JSON.parse(metaJson);
    channelId = meta.channel_id || channelId;

    // 2. extract first 15s audio
    await execFileAsync('/snap/bin/yt-dlp', [
      '-f', 'bestaudio',
      '-x', '--audio-format', 'mp3',
      '--postprocessor-args', '-t 15',
      '-o', outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    if (!existsSync(outputPath)) throw new Error('Audio extraction failed');

    // 3. prepare file and ACRCloud signature
    const fileBuf = await fs.readFile(outputPath);
    const timestamp = Math.floor(Date.now()/1000);
    const sigStr = `POST\n/v1/identify\n${ACR_KEY}\naudio\n1\n${timestamp}`;
    const signature = buildSignature(sigStr, ACR_SECRET);

    // 4. form payload
    const form = new FormData();
    form.append('sample', fileBuf, { filename: 'clip.mp3' });
    form.append('sample_bytes', fileBuf.length.toString());
    form.append('access_key', ACR_KEY);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('timestamp', timestamp.toString());

    const headers = { ...form.getHeaders(), 'Content-Length': (await promisify(form.getLength).call(form)).toString() };
    const acrRes = await fetch(`https://${ACR_HOST}/v1/identify`, {
      method: 'POST',
      headers,
      body: form,
    });
    const resJson = await acrRes.json();
    if (!acrRes.ok) throw new Error(`ACRCloud err: ${acrRes.status}`);

    const music = resJson.metadata?.music?.[0];
    if (!music) return NextResponse.json({ error: 'No music detected' }, { status: 404 });

    return NextResponse.json({
      videoId,
      channelId,
      songTitle: music.title,
      artists: music.artists?.map(a=>a.name).join(', '),
      acrid: music.acrid,
      timestamp: resJson.metadata?.timestamp,
    });
  } catch (err) {
    console.error('❌ detect-music failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    try { if (existsSync(outputPath)) await fs.unlink(outputPath); }
    catch(e) { console.error('cleanup err:', e); }
  }
}
