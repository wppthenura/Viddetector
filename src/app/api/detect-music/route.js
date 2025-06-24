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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  const linuxUserAgent =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";

  console.log('🔐 ENV CHECK:');
  console.log('ACR_KEY:', ACR_KEY);
  console.log('ACR_SECRET:', ACR_SECRET);
  console.log('ACR_HOST:', ACR_HOST);

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  if (!ACR_KEY || !ACR_SECRET || !ACR_HOST) {
    return NextResponse.json(
      { error: 'Missing ACRCloud environment variables.' },
      { status: 500 }
    );
  }

  const outputTemplate = `/tmp/audio-${videoId}.%(ext)s`;
  const finalPath = `/tmp/audio-${videoId}.mp3`;

  try {
    console.log(`📥 Running yt-dlp for videoId=${videoId}`);
    
    const command = `yt-dlp --downloader aria2c --user-agent "${linuxUserAgent}" -f "bestaudio[ext=m4a]/bestaudio/best" --no-playlist -x --audio-format mp3 --postprocessor-args "-t 15" -o "${outputTemplate}" "https://www.youtube.com/watch?v=${videoId}"`;

    await new Promise((resolve, reject) => {
      exec(command, (err, stdout, stderr) => {
        console.log("yt-dlp stdout:", stdout);
        console.error("yt-dlp stderr:", stderr);
        if (err) return reject(err);
        if (!existsSync(finalPath)) return reject(new Error("Audio file not created."));
        resolve();
      });
    });

    const fileData = await fs.readFile(finalPath);

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

    console.log('📡 Sending to ACRCloud with headers + length');

    const res = await fetch(`https://${ACR_HOST}/v1/identify`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'Content-Length': contentLength,
      },
    });

    const result = await res.json();
    console.log('🎵 ACRCloud response:', result);

    await fs.unlink(finalPath);

    return NextResponse.json(result); 
  } catch (err) {
    console.error("❌ Music detection failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
