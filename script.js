// script.js
// Attempt native <video> playback from Google Drive (alt=media for raw bytes) first,
// and fall back to Drive preview iframe if native playback fails.

// ===== CONFIG =====
const API_KEY = "AIzaSyDNA7a_EgNLjO8DMGL6cy8RtUdASlQCGSk";
const FOLDERS = {
  s1: "12QHYD56V3f7wGd04yChF1prfpwsb91Hc", // Season 1
  s2: "1cdeSnoOsSEXYAlOQfCGqN97VApK2PmJ6",
  s3: "1VzrJLiby1QznKp_vBcBECtCQvZYpHWyH",
  s4: "12tqVxlqgb3GN-FtxBSpnL8d-HuzJhXvE",
  s5: "11z6r_KKDqasqkuNDjF2_gavDqkuT1BOh",
  s6: "1MfL6TzzV8k7n6cEqYXh62vfge2pqYjjV",
};

const VIDEO_ONLY = true;

// ===== DOM =====
const videoEl = document.getElementById("video-player");
let iframeEl = document.getElementById("drive-iframe");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const openBtn = document.getElementById("openBtn");
const emptyEl = document.getElementById("empty");
const debugEl = document.getElementById("debug");
const popOutBtn = document.getElementById("popOutBtn");

// ===== State =====
const seasons = {};
let currentSeason = null;
let currentIndex = 0;

function driveListUrl(folderId) {
  const q = `'${folderId}' in parents and trashed=false`;
  // request mimeType so we can detect mp4/video files
  return `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${API_KEY}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=500&orderBy=name`;
}

async function init() {
  if (!iframeEl) {
    iframeEl = document.createElement('iframe');
    iframeEl.id = 'drive-iframe';
    iframeEl.style.display = 'none';
    iframeEl.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    iframeEl.setAttribute('allowfullscreen', 'true');
    const wrap = document.getElementById('playerWrap') || document.body;
    wrap.insertBefore(iframeEl, wrap.firstChild.nextSibling || null);
  }

  for (const seasonId of Object.keys(FOLDERS)) {
    try {
      const url = driveListUrl(FOLDERS[seasonId]);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Drive API failed: ' + res.status);
      const json = await res.json();
      const files = (json.files || []).slice().sort((a,b) => a.name.localeCompare(b.name));
      seasons[seasonId] = files;
      populateSeasonList(seasonId, files);
    } catch (e) {
      console.warn('Failed to load season', seasonId, e);
      seasons[seasonId] = [];
      populateSeasonList(seasonId, []);
    }
  }
}

function populateSeasonList(seasonId, files) {
  const ul = document.getElementById('videoList-' + seasonId.replace('s','s'));
  if (!ul) return;
  ul.innerHTML = '';
  if (!files || files.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No videos found for this season.';
    li.style.opacity = '0.7';
    ul.appendChild(li);
    return;
  }
  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.textContent = f.name || ('Track ' + (i+1));
    li.dataset.season = seasonId;
    li.dataset.index = i;
    li.onclick = () => playSeasonIndex(seasonId, i);
    ul.appendChild(li);
  });
}

function playSeasonIndex(seasonId, idx) {
  const list = seasons[seasonId] || [];
  if (!list || idx < 0 || idx >= list.length) return;
  currentSeason = seasonId;
  currentIndex = idx;
  const f = list[idx];
  playFile(f, seasonId, idx);
  const ul = document.getElementById('videoList-' + seasonId.replace('s','s'));
  if (ul) {
    Array.from(ul.querySelectorAll('li')).forEach((li, i) => li.classList.toggle('current', i === idx));
  }
}

function playFile(f, seasonId, idx) {
  if (!f) return;

  // alt=media endpoint (serves raw file bytes with correct headers) — preferred for direct playback
  const apiAltMedia = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`;
  // traditional uc download link (sometimes works but can return HTML for large files)
  const directUc = `https://drive.google.com/uc?export=download&id=${f.id}`;
  const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;

  const name = (f.name || '').toLowerCase();
  const mime = (f.mimeType || '').toLowerCase();

  // Decide whether to try native playback:
  // - If Drive reports a video mimeType (video/*) -> use alt=media
  // - Or if filename ends with .mp4 -> use alt=media and claim video/mp4
  let tryNative = false;
  let sourceUrl = directUc;
  let sourceType = mime || '';

  if (mime.startsWith('video/')) {
    tryNative = true;
    sourceUrl = apiAltMedia;
    sourceType = mime;
  } else if (name.endsWith('.mp4')) {
    tryNative = true;
    sourceUrl = apiAltMedia;
    sourceType = 'video/mp4';
  } else {
    // not a known video type; we will fallback to iframe (Drive preview)
    tryNative = false;
  }

  if (tryNative && videoEl) {
    // Prepare video element for new source
    try {
      videoEl.pause();
    } catch(e){}
    videoEl.removeAttribute('poster');

    // remove existing <source> children and set a single new one (clean)
    while (videoEl.firstChild) videoEl.removeChild(videoEl.firstChild);
    const sourceEl = document.createElement('source');
    sourceEl.src = sourceUrl;
    if (sourceType) sourceEl.type = sourceType;
    videoEl.appendChild(sourceEl);

    videoEl.style.display = 'block';
    if (iframeEl) iframeEl.style.display = 'none';
    if (openBtn) openBtn.href = f.webViewLink || previewUrl;
    if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = `Trying native playback (${sourceType || 'unknown type'}) — ${sourceUrl}`; }

    // load then play; if play() or loading fails, fallback to iframe
    videoEl.load();
    videoEl.play().catch(err => {
      console.warn('Native play() failed; falling back to iframe: ', err);
      fallbackToIframe(f);
    });
  } else {
    // Not a video type or native attempt not possible — use Drive preview iframe
    fallbackToIframe(f);
  }
}

function fallbackToIframe(f) {
  if (!f) return;
  const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;
  try {
    if (videoEl) { try { videoEl.pause(); } catch(e){} videoEl.removeAttribute('src'); videoEl.style.display = 'none'; while (videoEl.firstChild) videoEl.removeChild(videoEl.firstChild); }
    if (iframeEl) { iframeEl.src = previewUrl; iframeEl.style.width = '100%'; iframeEl.style.height = '480px'; iframeEl.style.display = 'block'; }
    if (openBtn) openBtn.href = f.webViewLink || previewUrl;
    if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = 'Native playback failed — using Drive preview.'; }
  } catch(e){ console.warn('fallback error', e); }
}

if (videoEl) {
  videoEl.addEventListener('error', () => { fallbackToIframe(seasons[currentSeason] && seasons[currentSeason][currentIndex]); });
}

function next() {
  if (!currentSeason) return;
  const arr = seasons[currentSeason] || [];
  if (currentIndex < arr.length - 1) playSeasonIndex(currentSeason, currentIndex + 1);
}
function prev() {
  if (!currentSeason) return;
  if (currentIndex > 0) playSeasonIndex(currentSeason, currentIndex - 1);
}
if (nextBtn) nextBtn.addEventListener('click', next);
if (prevBtn) prevBtn.addEventListener('click', prev);

if (popOutBtn) popOutBtn.addEventListener('click', () => {
  const arr = seasons[currentSeason] || [];
  const f = arr[currentIndex];
  if (!f) return alert('No file selected yet.');
  const url = `https://drive.google.com/file/d/${f.id}/preview`;
  const w = Math.round(window.screen.availWidth * 0.85);
  const h = Math.round(window.screen.availHeight * 0.85);
  const features = 'resizable=yes,scrollbars=yes,width=' + w + ',height=' + h;
  const popup = window.open(url, '_blank', features);
  if (popup) popup.focus();
});

document.addEventListener('DOMContentLoaded', () => {
  init().catch(e => console.warn('init error', e));
});
