document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("options-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  startDigest();
});

async function startDigest() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "get-digest" });

    if (response.error) {
      showError(response.error);
      return;
    }

    renderDigest(response);
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  document.getElementById("loading").hidden = true;
  document.getElementById("error").hidden = false;
  document.getElementById("error-message").textContent = message;
}

function renderDigest(data) {
  document.getElementById("loading").hidden = true;
  document.getElementById("digest").hidden = false;

  const { genres, tabCount, groupInfo } = data;

  document.getElementById("tab-count").textContent =
    `${tabCount} タブ / ${Object.keys(genres).length} ジャンル`;

  renderStats(genres);
  renderGenres(genres, groupInfo);
}

function renderStats(genres) {
  const statsBar = document.getElementById("stats");

  // Genre color palette
  const colors = [
    "#4a90d9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  ];

  const sorted = Object.entries(genres).sort((a, b) => b[1].length - a[1].length);

  sorted.forEach(([genre, items], i) => {
    const chip = document.createElement("div");
    chip.className = "stat-chip";
    chip.style.borderLeftColor = colors[i % colors.length];
    chip.style.borderLeftWidth = "3px";

    chip.innerHTML = `
      <span>${genre}</span>
      <span class="chip-count">${items.length}</span>
    `;

    chip.addEventListener("click", () => {
      const section = document.getElementById(`genre-${slugify(genre)}`);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    statsBar.appendChild(chip);
  });
}

function renderGenres(genres, groupInfo) {
  const container = document.getElementById("genres");

  const genreIcons = {
    "テクノロジー": "💻", "ビジネス": "💼", "デザイン": "🎨",
    "ニュース": "📰", "エンタメ": "🎬", "学習・教育": "📚",
    "ライフスタイル": "🏠", "開発ツール": "🛠️", "AI・機械学習": "🤖",
    "マーケティング": "📣", "ファイナンス": "💰", "健康": "🏥",
    "科学": "🔬", "スポーツ": "⚽", "旅行": "✈️",
    "料理・グルメ": "🍳", "音楽": "🎵", "ゲーム": "🎮",
    "SNS": "📱", "セキュリティ": "🔒",
  };

  const sorted = Object.entries(genres).sort((a, b) => b[1].length - a[1].length);

  sorted.forEach(([genre, items]) => {
    const section = document.createElement("div");
    section.className = "genre-section";
    section.id = `genre-${slugify(genre)}`;

    const icon = genreIcons[genre] || "📄";

    // Header
    const header = document.createElement("div");
    header.className = "genre-header";
    header.innerHTML = `
      <span class="genre-icon">${icon}</span>
      <span class="genre-name">${genre}</span>
      <span class="genre-count">${items.length}件</span>
      <span class="genre-toggle">▼</span>
    `;

    // Items
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "genre-items";

    items.forEach((item) => {
      const el = createTabItem(item, groupInfo);
      itemsContainer.appendChild(el);
    });

    // Toggle
    header.addEventListener("click", () => {
      const toggle = header.querySelector(".genre-toggle");
      toggle.classList.toggle("collapsed");
      itemsContainer.classList.toggle("collapsed");
    });

    section.appendChild(header);
    section.appendChild(itemsContainer);
    container.appendChild(section);
  });
}

function createTabItem(item, groupInfo) {
  const el = document.createElement("div");
  el.className = "tab-item";

  const domain = extractDomain(item.url);
  const isYT = item.url.includes("youtube.com") || item.url.includes("youtu.be");
  const ytBadge = isYT ? '<span class="badge-yt">YT</span>' : "";

  // Favicon
  let faviconHtml;
  if (item.favIconUrl) {
    faviconHtml = `<img class="tab-favicon" src="${escapeAttr(item.favIconUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="tab-favicon-placeholder" style="display:none">?</div>`;
  } else {
    faviconHtml = `<div class="tab-favicon-placeholder">?</div>`;
  }

  // Tab group badge
  let groupBadge = "";
  if (item.groupId && item.groupId !== -1 && groupInfo[item.groupId]) {
    const g = groupInfo[item.groupId];
    const bgColor = getGroupColor(g.color);
    groupBadge = `<span class="tab-group-badge" style="background:${bgColor.bg};color:${bgColor.text}">${escapeHtml(g.title || "グループ")}</span>`;
  }

  el.innerHTML = `
    ${faviconHtml}
    <div class="tab-info">
      <div class="tab-title">${escapeHtml(item.title)}${ytBadge}</div>
      <div class="tab-summary">${escapeHtml(item.summary || "")}</div>
      <div class="tab-domain">${escapeHtml(domain)} ${groupBadge}</div>
    </div>
    <div class="tab-actions">
      <button class="tab-action-btn" data-action="open" title="タブに移動">開く</button>
      <button class="tab-action-btn" data-action="summarize" title="詳細を要約">要約</button>
    </div>
  `;

  // Open tab
  el.querySelector('[data-action="open"]').addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.tabs.update(item.tabId, { active: true });
    if (item.windowId) {
      chrome.windows.update(item.windowId, { focused: true });
    }
  });

  // Summarize via voice recording
  const sumBtn = el.querySelector('[data-action="summarize"]');
  sumBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRecording(sumBtn, item);
  });

  return el;
}

// -- Voice Recording --

let activeRecorder = null;
let activeBtn = null;

async function toggleRecording(btn, item) {
  // Stop if already recording
  if (activeRecorder && activeBtn === btn) {
    activeRecorder.stop();
    return;
  }

  // Cancel any other active recording
  if (activeRecorder) {
    activeRecorder.stop();
    activeRecorder = null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const chunks = [];

    activeRecorder = recorder;
    activeBtn = btn;
    btn.textContent = "⏹ 停止";
    btn.style.background = "#fee2e2";
    btn.style.borderColor = "#ef4444";
    btn.style.color = "#dc2626";

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      activeRecorder = null;
      activeBtn = null;
      btn.textContent = "送信中...";
      btn.style.background = "#ebf5ff";
      btn.style.borderColor = "#4a90d9";
      btn.style.color = "#4a90d9";
      btn.disabled = true;

      const blob = new Blob(chunks, { type: "audio/webm" });
      const base64 = await blobToBase64(blob);

      try {
        const response = await chrome.runtime.sendMessage({
          type: "summarize-voice",
          audioData: base64,
          mimeType: "audio/webm",
          tabTitle: item.title,
          tabUrl: item.url,
        });

        if (response?.error) {
          alert(response.error);
        }
      } catch (err) {
        alert("要約に失敗: " + err.message);
      } finally {
        btn.textContent = "要約";
        btn.style.background = "";
        btn.style.borderColor = "";
        btn.style.color = "";
        btn.disabled = false;
      }
    };

    recorder.start();
  } catch (err) {
    alert("マイクへのアクセスが拒否されました");
  }
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result.split(",")[1]);
    };
    reader.readAsDataURL(blob);
  });
}

// -- Utilities --

function slugify(text) {
  return text.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g, "-").toLowerCase();
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function getGroupColor(chromeColor) {
  const map = {
    grey:    { bg: "#e2e8f0", text: "#4a5568" },
    blue:    { bg: "#dbeafe", text: "#1e40af" },
    red:     { bg: "#fee2e2", text: "#991b1b" },
    yellow:  { bg: "#fef3c7", text: "#92400e" },
    green:   { bg: "#d1fae5", text: "#065f46" },
    pink:    { bg: "#fce7f3", text: "#9d174d" },
    purple:  { bg: "#ede9fe", text: "#5b21b6" },
    cyan:    { bg: "#cffafe", text: "#155e75" },
    orange:  { bg: "#ffedd5", text: "#9a3412" },
  };
  return map[chromeColor] || map.grey;
}
