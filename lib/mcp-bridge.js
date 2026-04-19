// MCP Bridge — WebSocket client for browser-tabs-mcp
// Connects to ws://127.0.0.1:8766 and exposes Chrome tab APIs to the MCP server.

const MCP_WS_URL = "ws://127.0.0.1:8766";
const KEEPALIVE_ALARM = "mcp-keepalive";
const MAX_RECONNECT_DELAY_MS = 30000;

let ws = null;
let reconnectTimer = null;
let reconnectDelayMs = 1000;

function connectMcp() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  let socket;
  try {
    socket = new WebSocket(MCP_WS_URL);
  } catch (e) {
    scheduleReconnect();
    return;
  }
  ws = socket;

  socket.onopen = () => {
    reconnectDelayMs = 1000;
    console.log("[MCP] Connected to", MCP_WS_URL);
  };

  socket.onmessage = async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const { id, action, params } = msg;
    try {
      const data = await handleMcpAction(action, params);
      safeSend({ id, data });
    } catch (e) {
      safeSend({ id, data: { error: e.message || String(e) } });
    }
  };

  socket.onclose = () => {
    if (ws === socket) ws = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    // onclose will fire, which handles reconnect
  };
}

function safeSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = reconnectDelayMs;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMcp();
  }, delay);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
}

async function handleMcpAction(action, params) {
  switch (action) {
    case "get_active_tab": {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tab ? serializeTab(tab) : null;
    }

    case "get_all_tabs": {
      const tabs = await chrome.tabs.query({});
      return { tabs: tabs.map(serializeTab) };
    }

    case "list_tab_groups": {
      const [groups, tabs] = await Promise.all([
        safeQueryGroups(),
        chrome.tabs.query({}),
      ]);
      const byGroupId = {};
      for (const g of groups) {
        byGroupId[g.id] = {
          id: g.id,
          title: g.title || "",
          color: g.color,
          windowId: g.windowId,
          tabs: [],
        };
      }
      const ungrouped = [];
      for (const t of tabs) {
        const item = serializeTab(t);
        if (t.groupId != null && t.groupId !== -1 && byGroupId[t.groupId]) {
          byGroupId[t.groupId].tabs.push(item);
        } else {
          ungrouped.push(item);
        }
      }
      return {
        groups: Object.values(byGroupId),
        ungrouped,
      };
    }

    case "get_tabs_in_group": {
      const groupName = params && params.groupName;
      if (!groupName) throw new Error("groupName is required");
      const groups = await safeQueryGroups();
      const match = groups.find((g) => (g.title || "") === groupName);
      if (!match) return { tabs: [] };
      const tabs = await chrome.tabs.query({ groupId: match.id });
      return {
        group: { id: match.id, title: match.title || "", color: match.color, windowId: match.windowId },
        tabs: tabs.map(serializeTab),
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function serializeTab(t) {
  return {
    id: t.id,
    url: t.url || t.pendingUrl || "",
    title: t.title || "",
    windowId: t.windowId,
    groupId: t.groupId,
    active: t.active,
    pinned: t.pinned,
  };
}

async function safeQueryGroups() {
  if (!chrome.tabGroups || !chrome.tabGroups.query) return [];
  try {
    return await chrome.tabGroups.query({});
  } catch {
    return [];
  }
}

// Keep the service worker reconnecting periodically.
// MV3 min alarm period is 30s (0.5 min).
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) connectMcp();
});

chrome.runtime.onStartup.addListener(() => connectMcp());
chrome.runtime.onInstalled.addListener(() => connectMcp());

// Initial connect on SW load
connectMcp();
