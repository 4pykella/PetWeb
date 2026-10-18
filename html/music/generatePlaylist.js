// Генерирует playlist.json из аудиофайлов в этой папке.
// На сервере nginx отдаёт список /music/ сам (autoindex json), а playlist.json —
// запасной вариант для локального просмотра и хостингов без autoindex.
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const AUDIO = /\.(mp3|ogg|oga|opus|m4a|aac|flac|wav|webm)$/i;

const tracks = fs.readdirSync(DIR, { withFileTypes: true })
  .filter(f => f.isFile() && AUDIO.test(f.name))
  .map(f => f.name)
  .sort((a, b) => a.localeCompare(b, "ru"));

fs.writeFileSync(path.join(DIR, "playlist.json"), JSON.stringify(tracks, null, 2) + "\n");
console.log(`✅ playlist.json: ${tracks.length} треков`);
