"use strict";

const $ = id => document.getElementById(id);

const STORAGE_KEY = "asiaTradingJournal_v1";
let trades = [];
let toastTimer;

const fields = [
  "date", "time", "session", "pair", "direction", "bias",
  "structure", "liquidity", "mss", "fvg", "ote",
  "entry", "stop", "target", "lot", "balance", "risk",
  "setup", "result", "pnl", "emotion", "entryReason",
  "exitReason", "mistakes", "lessons", "followed"
];

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function loadTrades() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    trades = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(trades)) {
      trades = [];
    }
  } catch (error) {
    trades = [];
    notify("Could not read saved trades.");
  }
}

function saveTrades() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    return true;
  } catch (error) {
    notify("Storage is full. Export your trades and free space.");
    return false;
  }
}

function getFormData() {
  const data = {};

  fields.forEach(id => {
    data[id] = $(id).value.trim();
  });

  return data;
}

function fillForm(trade) {
  fields.forEach(id => {
    $(id).value = trade[id] ?? "";
  });

  $("tradeId").value = trade.id || "";

  updateCalculations();

  $("formTitle").textContent = trade.id
    ? "Edit Trade"
    : "Record a New Trade";

  $("saveButton").textContent = trade.id
    ? "Update Trade ↗"
    : "Save Trade ↗";

  $("beforePreview").hidden = true;
  $("afterPreview").hidden = true;
  $("beforeImage").value = "";
  $("afterImage").value = "";
}

function clearForm() {
  $("tradeForm").reset();
  $("tradeId").value = "";

  $("date").value = new Date().toLocaleDateString("en-CA");
  $("time").value = new Date().toTimeString().slice(0, 5);
  $("direction").value = "Buy";
  $("risk").value = "1";

  $("rr").value = "";
  $("pnlPercent").value = "";

  $("beforePreview").hidden = true;
  $("afterPreview").hidden = true;

  $("formTitle").textContent = "Record a New Trade";
  $("saveButton").textContent = "Save Trade ↗";
}

function updateCalculations() {
  const entry = Number($("entry").value);
  const stop = Number($("stop").value);
  const target = Number($("target").value);
  const direction = $("direction").value;

  const valid = entry > 0 && stop > 0 && target > 0 &&
    (direction === "Buy"
      ? stop < entry && target > entry
      : target < entry && entry < stop);

  if (valid) {
    const riskDistance = Math.abs(entry - stop);
    const rewardDistance = Math.abs(target - entry);

    $("rr").value =
      "1:" + (rewardDistance / riskDistance).toFixed(2);
  } else {
    $("rr").value = "";
  }

  const pnlText = $("pnl").value;
  const balance = Number($("balance").value);

  $("pnlPercent").value =
    pnlText !== "" && balance > 0
      ? (Number(pnlText) / balance * 100).toFixed(2) + "%"
      : "";
}

function determineResult(trade) {
  if (trade.result) {
    return trade.result;
  }

  const pnl = Number(trade.pnl);

  if (pnl > 0) return "Win";
  if (pnl < 0) return "Loss";

  return "Breakeven";
}

function updateStatistics() {
  const closed = trades.filter(trade =>
    trade.pnl !== "" && Number.isFinite(Number(trade.pnl))
  );

  const wins = closed.filter(t => Number(t.pnl) > 0);
  const losses = closed.filter(t => Number(t.pnl) < 0);

  const net = closed.reduce(
    (sum, trade) => sum + Number(trade.pnl), 0
  );

  const latest = [...trades].sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time)
  )[0];

  $("netProfit").textContent = money(net);
  $("netProfit").className =
    net > 0 ? "positive" : net < 0 ? "negative" : "";

  $("winRate").textContent =
    (closed.length ? wins.length / closed.length * 100 : 0)
      .toFixed(1) + "%";

  $("winSummary").textContent =
    `${wins.length} wins · ${losses.length} losses`;

  $("totalTrades").textContent = trades.length;

  $("balanceDisplay").textContent =
    latest && latest.balance !== ""
      ? money(latest.balance)
      : "$0.00";
}

function renderTrades() {
  const search = $("search").value.toLowerCase().trim();
  const filter = $("resultFilter").value;

  const filtered = [...trades]
    .filter(t => (t.pair || "").toLowerCase().includes(search))
    .filter(t => filter === "All" || determineResult(t) === filter)
    .sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );

  if (!filtered.length) {
    $("tradeList").innerHTML = `
      <tr>
        <td colspan="8" class="empty">
          ${trades.length
            ? "No matching trades found."
            : "No trades recorded yet. Add your first trade above."}
        </td>
      </tr>`;
  } else {
    $("tradeList").innerHTML = filtered.map(t => {
      const result = determineResult(t);

      const badge = result === "Win"
        ? "win"
        : result === "Loss"
          ? "loss"
          : "breakeven";

      const pnl = Number(t.pnl || 0);

      return `
        <tr>
          <td>${safeText(t.date)}<br>${safeText(t.time)}</td>
          <td><strong>${safeText(t.pair)}</strong></td>
          <td>${safeText(t.direction)}</td>
          <td>${safeText(t.entry)}</td>
          <td>${safeText(t.rr || "—")}</td>
          <td class="${pnl > 0 ? "positive" : pnl < 0 ? "negative" : ""}">
            ${money(pnl)}
          </td>
          <td><span class="result-tag ${badge}">
            ${safeText(result)}
          </span></td>
          <td>
            <button class="row-btn"
              data-action="edit"
              data-id="${safeText(t.id)}">Edit</button>
            <button class="row-btn delete-btn"
              data-action="delete"
              data-id="${safeText(t.id)}">Delete</button>
          </td>
        </tr>`;
    }).join("");
  }

  $("tradeCount").textContent =
    `${filtered.length} trade${filtered.length === 1 ? "" : "s"} shown`;
}

function refresh() {
  renderTrades();
  updateStatistics();
}

function readScreenshot(inputId, previewId) {
  return new Promise((resolve, reject) => {
    const file = $(inputId).files[0];

    if (!file) {
      resolve(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    if (file.size > 900 * 1024) {
      reject(new Error(
        "Please resize screenshots to under 900 KB each."
      ));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = $(previewId);
      image.src = reader.result;
      image.hidden = false;
      resolve(reader.result);
    };

    reader.onerror = () =>
      reject(new Error("Could not read the screenshot."));

    reader.readAsDataURL(file);
  });
}

async function submitTrade(event) {
  event.preventDefault();

  const trade = getFormData();
  const editId = $("tradeId").value;

  const oldTrade = editId
    ? trades.find(t => t.id === editId)
    : null;

  const required = [
    "date", "time", "pair", "entry", "stop",
    "target", "lot", "balance", "risk", "pnl"
  ];

  for (const id of required) {
    if (trade[id] === "") {
      notify("Please complete all required fields.");
      $(id).focus();
      return;
    }
  }

  const numbers = [
    "entry", "stop", "target", "lot",
    "balance", "risk", "pnl"
  ];

  for (const id of numbers) {
    if (!Number.isFinite(Number(trade[id]))) {
      notify("Please enter valid numbers.");
      $(id).focus();
      return;
    }
  }

  if (
    Number(trade.entry) <= 0 ||
    Number(trade.stop) <= 0 ||
    Number(trade.target) <= 0 ||
    Number(trade.lot) <= 0 ||
    Number(trade.balance) <= 0 ||
    Number(trade.risk) < 0 ||
    Number(trade.risk) > 100
  ) {
    notify("Please check your prices, balance and risk.");
    return;
  }

  const entry = Number(trade.entry);
  const stop = Number(trade.stop);
  const target = Number(trade.target);

  const valid = trade.direction === "Buy"
    ? stop < entry && target > entry
    : target < entry && entry < stop;

  if (!valid) {
    notify("Buy: Stop Loss < Entry < Take Profit. Sell: Take Profit < Entry < Stop Loss.");
    return;
  }

  trade.rr = "1:" +
    (Math.abs(target - entry) / Math.abs(entry - stop))
      .toFixed(2);

  trade.pnlPercent =
    (Number(trade.pnl) / Number(trade.balance) * 100)
      .toFixed(2) + "%";

  if (!trade.result) {
    trade.result = Number(trade.pnl) > 0
      ? "Win"
      : Number(trade.pnl) < 0
        ? "Loss"
        : "Breakeven";
  }

  try {
    trade.beforeScreenshot =
      await readScreenshot("beforeImage", "beforePreview")
      || oldTrade?.beforeScreenshot || null;

    trade.afterScreenshot =
      await readScreenshot("afterImage", "afterPreview")
      || oldTrade?.afterScreenshot || null;
  } catch (error) {
    notify(error.message);
    return;
  }

  trade.id = editId || (
    crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2)
  );

  trade.createdAt = oldTrade?.createdAt || new Date().toISOString();
  trade.updatedAt = new Date().toISOString();

  const index = trades.findIndex(t => t.id === trade.id);

  if (index >= 0) {
    trades[index] = trade;
  } else {
    trades.push(trade);
  }

  if (!saveTrades()) {
    if (oldTrade) {
      trades = trades.map(t => t.id === oldTrade.id ? oldTrade : t);
    } else {
      trades = trades.filter(t => t.id !== trade.id);
    }

    return;
  }

  refresh();
  clearForm();

  notify(oldTrade ? "Trade updated successfully!" : "Trade saved successfully!");

  $("tradeForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function exportCSV() {
  if (!trades.length) {
    notify("There are no trades to export.");
    return;
  }

  const columns = [
    ["Date", "date"],
    ["Time", "time"],
    ["Trading Session", "session"],
    ["Market / Pair", "pair"],
    ["Trade Direction", "direction"],
    ["Daily Bias", "bias"],
    ["Market Structure", "structure"],
    ["Liquidity Sweep", "liquidity"],
    ["MSS", "mss"],
    ["FVG", "fvg"],
    ["OTE", "ote"],
    ["Entry Price", "entry"],
    ["Stop Loss", "stop"],
    ["Take Profit", "target"],
    ["Risk-to-Reward Ratio", "rr"],
    ["Lot Size", "lot"],
    ["Account Balance", "balance"],
    ["Risk Percentage", "risk"],
    ["Trade Setup", "setup"],
    ["Entry Reason", "entryReason"],
    ["Exit Reason", "exitReason"],
    ["Trade Result", "result"],
    ["Profit/Loss ($)", "pnl"],
    ["Profit/Loss (%)", "pnlPercent"],
    ["Emotional State", "emotion"],
    ["Mistakes Made", "mistakes"],
    ["Lessons Learned", "lessons"],
    ["Did I Follow My Plan?", "followed"]
  ];

  const csvCell = value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';

  const rows = [
    columns.map(c => csvCell(c[0])).join(","),
    ...trades.map(t =>
      columns.map(c => csvCell(t[c[1]])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + rows.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "Asia_Trading_Journal.csv";
  link.click();

  URL.revokeObjectURL(url);
  notify("Your CSV file has been downloaded.");
}

function setupEvents() {
  $("newTrade").addEventListener("click", () => {
    clearForm();
    $("tradeForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  $("tradeForm").addEventListener("submit", submitTrade);

  $("resetForm").addEventListener("click", () => {
    setTimeout(clearForm, 0);
  });

  ["entry", "stop", "target", "direction", "pnl", "balance"]
    .forEach(id => {
      $(id).addEventListener("input", updateCalculations);
      $(id).addEventListener("change", updateCalculations);
    });

  $("beforeImage").addEventListener("change", async () => {
    try {
      await readScreenshot("beforeImage", "beforePreview");
    } catch (error) {
      $("beforeImage").value = "";
      $("beforePreview").hidden = true;
      notify(error.message);
    }
  });

  $("afterImage").addEventListener("change", async () => {
    try {
      await readScreenshot("afterImage", "afterPreview");
    } catch (error) {
      $("afterImage").value = "";
      $("afterPreview").hidden = true;
      notify(error.message);
    }
  });

  $("search").addEventListener("input", renderTrades);
  $("resultFilter").addEventListener("change", renderTrades);
  $("exportCsv").addEventListener("click", exportCSV);

  $("tradeList").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const trade = trades.find(t => t.id === button.dataset.id);

    if (!trade) return;

    if (button.dataset.action === "edit") {
      fillForm(trade);

      $("tradeForm").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    if (button.dataset.action === "delete") {
      if (!confirm("Are you sure you want to delete this trade?")) {
        return;
      }

      const previous = trades;
      trades = trades.filter(t => t.id !== trade.id);

      if (!saveTrades()) {
        trades = previous;
        return;
      }

      refresh();
      notify("Trade deleted.");
    }
  });
}

function init() {
  loadTrades();
  setupEvents();
  clearForm();
  refresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}