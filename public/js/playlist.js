/* ═══════════════════════════════════════════════
   PLAYLIST.JS
   - Popup chọn playlist khi bấm nút ♥ trên song card
   - Drag-and-drop sắp xếp thứ tự bài trong playlist
═══════════════════════════════════════════════ */

/* ── POPUP CHỌN PLAYLIST ───────────────────────
   Dùng ở trang home.ejs: nút ＋ trên mỗi song card
   Gọi fetch /playlists/api/my → render danh sách
──────────────────────────────────────────────── */

let activePopup   = null;
let activeSongId  = null;
let activeSongTitle = null;

// Mở/đóng popup khi bấm nút ＋ trên card
function togglePlaylistPopup(btn, songId, songTitle) {
  // Nếu đang mở popup khác → đóng trước
  if (activePopup && activePopup !== btn._popup) {
    activePopup.classList.remove('open');
  }

  activeSongId    = songId;
  activeSongTitle = songTitle;

  // Tạo popup lần đầu (lazy)
  if (!btn._popup) {
    const popup = document.createElement('div');
    popup.className = 'pl-popup';
    document.body.appendChild(popup);
    btn._popup = popup;
  }

  const popup = btn._popup;

  if (popup.classList.contains('open')) {
    popup.classList.remove('open');
    activePopup = null;
    return;
  }

  // Fetch danh sách playlist của user
  popup.innerHTML = '<div class="pl-popup-header">Thêm vào playlist</div><div style="padding:16px;color:var(--gray);font-size:0.85rem">Đang tải...</div>';
  popup.classList.add('open');
  activePopup = popup;

  // Định vị popup gần nút
  positionPopup(popup, btn);

  fetch('/playlists/api/my')
    .then(r => r.json())
    .then(data => {
      renderPopup(popup, data.playlists || [], songId, songTitle);
    })
    .catch(() => {
      popup.innerHTML = '<div class="pl-popup-empty">Lỗi kết nối</div>';
    });
}

// Render nội dung popup
function renderPopup(popup, playlists, songId, songTitle) {
  let html = '<div class="pl-popup-header">Thêm vào playlist</div>';

  if (playlists.length === 0) {
    html += '<div class="pl-popup-empty">Bạn chưa có playlist nào</div>';
  } else {
    playlists.forEach(pl => {
      html += `
        <div class="pl-popup-item" onclick="addSongToPlaylist(${pl.id}, '${escapeSingle(pl.name)}', ${songId}, '${escapeSingle(songTitle)}', this)">
          <span class="pl-icon">🎵</span>
          <div class="pl-details">
            <div class="pl-pname">${escapeHtml(pl.name)}</div>
            <div class="pl-pcount">${pl.count} bài</div>
          </div>
        </div>`;
    });
  }

  html += `
    <div class="pl-popup-create">
      <button onclick="quickCreateAndAdd(${songId}, '${escapeSingle(songTitle)}')">
        ＋ Tạo playlist mới
      </button>
    </div>`;

  popup.innerHTML = html;
}

// Định vị popup sát nút bấm
function positionPopup(popup, btn) {
  const rect = btn.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let top  = rect.bottom + scrollY + 6;
  let left = rect.left + scrollX;

  // Tránh popup bị ra ngoài màn hình bên phải
  if (left + 240 > window.innerWidth) {
    left = window.innerWidth - 250;
  }

  popup.style.top  = top + 'px';
  popup.style.left = left + 'px';
}

// Thêm bài vào playlist qua AJAX
function addSongToPlaylist(plId, plName, songId, songTitle, itemEl) {
  itemEl.style.opacity = '0.5';
  itemEl.style.pointerEvents = 'none';

  fetch(`/playlists/${plId}/add-song`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: `songId=${songId}`
  })
  .then(r => r.json())
  .then(data => {
    if (activePopup) {
      activePopup.classList.remove('open');
      activePopup = null;
    }
    if (data.ok) {
      showToast(`✅ Đã thêm vào "${plName}"`);
    } else {
      showToast('⚠️ ' + data.message, true);
    }
  })
  .catch(() => {
    itemEl.style.opacity = '';
    itemEl.style.pointerEvents = '';
    showToast('⚠️ Lỗi kết nối', true);
  });
}

// Tạo playlist mới rồi thêm bài vào luôn
function quickCreateAndAdd(songId, songTitle) {
  if (activePopup) { activePopup.classList.remove('open'); activePopup = null; }

  const name = prompt('Tên playlist mới:');
  if (!name || !name.trim()) return;

  // Tạo playlist
  fetch('/playlists/create', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `name=${encodeURIComponent(name.trim())}`
  })
  .then(r => {
    // Server redirect về /playlists/:id — lấy id từ URL cuối
    const url = r.url;
    const match = url.match(/\/playlists\/(\d+)/);
    if (!match) throw new Error('Không tạo được playlist');
    const plId = parseInt(match[1]);

    return fetch(`/playlists/${plId}/add-song`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: `songId=${songId}`
    });
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      showToast(`✅ Đã tạo playlist và thêm "${songTitle}"`);
    } else {
      showToast('⚠️ ' + (data.message || 'Lỗi'), true);
    }
  })
  .catch(err => showToast('⚠️ ' + err.message, true));
}

// Đóng popup khi click ra ngoài
document.addEventListener('click', (e) => {
  if (!activePopup) return;
  if (!activePopup.contains(e.target) && !e.target.closest('.add-pl-btn')) {
    activePopup.classList.remove('open');
    activePopup = null;
  }
});

/* ── TOAST ─────────────────────────────────────── */
function showToast(msg, isError) {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'globalToast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast ' + (isError ? 'toast-error' : 'toast-ok') + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ── DRAG-AND-DROP REORDER (trang playlist detail) ─
   Chỉ khởi động nếu tìm thấy #sortableList
──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('sortableList');
  if (!list) return;

  let dragged = null;

  list.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.pl-song-row');
    if (!row) return;
    dragged = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', () => {
    if (dragged) {
      dragged.classList.remove('dragging');
      dragged = null;
    }
    list.querySelectorAll('.pl-song-row').forEach(r => r.classList.remove('drag-over'));
    saveNewOrder();
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const row = e.target.closest('.pl-song-row');
    if (!row || row === dragged) return;
    list.querySelectorAll('.pl-song-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.pl-song-row');
    if (!target || target === dragged || !dragged) return;
    list.insertBefore(dragged, target);
    // Cập nhật số thứ tự hiển thị
    updateRowNumbers();
  });

  // Gán thuộc tính draggable cho từng row
  list.querySelectorAll('.pl-song-row').forEach(row => {
    row.setAttribute('draggable', 'true');
  });
});

// Cập nhật số thứ tự sau khi sắp xếp lại
function updateRowNumbers() {
  const rows = document.querySelectorAll('#sortableList .pl-song-row');
  rows.forEach((row, i) => {
    const num = row.querySelector('.num-label');
    if (num) num.textContent = i + 1;
    row.dataset.idx = i;
  });
}

// Lưu thứ tự mới về server
function saveNewOrder() {
  const rows    = document.querySelectorAll('#sortableList .pl-song-row');
  const songIds = Array.from(rows).map(r => r.dataset.id);
  const plId    = typeof PLAYLIST_ID !== 'undefined' ? PLAYLIST_ID : null;
  if (!plId) return;

  fetch(`/playlists/${plId}/reorder`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ songIds })
  }).catch(() => {});
}

/* ── HELPERS ────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeSingle(str) {
  return String(str).replace(/'/g, "\\'");
}
