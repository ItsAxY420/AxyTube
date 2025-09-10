// script.js
// Restored & fixed version — attempts native <video> playback from Google Drive first,
// and falls back to Drive preview iframe if native playback fails.

// ===== CONFIG =====
const API_KEY = "AIzaSyDNA7a_EgNLjO8DMGL6cy8RtUdASlQCGSk";
const FOLDERS = {
  s1: "1neuN7SSXoxv-ot3ELiGt2BpranjD_6dr", // Season 1
  s2: "1i7h3gme1Lm2_Jwj5iZ_e5audeg1s8MeR",
  s3: "1_9q3Ay6qADCNdSqBCDJ5cg0ZQ7FaTm4N",
  s4: "1Kck7onbfUX6l8xwwsK2eXe0D6YwaYJSf",
  s5: "11z6r_KKDqasqkuNDjF2_gavDqkuT1BOh",
  s6: "1MfL6TzzV8k7n6cEqYXh62vfge2pqYjjV",
};



const VIDEO_ONLY = true; // We will try native playback first for all files

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
const seasons = {}; // seasons.s1 = [file objects]
let currentSeason = null;
let currentIndex = 0;

// Helper to build Drive API URL for listing files in a folder
function driveListUrl(folderId) {
  const q = `'${folderId}' in parents and trashed=false`;
  return `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${API_KEY}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=500&orderBy=name`;
}

// Fetch files for each season and populate lists
async function init() {
  // ensure iframe exists (for fallback); if not, create one hidden
  if (!iframeEl) {
    iframeEl = document.createElement('iframe');
    iframeEl.id = 'drive-iframe';
    iframeEl.style.display = 'none';
    iframeEl.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    iframeEl.setAttribute('allowfullscreen', 'true');
    const wrap = document.getElementById('playerWrap') || document.body;
    wrap.insertBefore(iframeEl, wrap.firstChild.nextSibling || null);
  }

  // For each season folder, fetch files and populate the UI
  for (const seasonId of Object.keys(FOLDERS)) {
    try {
      const url = driveListUrl(FOLDERS[seasonId]);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Drive API failed: ' + res.status);
      const json = await res.json();
      // keep files array (if none, empty)
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

// Populate the UL for a season
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

// Play a file by season + index
function playSeasonIndex(seasonId, idx) {
  const list = seasons[seasonId] || [];
  if (!list || idx < 0 || idx >= list.length) return;
  currentSeason = seasonId;
  currentIndex = idx;
  const f = list[idx];
  playFile(f, seasonId, idx);
  // update highlights for that season only
  const ul = document.getElementById('videoList-' + seasonId.replace('s','s'));
  if (ul) {
    Array.from(ul.querySelectorAll('li')).forEach((li, i) => li.classList.toggle('current', i === idx));
  }
}

// Attempt native playback, fallback to iframe preview if error
function playFile(f, seasonId, idx) {
  if (!f) return;
  const directUrl = `https://drive.google.com/uc?export=download&id=${f.id}`;
  const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;
  // use native video first
  try {
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('poster');
      videoEl.src = directUrl;
      videoEl.style.display = 'block';
    }
    // hide iframe
    if (iframeEl) iframeEl.style.display = 'none';
    if (openBtn) openBtn.href = f.webViewLink || previewUrl;
    // set debug empty
    if (debugEl) { debugEl.style.display = 'none'; debugEl.innerText = ''; }
    // try to play (may be blocked by autoplay policies)
    videoEl.play().catch(()=>{});
  } catch (e) {
    // fallback immediately
    fallbackToIframe(f);
  }
}

// Fallback: show Drive iframe preview
function fallbackToIframe(f) {
  if (!f) return;
  const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;
  try {
    if (videoEl) { try { videoEl.pause(); } catch(e){} videoEl.removeAttribute('src'); videoEl.style.display = 'none'; }
    if (iframeEl) { iframeEl.src = previewUrl; iframeEl.style.width = '100%'; iframeEl.style.height = '480px'; iframeEl.style.display = 'block'; }
    if (openBtn) openBtn.href = f.webViewLink || previewUrl;
    if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = 'Native playback failed — using Drive preview.'; }
  } catch(e){ console.warn('fallback error', e); }
}

// Video element error handler: try iframe fallback
if (videoEl) {
  videoEl.addEventListener('error', () => { fallbackToIframe(seasons[currentSeason] && seasons[currentSeason][currentIndex]); });
}

// Prev/Next handlers (operate within current season)
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

// Pop out button: opens the Google Drive preview in a new window
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

// Initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  init().catch(e => console.warn('init error', e));
});
