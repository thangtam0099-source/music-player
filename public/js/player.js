/* ═══════════════════════════════════════════════
   MUSIC PLAYER — player.js
═══════════════════════════════════════════════ */

const audio       = document.getElementById('audioPlayer');
const playerBar   = document.getElementById('playerBar');
const playPauseBtn= document.getElementById('playPauseBtn');
const playIcon    = document.getElementById('playIcon');
const progressBar = document.getElementById('progressBar');
const volumeBar   = document.getElementById('volumeBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl   = document.getElementById('totalTime');
const playerTitle   = document.getElementById('playerTitle');
const playerArtist  = document.getElementById('playerArtist');
const playerCoverWrap = document.getElementById('playerCoverWrap');

let currentIdx = -1;
let isPlaying  = false;

// SVG icons
const ICON_PLAY  = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';

// ── Phát bài hát theo index ────────────────────
function playSong(idx) {
  if (idx < 0 || idx >= SONGS.length) return;

  const song = SONGS[idx];

  // Cập nhật card active
  document.querySelectorAll('.song-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector(`.song-card[data-idx="${idx}"]`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Load audio
  audio.src = song.src;
  audio.load();
  audio.play().catch(e => console.warn('Autoplay blocked:', e));
  isPlaying = true;
  currentIdx = idx;

  // Cập nhật UI player bar
  playerBar.classList.add('visible');
  playerTitle.textContent  = song.title;
  playerArtist.textContent = song.artist;
  updatePlayIcon();
  updateCover(song.image);

  // Tiêu đề tab
  document.title = `▶ ${song.title} — ${song.artist}`;
}

// ── Cập nhật ảnh bìa trong player ─────────────
function updateCover(imgSrc) {
  if (imgSrc) {
    playerCoverWrap.innerHTML = `<img class="player-cover" src="${imgSrc}" alt="cover">`;
  } else {
    playerCoverWrap.innerHTML = `<div class="player-cover-placeholder">🎵</div>`;
  }
}

// ── Play / Pause ───────────────────────────────
function togglePlay() {
  if (currentIdx === -1 && SONGS.length > 0) {
    playSong(0);
    return;
  }
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    document.title = document.title.replace('▶ ', '⏸ ');
  } else {
    audio.play();
    isPlaying = true;
    document.title = document.title.replace('⏸ ', '▶ ');
  }
  updatePlayIcon();
}

function updatePlayIcon() {
  // 1. Cập nhật TẤT CẢ các nút Play/Pause ở thanh Player dưới đáy (cả bản Desktop lẫn Mobile)
  const playerIcons = document.querySelectorAll('.ctrl-btn.play-pause svg');
  playerIcons.forEach(svg => {
    svg.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
  });

  // 2. Đưa toàn bộ icon trên danh sách bài hát về trạng thái Play (tam giác)
  const listIcons = document.querySelectorAll('.song-play-icon svg');
  listIcons.forEach(svg => {
    svg.innerHTML = ICON_PLAY;
  });

  // 3. Nếu đang phát nhạc, tìm bài hát đang "active" và đổi thành Pause (2 vạch)
  if (isPlaying) {
    const activeSongIcon = document.querySelector('.song-card.active .song-play-icon svg');
    if (activeSongIcon) {
      activeSongIcon.innerHTML = ICON_PAUSE;
    }
  }
}

// ── Bài trước / Bài sau ────────────────────────
function prevSong() {
  if (SONGS.length === 0) return;
  const idx = currentIdx <= 0 ? SONGS.length - 1 : currentIdx - 1;
  playSong(idx);
}

function nextSong() {
  if (SONGS.length === 0) return;
  const idx = (currentIdx + 1) % SONGS.length;
  playSong(idx);
}

// ── Seek ──────────────────────────────────────
function seekTo(val) {
  if (!audio.duration) return;
  audio.currentTime = (val / 100) * audio.duration;
}

// ── Volume ────────────────────────────────────
function setVolume(val) {
  audio.volume = val;
}

// ── Format thời gian (giây → m:ss) ───────────
function formatTime(sec) {
  if (isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Events ────────────────────────────────────

// Cập nhật progress bar liên tục
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  progressBar.value = pct;
  currentTimeEl.textContent = formatTime(audio.currentTime);
});

// Khi load xong metadata
audio.addEventListener('loadedmetadata', () => {
  totalTimeEl.textContent = formatTime(audio.duration);
  progressBar.value = 0;
});

// Tự động phát bài tiếp theo
audio.addEventListener('ended', () => {
  nextSong();
});

// Đồng bộ trạng thái play/pause từ audio element
audio.addEventListener('play',  () => { isPlaying = true;  updatePlayIcon(); });
audio.addEventListener('pause', () => { isPlaying = false; updatePlayIcon(); });

// ── Keyboard shortcuts ────────────────────────
document.addEventListener('keydown', (e) => {
  // Bỏ qua nếu đang focus vào input
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.code === 'ArrowRight') {
    nextSong();
  } else if (e.code === 'ArrowLeft') {
    prevSong();
  }
});
