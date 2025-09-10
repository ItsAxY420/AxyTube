// ===== CONFIG =====
const API_KEY = "AIzaSyDNA7a_EgNLjO8DMGL6cy8RtUdASlQCGSk";

// Google Drive folder IDs for each season bojack horseman
const FOLDERS = {
  s1: "1neuN7SSXoxv-ot3ELiGt2BpranjD_6dr", // Season 1
  s2: "1i7h3gme1Lm2_Jwj5iZ_e5audeg1s8MeR",
  s3: "1_9q3Ay6qADCNdSqBCDJ5cg0ZQ7FaTm4N",
  s4: "1Kck7onbfUX6l8xwwsK2eXe0D6YwaYJSf",
  s5: "11z6r_KKDqasqkuNDjF2_gavDqkuT1BOh",
  s6: "1MfL6TzzV8k7n6cEqYXh62vfge2pqYjjV",

};

const VIDEO_ONLY = true;

// ===== DOM =====
const videoEl = document.getElementById("video-player");
const iframeEl = document.getElementById("drive-iframe");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const openBtn = document.getElementById("openBtn");
const emptyEl = document.getElementById("empty");
const debugEl = document.getElementById("debug");

// State
let files = [];   // merged list of all seasons
let currentIndex = 0;

// ---- Utility: list files ----
async function listAllFilesInFolder(folderId) {
  let pageToken = null;
  const all = [];
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: "name_natural",
      fields: "files(id,name,mimeType,webViewLink,shortcutDetails),nextPageToken",
      pageSize: "1000",
      key: API_KEY,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive API error ${res.status} ${res.statusText}`);
    const json = await res.json();
    all.push(...(json.files || []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return all;
}

// ---- Load one season ----
async function loadSeason(folderId, listId) {
  const listEl = document.getElementById(listId);
  listEl.innerHTML = "";

  try {
    const raw = await listAllFilesInFolder(folderId);

    const normalized = raw.map(f => {
      if (f.mimeType === "application/vnd.google-apps.shortcut" && f.shortcutDetails?.targetId) {
        return {
          id: f.shortcutDetails.targetId,
          name: f.name,
          mimeType: f.shortcutDetails.targetMimeType || "",
          webViewLink: `https://drive.google.com/file/d/${f.shortcutDetails.targetId}/view`
        };
      }
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType || "",
        webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`
      };
    });

    let items = normalized.filter(it => !(it.mimeType || "").startsWith("application/vnd.google-apps"));
    if (VIDEO_ONLY) {
      items = items.filter(it => {
        if ((it.mimeType || "").startsWith("video/")) return true;
        const ext = (it.name || "").split(".").pop().toLowerCase();
        return ["mp4","webm","ogg","mov","mkv"].includes(ext);
      });
    }

    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "No episodes found.";
      listEl.appendChild(li);
      return;
    }

    // Add to global files
    const baseIndex = files.length;
    files.push(...items);

    // Render list for this season
    items.forEach((f, i) => {
      const li = document.createElement("li");
      li.textContent = `${i+1}. ${f.name}`;
      li.addEventListener("click", () => playIndex(baseIndex + i));
      listEl.appendChild(li);
    });

  } catch (err) {
    console.error(err);
    const li = document.createElement("li");
    li.textContent = "Error loading season: " + err.message;
    listEl.appendChild(li);
  }
}

// ---- Play by index ----
function playIndex(idx) {
  currentIndex = idx;
  const f = files[idx];

  // Clear highlights
  document.querySelectorAll("ul.list li").forEach(li => li.classList.remove("current"));
  // Highlight current
  const allLis = Array.from(document.querySelectorAll("ul.list li"));
  if (allLis[idx]) allLis[idx].classList.add("current");

  const directUrl = `https://drive.google.com/uc?export=download&id=${f.id}`;
  const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;

  if ((f.mimeType || "").startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(f.name)) {
    iframeEl.style.display = "center";
    videoEl.style.display = "center";
    videoEl.src = directUrl;
    openBtn.href = f.webViewLink || previewUrl;
    videoEl.play().catch(()=>{});
  } else {
    videoEl.style.display = "center";
    videoEl.removeAttribute("src");
    iframeEl.style.display = "center";
    iframeEl.src = previewUrl;
    openBtn.href = f.webViewLink || previewUrl;
  }
}

// Video error fallback
videoEl.addEventListener("error", () => {
  const f = files[currentIndex];
  if (!f) return;
  videoEl.style.display = "center";
  iframeEl.style.display = "center";
  iframeEl.src = `https://drive.google.com/file/d/${f.id}/preview`;
  openBtn.href = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
  debugEl.style.display = "center";
  debugEl.innerText = "Native <video> playback failed; using Drive preview fallback.";
});

// Prev/Next
prevBtn.addEventListener("click", () => {
  if (!files.length) return;
  currentIndex = (currentIndex - 1 + files.length) % files.length;
  playIndex(currentIndex);
});
nextBtn.addEventListener("click", () => {
  if (!files.length) return;
  currentIndex = (currentIndex + 1) % files.length;
  playIndex(currentIndex);
});

// ---- Load all seasons ----
loadSeason(FOLDERS.s1, "videoList-s1");
loadSeason(FOLDERS.s2, "videoList-s2");
loadSeason(FOLDERS.s3, "videoList-s3");
loadSeason(FOLDERS.s4, "videoList-s4");
loadSeason(FOLDERS.s5, "videoList-s5");
loadSeason(FOLDERS.s6, "videoList-s6");
