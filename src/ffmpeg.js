// Make the ffmpeg-static binary available to play-dl and other audio tools.
const path = require('node:path');
const ffmpegPath = require('ffmpeg-static');

if (!ffmpegPath) {
  console.error('[FFmpeg] ffmpeg-static konnte keine passende Binärdatei laden.');
} else {
  const binDir = path.dirname(ffmpegPath);
  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
  process.env.FFMPEG_PATH = ffmpegPath;
  console.log('[FFmpeg] Installiert und PATH gesetzt.');
}
