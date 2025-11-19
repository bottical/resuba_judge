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

let radarChart = null;

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  // 初期表示
  updateStateFromInputs();
  updatePreview();
});

function bindEvents() {
  const btnUpdate = document.getElementById("btnUpdate");
  const btnReset = document.getElementById("btnReset");
  const btnApplyJson = document.getElementById("btnApplyJson");

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

  btnApplyJson.addEventListener("click", () => {
    applyJson();
  });
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
  state.sideAName = document.getElementById("sideAName").value.trim() || "側A";
  state.sideBName = document.getElementById("sideBName").value.trim() || "側B";

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
}

// JSON貼り付け → 反映
function applyJson() {
  const text = document.getElementById("jsonInput").value.trim();
  if (!text) {
    alert("JSONが入力されていません。");
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

      if (typeof A.fallacyPenalty === "number")
        document.getElementById("A_fallacy").value = A.fallacyPenalty;
      if (typeof B.fallacyPenalty === "number")
        document.getElementById("B_fallacy").value = B.fallacyPenalty;
    }
    if (typeof data.winner === "string") {
      const normalized = data.winner.toLowerCase();
      if (normalized === "a" || normalized === "b" || normalized === "draw") {
        document.getElementById("winner").value = normalized.toUpperCase
          ? normalized
          : normalized;
      }
    }
    if (Array.isArray(data.summaryReasons)) {
      document.getElementById("summaryReasons").value =
        data.summaryReasons.join("\n");
    }

    // 入力に反映後、プレビュー更新
    updateStateFromInputs();
    updatePreview();
  } catch (e) {
    console.error(e);
    alert("JSONの解析に失敗しました。形式を確認してください。");
  }
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

  document.getElementById("reportSideAName").textContent = state.sideAName;
  document.getElementById("reportSideBName").textContent = state.sideBName;
  document.getElementById("thSideA").textContent = state.sideAName;
  document.getElementById("thSideB").textContent = state.sideBName;

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
    text += "側A勝利";
    badge.classList.add("win-a");
  } else if (winnerFinal === "B") {
    text += "側B勝利";
    badge.classList.add("win-b");
  } else {
    text += "未判定";
  }
  badge.textContent = text;

  // 判定テキスト
  const verdictEl = document.getElementById("reportVerdictText");
  verdictEl.textContent = `総合点：側A ${totalA} 点 / 側B ${totalB} 点（点差 ${
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
        label: state.sideAName || "側A",
        data: aData,
        borderWidth: 2,
        pointRadius: 3
      },
      {
        label: state.sideBName || "側B",
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
          stepSize: 20
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
