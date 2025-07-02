// src/app/api/detect-music/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';

const ACR_KEY = process.env.ACR_KEY;
const ACR_SECRET = process.env.ACR_SECRET;
const ACR_HOST = process.env.ACR_HOST;

function buildSignature(stringToSign, secret) {
  return crypto
    .createHmac('sha1', secret)
    .update(Buffer.from(stringToSign, 'utf-8'))
    .digest('base64');
}

const execPromise = (cmd, options = {}) =>
  new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 20, ...options }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Command failed: ${cmd}`, stderr);
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  const outputTemplate = `/tmp/audio-${videoId}.%(ext)s`;
  const finalPath = `/tmp/audio-${videoId}.mp3`;

  try {
    // Step 1: Get metadata for channelId
    const metaCmd = `yt-dlp -j --no-warnings "https://www.youtube.com/watch?v=${videoId}"`;
    const { stdout: metaStdout } = await execPromise(metaCmd);
    let metaJson;
    try {
      metaJson = JSON.parse(metaStdout);
    } catch {
      throw new Error("Failed to parse metadata JSON.");
    }
    const channelId = metaJson.channel_id || 'Unknown';

    // Step 2: Download and extract audio (limit 15 sec)
    const dlCmd = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio/best" --no-playlist -x --audio-format mp3 --postprocessor-args "-t 15" -o "${outputTemplate}" "https://www.youtube.com/watch?v=${videoId}"`;
    const { stdout: dlOut, stderr: dlErr } = await execPromise(dlCmd);
    console.log("yt-dlp stdout:", dlOut);
    console.error("yt-dlp stderr:", dlErr);

    // Step 3: Verify audio file exists
    if (!existsSync(finalPath)) {
      throw new Error("Audio file not created after yt-dlp.");
    }

    // Step 4: Read audio file buffer
    const fileData = await fs.readFile(finalPath);

    // Step 5: Build ACRCloud signature and form data
    const http_method = 'POST';
    const http_uri = '/v1/identify';
    const data_type = 'audio';
    const signature_version = '1';
    const timestamp = Math.floor(Date.now() / 1000);

    const stringToSign = [
      http_method,
      http_uri,
      ACR_KEY,
      data_type,
      signature_version,
      timestamp,
    ].join('\n');

    const signature = buildSignature(stringToSign, ACR_SECRET);

    const form = new FormData();
    form.append('sample', fileData, {
      filename: 'sample.mp3',
      knownLength: fileData.length,
    });
    form.append('access_key', ACR_KEY);
    form.append('data_type', data_type);
    form.append('signature_version', signature_version);
    form.append('signature', signature);
    form.append('timestamp', timestamp);

    const getLength = promisify(form.getLength).bind(form);
    const contentLength = await getLength();

    // Step 6: Send POST request to ACRCloud
    const acrRes = await fetch(`https://${ACR_HOST}/v1/identify`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'Content-Length': contentLength,
      },
    });

    if (!acrRes.ok) {
      throw new Error(`ACRCloud responded with status ${acrRes.status}`);
    }

    const result = await acrRes.json();

    // Step 7: Check for music detection results
    const music = result?.metadata?.music?.[0];
    if (!music) {
      return NextResponse.json({ error: 'No music detected' }, { status: 404 });
    }

    // Return success data
    return NextResponse.json({
      videoId,
      channelId,
      youtubeLink: `https://www.youtube.com/watch?v=${videoId}`,
      songTitle: music.title || 'Unknown',
      songOwner: music.artists?.[0]?.name || 'Unknown',
    });

  } catch (err) {
    console.error("❌ Music detection failed:", err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  } finally {
    // Clean up temporary audio file
    try {
      if (existsSync(finalPath)) {
        await fs.unlink(finalPath);
      }
    } catch (cleanupErr) {
      console.error('Failed to delete temp audio file:', cleanupErr);
    }
  }
}
