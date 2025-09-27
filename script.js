// script.js
// Pure native <video> playback from Google Drive (alt=media). NO IFRAME on page.

// ===== CONFIG =====
const API_KEY = "AIzaSyDNA7a_EgNLjO8DMGL6cy8RtUdASlQCGSk";

// BoJack static mapping (your existing IDs)
const FOLDERS = {
  // BoJack
  s1: "12QHYD56V3f7wGd04yChF1prfpwsb91Hc",
  s2: "1cdeSnoOsSEXYAlOQfCGqN97VApK2PmJ6",
  s3: "1VzrJLiby1QznKp_vBcBECtCQvZYpHWyH",
  s4: "12tqVxlqgb3GN-FtxBSpnL8d-HuzJhXvE",
  s5: "1mK_NLmrm9e-V0G6gsPTUtOblATIspKmE",
  s6: "1VCuvMHsakR7UYK-ND1l4ekOrx37ubfQD",

  // Regular Show (your IDs)
  r1: "1IfcOaJzitg8XvUbx6SVz3-VOmXvR9wzw",
  r2: "11kKVirM0bk8SmNvCJKCv-cuaUNb-pXD6",
  r3: "1-LIAV0dO3Gj-3a7-TFjztZQtklMHCcSq",
  r4: "1SMia0vvwyGb0SVURwrD81RLtGNOO6dVY",
  r5: "1wU9p7vr9HqmgPDYIQNOlmmWD23S-n9FQ",
  r6: "1wzb5ZtcXUN0VszD3MZSKObjoQQGNbnpg",
  r7: "1Pi8oGZfTt2VtmBiUbn00OCOlUS8cFkdR",
  r8: "1sM-m97cBux-Z-D37FxDmiqczsnEQLDBS",
  r9: "1qFY1rzRZTCsrRlqaJyurdkWH0fSriMFd"
};

const VIDEO_ONLY = true;

// ===== DOM =====
const videoEl = document.getElementById("video-player");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const openBtn = document.getElementById("openBtn");
const emptyEl = document.getElementById("empty");
const debugEl = document.getElementById("debug");
const popOutBtn = document.getElementById("popOutBtn");
const autoplayChk = document.getElementById("autoplayChk");

// ===== State =====
const seasons = {};
let currentSeason = null;
let currentIndex = 0;

// ===== Helpers =====
function driveListUrl(folderId) {
  const q = `'${folderId}' in parents AND trashed=false`;
  return `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${API_KEY}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=500&orderBy=name`;
}

function updateStatusForEpisode(seasonId, fileName) {
  // Determine which show section is visible
  const isBojack = seasonId.startsWith('s');
  const showSection = document.getElementById(isBojack ? 'bojack-season' : 'regular-season');
  const status = showSection.querySelector('.status-bar');
  if (!status) return;

  // Season label: from the button with matching data-target
  const btn = showSection.querySelector(`.season-toggle[data-target="${seasonId}"]`);
  const seasonLabel = btn ? (btn.getAttribute('data-season-label') || '—') : '—';
  const showName = btn ? (btn.getAttribute('data-show') || '—') : (isBojack ? 'Bojack Horseman' : 'Regular Show');

  status.querySelector('[data-role="show"]').textContent = showName;
  status.querySelector('[data-role="season"]').textContent = seasonLabel;
  status.querySelector('[data-role="episode"]').textContent = fileName || '—';
}

// ===== Init =====
async function init() {
  for (const seasonId of Object.keys(FOLDERS)) {
    const folderId = FOLDERS[seasonId];
    if (!folderId) {
      seasons[seasonId] = [];
      populateSeasonList(seasonId, []);
      continue;
    }
    try {
      const res = await fetch(driveListUrl(folderId));
      if (!res.ok) throw new Error('Drive API failed: ' + res.status);
      const json = await res.json();
      let files = (json.files || []);

      if (VIDEO_ONLY) {
        files = files.filter(f => {
          const mime = (f.mimeType || '').toLowerCase();
          const name = (f.name || '').toLowerCase();
          return mime.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.webm');
        });
      }

      files.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
    li.textContent = f.name || ('Track ' + (i + 1));
    li.title = f.name || ('Track ' + (i + 1)); // tooltip for full name
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
  playFile(f);

  // highlight current item
  const ul = document.getElementById('videoList-' + seasonId.replace('s','s'));
  if (ul) {
    Array.from(ul.querySelectorAll('li')).forEach((li, i) => li.classList.toggle('current', i === idx));
  }

  // update status with episode name
  updateStatusForEpisode(seasonId, f.name || '');
}

function playFile(f) {
  if (!f) return;

  // Prefer Google Drive alt=media for native playback
  const apiAltMedia = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${API_KEY}`;
  const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;

  const name = (f.name || '').toLowerCase();
  const mime = (f.mimeType || '').toLowerCase();

  let canNative = false;
  let sourceUrl = apiAltMedia;
  let sourceType = mime || '';

  if (mime.startsWith('video/')) {
    canNative = true;
  } else if (name.endsWith('.mp4')) {
    canNative = true;
    sourceType = 'video/mp4';
  }

  if (!canNative) {
    if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = 'This file type may not play natively. Use "Open in Google Drive" or "Pop out".'; }
    if (openBtn) openBtn.href = previewUrl;
    return;
  }

  try { videoEl.pause(); } catch(e){}
  while (videoEl.firstChild) videoEl.removeChild(videoEl.firstChild);

  const sourceEl = document.createElement('source');
  sourceEl.src = sourceUrl;
  if (sourceType) sourceEl.type = sourceType;
  videoEl.appendChild(sourceEl);

  videoEl.style.display = 'block';
  if (openBtn) openBtn.href = previewUrl;
  if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = `Playing natively (${sourceType || 'unknown'})`; }

  videoEl.load();
  videoEl.play().catch(() => {
    if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = 'Native play failed. Use "Open in Google Drive" or "Pop out".'; }
  });
}

if (videoEl) {
  videoEl.addEventListener('error', () => {
    if (debugEl) { debugEl.style.display = 'block'; debugEl.innerText = 'Playback error. Try "Open in Google Drive" / "Pop out".'; }
  });
  videoEl.addEventListener('ended', () => {
    if (autoplayChk && autoplayChk.checked) next();
  });
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
  const features = `resizable=yes,scrollbars=yes,width=${w},height=${h}`;
  const popup = window.open(url, '_blank', features);
  if (popup) popup.focus();
});

document.addEventListener('DOMContentLoaded', () => {
  init().catch(e => console.warn('init error', e));
});
