// 軽い状態管理用オブジェクト
const state = {
  weights: {
    validity: 0.2,
    consistency: 0.2,
    interpretation: 0.15,
    clarity: 0.15,
    persuasiveness: 0.15,
    stance: 0.15
  },
  drawThreshold: 10,
  scores: {
    A: {
      validity: 70,
      consistency: 65,
      interpretation: 80,
      clarity: 60,
      persuasiveness: 60,
      stance: 30,
      fallacy: 40
    },
    B: {
      validity: 50,
      consistency: 55,
      interpretation: 40,
      clarity: 50,
      persuasiveness: 52,
      stance: 34,
      fallacy: 55
    }
  },
  winner: "A",
  topic: "",
  sideAName: "",
  sideBName: "",
  summaryReasons: []
};

const STORAGE_KEYS = {
  apiEndpoint: "resuba_api_endpoint",
  apiKey: "resuba_api_key"
};

let radarChart = null;
let jsonApplyTimer = null;
let aiRequestAbortController = null;

document.addEventListener("DOMContentLoaded", () => {
  initApiSettings();
  bindEvents();
  // 初期表示
  updateStateFromInputs();
  updatePreview();
  updateJsonStatus("AIのJSONを貼り付けると自動反映します。");
});

function bindEvents() {
  const btnUpdate = document.getElementById("btnUpdate");
  const btnReset = document.getElementById("btnReset");
  const btnMockAi = document.getElementById("btnMockAi");
  const btnAiApi = document.getElementById("btnAiApi");
  const jsonInput = document.getElementById("jsonInput");

  btnUpdate.addEventListener("click", () => {
    updateStateFromInputs();
    updatePreview();
  });

  btnReset.addEventListener("click", () => {
    if (!confirm("入力内容をリセットしますか？")) return;
    resetInputs();
    updateStateFromInputs();
    updatePreview();
  });

  if (jsonInput) {
    jsonInput.addEventListener("input", (event) => {
      scheduleJsonApply(event.target.value);
    });
  }

  if (btnMockAi) {
    btnMockAi.addEventListener("click", () => {
      handleMockAiAnalysis();
    });
  }

  if (btnAiApi) {
    btnAiApi.addEventListener("click", () => {
      handleAiApiAnalysis();
    });
  }
}

function initApiSettings() {
  const endpointInput = document.getElementById("apiEndpoint");
  const apiKeyInput = document.getElementById("apiKey");

  if (endpointInput) {
    const savedEndpoint = safeLocalStorageGet(STORAGE_KEYS.apiEndpoint);
    if (savedEndpoint) {
      endpointInput.value = savedEndpoint;
    }
    endpointInput.addEventListener("change", (event) => {
      safeLocalStorageSet(STORAGE_KEYS.apiEndpoint, event.target.value.trim());
    });
  }

  if (apiKeyInput) {
    const savedKey = safeLocalStorageGet(STORAGE_KEYS.apiKey);
    if (savedKey) {
      apiKeyInput.value = savedKey;
    }
    apiKeyInput.addEventListener("change", (event) => {
      safeLocalStorageSet(STORAGE_KEYS.apiKey, event.target.value.trim());
    });
  }
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (error) {
    console.warn("localStorageが利用できません", error);
    return "";
  }
}

function safeLocalStorageSet(key, value) {
  try {
    if (!value) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn("localStorageへの保存に失敗しました", error);
  }
}

function getApiSettingsFromInputs() {
  const endpointInput = document.getElementById("apiEndpoint");
  const apiKeyInput = document.getElementById("apiKey");
  return {
    endpoint: endpointInput ? endpointInput.value.trim() : "",
    apiKey: apiKeyInput ? apiKeyInput.value.trim() : ""
  };
}

function buildApiPayloadFromInputs(transcript) {
  const payload = { transcript };
  const topicInput = document.getElementById("topic");
  const sideAInput = document.getElementById("sideAName");
  const sideBInput = document.getElementById("sideBName");

  const meta = {};
  if (topicInput && topicInput.value.trim()) meta.topic = topicInput.value.trim();
  if (sideAInput && sideAInput.value.trim()) meta.sideA = sideAInput.value.trim();
  if (sideBInput && sideBInput.value.trim()) meta.sideB = sideBInput.value.trim();
  if (Object.keys(meta).length > 0) {
    payload.meta = meta;
  }
  return payload;
}

function setAiApiButtonState(isLoading) {
  const btn = document.getElementById("btnAiApi");
  if (!btn) return;
  if (!btn.dataset.defaultLabel) {
    btn.dataset.defaultLabel = btn.textContent.trim();
  }
  btn.disabled = isLoading;
  if (isLoading) {
    btn.classList.add("loading");
    btn.textContent = "解析中…";
  } else {
    btn.classList.remove("loading");
    btn.textContent = btn.dataset.defaultLabel;
  }
}

async function handleAiApiAnalysis() {
  const transcriptEl = document.getElementById("rawTranscript");
  if (!transcriptEl) return;
  const transcript = transcriptEl.value.trim();
  if (!transcript) {
    alert("レスバテキストが入力されていません。");
    return;
  }

  const { endpoint, apiKey } = getApiSettingsFromInputs();
  if (!endpoint) {
    alert("AI APIエンドポイントを入力してください。");
    return;
  }

  if (aiRequestAbortController) {
    aiRequestAbortController.abort();
  }

  const controller = new AbortController();
  aiRequestAbortController = controller;

  setAiApiButtonState(true);
  updateJsonStatus("AI APIに問い合わせ中です…", "pending");

  try {
    const payload = buildApiPayloadFromInputs(transcript);
    const headers = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error("APIレスポンスのJSON解析に失敗しました。");
    }

    const jsonInput = document.getElementById("jsonInput");
    const formatted = JSON.stringify(data, null, 2);
    if (jsonInput) {
      jsonInput.value = formatted;
    }
    applyJson(formatted);
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.error("AI API error", error);
    updateJsonStatus("AI API呼び出しに失敗しました。コンソールを確認してください。", "error");
    alert(`AI APIの呼び出しに失敗しました。\n${error.message || "詳細不明"}`);
  } finally {
    if (aiRequestAbortController === controller) {
      aiRequestAbortController = null;
      setAiApiButtonState(false);
    }
  }
}

function getNumberValue(id, min = 0, max = 100, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const raw = parseFloat(el.value);
  if (isNaN(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

function updateStateFromInputs() {
  state.topic = document.getElementById("topic").value.trim();
  state.sideAName = document.getElementById("sideAName").value.trim() || "Aサイド";
  state.sideBName = document.getElementById("sideBName").value.trim() || "Bサイド";

  state.scores.A.validity = getNumberValue("A_validity");
  state.scores.B.validity = getNumberValue("B_validity");
  state.scores.A.consistency = getNumberValue("A_consistency");
  state.scores.B.consistency = getNumberValue("B_consistency");
  state.scores.A.interpretation = getNumberValue("A_interpretation");
  state.scores.B.interpretation = getNumberValue("B_interpretation");
  state.scores.A.clarity = getNumberValue("A_clarity");
  state.scores.B.clarity = getNumberValue("B_clarity");
  state.scores.A.persuasiveness = getNumberValue("A_persuasiveness");
  state.scores.B.persuasiveness = getNumberValue("B_persuasiveness");
  state.scores.A.stance = getNumberValue("A_stance");
  state.scores.B.stance = getNumberValue("B_stance");
  state.scores.A.fallacy = getNumberValue("A_fallacy", 0, 60);
  state.scores.B.fallacy = getNumberValue("B_fallacy", 0, 60);

  const winnerSel = document.getElementById("winner");
  state.winner = winnerSel.value;

  state.drawThreshold = getNumberValue("drawThreshold", 0, 50, 10);

  const reasonsText = document.getElementById("summaryReasons").value;
  state.summaryReasons = reasonsText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function resetInputs() {
  const transcript = document.getElementById("rawTranscript");
  if (transcript) transcript.value = "";

  document.getElementById("topic").value = "";
  document.getElementById("sideAName").value = "";
  document.getElementById("sideBName").value = "";

  // 点数系は一旦デフォルトに戻す（必要ならお好みで変更）
  document.getElementById("A_validity").value = 70;
  document.getElementById("B_validity").value = 50;
  document.getElementById("A_consistency").value = 65;
  document.getElementById("B_consistency").value = 55;
  document.getElementById("A_interpretation").value = 80;
  document.getElementById("B_interpretation").value = 40;
  document.getElementById("A_clarity").value = 60;
  document.getElementById("B_clarity").value = 50;
  document.getElementById("A_persuasiveness").value = 60;
  document.getElementById("B_persuasiveness").value = 52;
  document.getElementById("A_stance").value = 30;
  document.getElementById("B_stance").value = 34;
  document.getElementById("A_fallacy").value = 40;
  document.getElementById("B_fallacy").value = 55;

  document.getElementById("winner").value = "A";
  document.getElementById("drawThreshold").value = 10;
  document.getElementById("summaryReasons").value = "";
  document.getElementById("jsonInput").value = "";
  updateJsonStatus("AIのJSONを貼り付けると自動反映します。");
}

function scheduleJsonApply(rawText) {
  const trimmed = (rawText || "").trim();
  clearTimeout(jsonApplyTimer);
  if (!trimmed) {
    updateJsonStatus("AIのJSONを貼り付けると自動反映します。");
    return;
  }
  updateJsonStatus("JSONを解析しています…", "pending");
  jsonApplyTimer = setTimeout(() => {
    applyJson(trimmed);
  }, 450);
}

// JSON貼り付け → 反映
function applyJson(rawText = null) {
  const text =
    typeof rawText === "string"
      ? rawText.trim()
      : document.getElementById("jsonInput").value.trim();
  if (!text) {
    updateJsonStatus("JSONが入力されていません。", "error");
    return;
  }
  try {
    const data = JSON.parse(text);

    if (data.meta) {
      if (data.meta.topic) {
        document.getElementById("topic").value = data.meta.topic;
      }
      if (data.meta.sideA) {
        document.getElementById("sideAName").value = data.meta.sideA;
      }
      if (data.meta.sideB) {
        document.getElementById("sideBName").value = data.meta.sideB;
      }
    }
    if (data.scores && data.scores.A && data.scores.B) {
      const A = data.scores.A;
      const B = data.scores.B;

      if (typeof A.validity === "number")
        document.getElementById("A_validity").value = A.validity;
      if (typeof B.validity === "number")
        document.getElementById("B_validity").value = B.validity;

      if (typeof A.consistency === "number")
        document.getElementById("A_consistency").value = A.consistency;
      if (typeof B.consistency === "number")
        document.getElementById("B_consistency").value = B.consistency;

      if (typeof A.interpretation === "number")
        document.getElementById("A_interpretation").value =
          A.interpretation;
      if (typeof B.interpretation === "number")
        document.getElementById("B_interpretation").value =
          B.interpretation;

      if (typeof A.clarity === "number")
        document.getElementById("A_clarity").value = A.clarity;
      if (typeof B.clarity === "number")
        document.getElementById("B_clarity").value = B.clarity;

      if (typeof A.persuasiveness === "number")
        document.getElementById("A_persuasiveness").value =
          A.persuasiveness;
      if (typeof B.persuasiveness === "number")
        document.getElementById("B_persuasiveness").value =
          B.persuasiveness;

      if (typeof A.stance === "number")
        document.getElementById("A_stance").value = A.stance;
      if (typeof B.stance === "number")
        document.getElementById("B_stance").value = B.stance;

      const fallacyA =
        typeof A.fallacyPenalty === "number"
          ? A.fallacyPenalty
          : typeof A.fallacy === "number"
          ? A.fallacy
          : null;
      const fallacyB =
        typeof B.fallacyPenalty === "number"
          ? B.fallacyPenalty
          : typeof B.fallacy === "number"
          ? B.fallacy
          : null;

      if (fallacyA !== null) document.getElementById("A_fallacy").value = fallacyA;
      if (fallacyB !== null) document.getElementById("B_fallacy").value = fallacyB;
    }

    if (Array.isArray(data.summaryReasons)) {
      document.getElementById("summaryReasons").value =
        data.summaryReasons.join("\n");
    }

    // 入力に反映後、プレビュー更新
    updateStateFromInputs();
    updatePreview();
    updateJsonStatus("AI出力を反映しました。", "success");
  } catch (e) {
    console.error(e);
    updateJsonStatus("JSONの解析に失敗しました。形式を確認してください。", "error");
  }
}

function handleMockAiAnalysis() {
  const transcriptEl = document.getElementById("rawTranscript");
  if (!transcriptEl) return;
  const transcript = transcriptEl.value.trim();
  if (!transcript) {
    alert("レスバテキストが入力されていません。");
    return;
  }

  const mock = mockAnalyzeTranscript(transcript);
  const jsonInput = document.getElementById("jsonInput");
  jsonInput.value = JSON.stringify(mock, null, 2);
  applyJson(jsonInput.value);
}

function updateJsonStatus(message, state = "info") {
  const statusEl = document.getElementById("jsonStatus");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove("pending", "success", "error");
  if (state && state !== "info") {
    statusEl.classList.add(state);
  }
}

function mockAnalyzeTranscript(transcript) {
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const participants = [];
  const stats = {};

  const ensureStats = (name) => {
    if (!stats[name]) {
      stats[name] = {
        lines: 0,
        chars: 0,
        questions: 0,
        exclaims: 0,
        negatives: 0
      };
    }
    return stats[name];
  };

  const negativePatterns = [
    /死ね/g,
    /殺す/g,
    /バカ/g,
    /馬鹿/g,
    /クソ/g,
    /ゴミ/g,
    /最悪/g,
    /黙れ/g,
    /雑魚/g
  ];

  lines.forEach((line) => {
    const match = line.match(/^([^\s:：]+)\s*[:：](.+)$/);
    const speaker = match ? match[1].trim() : "";
    const content = match ? match[2].trim() : line;
    const normalizedSpeaker = speaker || "不明";

    if (normalizedSpeaker && !participants.includes(normalizedSpeaker)) {
      participants.push(normalizedSpeaker);
    }

    const target = ensureStats(normalizedSpeaker);
    target.lines += 1;
    target.chars += content.length;
    target.questions += (content.match(/[?？]/g) || []).length;
    target.exclaims += (content.match(/[!！]/g) || []).length;

    negativePatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        target.negatives += matches.length;
      }
    });
  });

  const sideA = participants[0] || "Aサイド";
  const sideB = participants[1] || (participants[0] ? "相手" : "Bサイド");
  const defaultStats = { lines: 0, chars: 0, questions: 0, exclaims: 0, negatives: 0 };
  const aStats = stats[sideA] || defaultStats;
  const bStats = stats[sideB] || defaultStats;

  const clampScore = (value, min = 15, max = 95) =>
    Math.round(Math.min(max, Math.max(min, value)));
  const clampPenalty = (value) => Math.round(Math.min(60, Math.max(0, value)));
  const avgLength = (s) => (s.lines === 0 ? 0 : s.chars / s.lines);

  const validityDiff = (aStats.lines - bStats.lines) * 1.5;
  const consistencyDiff = (avgLength(aStats) - avgLength(bStats)) * 6;
  const referenceDiff = (aStats.questions - bStats.questions) * 2;
  const clarityDiff = (bStats.exclaims - aStats.exclaims) * 1.4;
  const persuasionDiff = (aStats.chars - bStats.chars) * 0.04 + referenceDiff * 0.3;
  const stanceDiff = (bStats.negatives + bStats.exclaims * 0.5 - (aStats.negatives + aStats.exclaims * 0.5)) * 3;

  const scoresA = {
    validity: clampScore(60 + validityDiff),
    consistency: clampScore(58 + consistencyDiff),
    interpretation: clampScore(62 + referenceDiff),
    clarity: clampScore(57 + clarityDiff),
    persuasiveness: clampScore(60 + persuasionDiff),
    stance: clampScore(70 + stanceDiff, 20, 92)
  };

  const scoresB = {
    validity: clampScore(60 - validityDiff),
    consistency: clampScore(58 - consistencyDiff),
    interpretation: clampScore(62 - referenceDiff),
    clarity: clampScore(57 - clarityDiff),
    persuasiveness: clampScore(60 - persuasionDiff),
    stance: clampScore(70 - stanceDiff, 20, 92)
  };

  scoresA.fallacy = clampPenalty(20 + aStats.exclaims * 2 + aStats.negatives * 5);
  scoresB.fallacy = clampPenalty(20 + bStats.exclaims * 2 + bStats.negatives * 5);
  scoresA.fallacyPenalty = scoresA.fallacy;
  scoresB.fallacyPenalty = scoresB.fallacy;

  const totalA = computeTotal(scoresA);
  const totalB = computeTotal(scoresB);
  let winner = "draw";
  if (Math.abs(totalA - totalB) >= state.drawThreshold) {
    winner = totalA > totalB ? "A" : "B";
  }

  const firstLine = lines[0] || "";
  const topicCandidate = firstLine
    .replace(/^([^\s:：]+)\s*[:：]/, "")
    .trim()
    .slice(0, 80);
  const topic = topicCandidate || `${sideA} vs ${sideB} のレスバログ`;

  const summaryReasons = [
    `${sideA}は${aStats.lines}発言で、${sideB}の${bStats.lines}発言と比較して${
      aStats.lines >= bStats.lines ? "議論を主導" : "控えめ"
    }。`,
    `疑問・ツッコミの回数：${sideA} ${aStats.questions} 回 / ${sideB} ${bStats.questions} 回。`,
    `詭弁ペナルティ：${sideA} ${scoresA.fallacy} 点 / ${sideB} ${scoresB.fallacy} 点。`
  ];

  return {
    meta: {
      topic,
      sideA,
      sideB,
      turns: lines.length
    },
    scores: {
      A: scoresA,
      B: scoresB
    },
    winner,
    summaryReasons
  };
}

// 総合点計算
function computeTotal(score) {
  const w = state.weights;
  const base =
    w.validity * score.validity +
    w.consistency * score.consistency +
    w.interpretation * score.interpretation +
    w.clarity * score.clarity +
    w.persuasiveness * score.persuasiveness +
    w.stance * score.stance;
  const penalty = score.fallacy || 0;
  return Math.round(base - penalty);
}

function updatePreview() {
  // 総合点計算
  const totalA = computeTotal(state.scores.A);
  const totalB = computeTotal(state.scores.B);
  const displayNameA = state.sideAName || "Aサイド";
  const displayNameB = state.sideBName || "Bサイド";

  // 必要に応じて自動判定（drawThreshold使用）
  let autoWinner = "draw";
  if (Math.abs(totalA - totalB) < state.drawThreshold) {
    autoWinner = "draw";
  } else {
    autoWinner = totalA > totalB ? "A" : "B";
  }

  // 入力で指定した winner があれば優先、無ければ自動
  const winnerSel = document.getElementById("winner").value;
  const winnerFinal =
    winnerSel === "A" || winnerSel === "B" || winnerSel === "draw"
      ? winnerSel
      : autoWinner;

  // タイトル・名前
  document.getElementById("reportTitle").textContent =
    "レスバ判定レポート（7軸評価）";
  document.getElementById("reportTopic").textContent =
    state.topic.trim().length > 0
      ? `テーマ：${state.topic.trim()}`
      : "テーマ：入力パネルからテーマを設定してください。";

  document.getElementById("reportSideAName").textContent = displayNameA;
  document.getElementById("reportSideBName").textContent = displayNameB;

  const partyLabelA = document.getElementById("reportSideALabel");
  const partyLabelB = document.getElementById("reportSideBLabel");
  if (partyLabelA) partyLabelA.textContent = displayNameA;
  if (partyLabelB) partyLabelB.textContent = displayNameB;

  const totalLabelA = document.getElementById("totalLabelSideA");
  const totalLabelB = document.getElementById("totalLabelSideB");
  if (totalLabelA) totalLabelA.textContent = displayNameA;
  if (totalLabelB) totalLabelB.textContent = displayNameB;

  document.getElementById("thSideA").textContent = displayNameA;
  document.getElementById("thSideB").textContent = displayNameB;

  // 総合点
  document.getElementById("reportTotalA").textContent = totalA;
  document.getElementById("reportTotalB").textContent = totalB;

  // 個別スコア（テーブル）
  const sA = state.scores.A;
  const sB = state.scores.B;
  document.getElementById("cell_A_validity").textContent = sA.validity;
  document.getElementById("cell_B_validity").textContent = sB.validity;
  document.getElementById("cell_A_consistency").textContent =
    sA.consistency;
  document.getElementById("cell_B_consistency").textContent =
    sB.consistency;
  document.getElementById("cell_A_interpretation").textContent =
    sA.interpretation;
  document.getElementById("cell_B_interpretation").textContent =
    sB.interpretation;
  document.getElementById("cell_A_clarity").textContent = sA.clarity;
  document.getElementById("cell_B_clarity").textContent = sB.clarity;
  document.getElementById("cell_A_persuasiveness").textContent =
    sA.persuasiveness;
  document.getElementById("cell_B_persuasiveness").textContent =
    sB.persuasiveness;
  document.getElementById("cell_A_stance").textContent = sA.stance;
  document.getElementById("cell_B_stance").textContent = sB.stance;
  document.getElementById("cell_A_fallacy").textContent = sA.fallacy;
  document.getElementById("cell_B_fallacy").textContent = sB.fallacy;

  // 勝者バッジ
  const badge = document.getElementById("reportWinnerBadge");
  badge.classList.remove("win-a", "win-b", "draw");

  let text = "判定：";
  if (winnerFinal === "draw") {
    text += "引き分け";
    badge.classList.add("draw");
  } else if (winnerFinal === "A") {
    text += `${displayNameA} 勝利`;
    badge.classList.add("win-a");
  } else if (winnerFinal === "B") {
    text += `${displayNameB} 勝利`;
    badge.classList.add("win-b");
  } else {
    text += "未判定";
  }
  badge.textContent = text;

  // 判定テキスト
  const verdictEl = document.getElementById("reportVerdictText");
  verdictEl.textContent = `総合点：${displayNameA} ${totalA} 点 / ${displayNameB} ${totalB} 点（点差 ${
    Math.abs(totalA - totalB)
  }、引き分け閾値 ${state.drawThreshold}）`;

  // 判定理由リスト
  const ul = document.getElementById("reportReasonsList");
  ul.innerHTML = "";
  if (state.summaryReasons.length > 0) {
    state.summaryReasons.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });
  }

  // レーダーチャート更新
  updateRadarChart();
}

function updateRadarChart() {
  const ctx = document.getElementById("radarChart");
  if (!ctx) return;

  const labels = [
    "① データ妥当性",
    "② 論理一貫性",
    "③ 引用の正確性",
    "④ 再現性・明確性",
    "⑤ 説得力",
    "⑥ 対話姿勢",
    "⑦（100 - 詭弁ペナルティ）"
  ];

  const a = state.scores.A;
  const b = state.scores.B;

  const aData = [
    a.validity,
    a.consistency,
    a.interpretation,
    a.clarity,
    a.persuasiveness,
    a.stance,
    100 - a.fallacy
  ];
  const bData = [
    b.validity,
    b.consistency,
    b.interpretation,
    b.clarity,
    b.persuasiveness,
    b.stance,
    100 - b.fallacy
  ];

  const data = {
    labels,
    datasets: [
      {
        label: state.sideAName || "Aサイド",
        data: aData,
        borderWidth: 2,
        pointRadius: 3
      },
      {
        label: state.sideBName || "Bサイド",
        data: bData,
        borderWidth: 2,
        pointRadius: 3
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          display: true,
          color: "#9aa3b9",
          stepSize: 20,
          backdropColor: "transparent"
        },
        grid: {
          color: "#252c3c"
        },
        angleLines: {
          color: "#252c3c"
        },
        pointLabels: {
          color: "#cfd6ea",
          font: {
            size: 10
          }
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: "#e5ecff",
          font: { size: 11 }
        }
      }
    }
  };

  if (radarChart) {
    radarChart.data = data;
    radarChart.options = options;
    radarChart.update();
  } else {
    radarChart = new Chart(ctx, {
      type: "radar",
      data,
      options
    });
  }
}
