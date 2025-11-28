export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // 必要なら GitHub Pages のURLに絞る
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    // Preflight 対応
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Use POST" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // OpenAI APIキー読み込み
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not set in Worker secrets" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // リクエストボディ取得
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    const transcript = body.transcript;
    const meta = body.meta || {};

    if (!transcript || typeof transcript !== "string") {
      return new Response(
        JSON.stringify({ error: "transcript (string) is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // ここから OpenAI に投げる
    const systemPrompt = `
    あなたはオンライン議論の審判AIです。
    レスバ（1対1の対立構造）について、以下の7軸で精密に評価し、日本語で要約します。
    
    ・validity（主張の妥当性）  
    ・consistency（一貫性）  
    ・interpretation（相手の主張の正確な理解度）  
    ・clarity（説明の明瞭さ）  
    ・persuasiveness（説得力）  
    ・stance（立場の明確さ）  
    ・fallacyPenalty（詭弁・誤謬への減点）
    
    各スコアは、0〜100の整数で出力してください。
    
    さらに、summaryReasons を「高度な分析」にアップグレードしてください。  
    summaryReasons には最低 4〜8 行の配列を返し、以下を必ず含めること：
    
    1. **具体的な投稿文の引用**  
       - A と B の発言のうち、評価の根拠になった文章を引用してください  
       - 「○○と述べているが〜」「△△と主張しているが〜」のように引用つきで説明
    
    2. **詭弁の具体的指摘**  
       - “藁人形論法”“論点ずらし”“原因のない一般化”“根拠なき断定”“感情論への依存”など  
       - 発生箇所を発言に紐づけて説明（例：「Bの『○○』は論点のすり替えである」）
    
    3. **AとBのギャップ分析（特に認知のズレ）**  
       - 例：「Aはデータに依拠しているが、Bは体感・信念に依存しており議論の土台が異なる」  
       - 「概念の定義」「証明責任」「根拠の種類」など、議論の層の違いを比較
    
    4. **議論全体での構造分析**  
       - 例：「Aは冒頭から一貫して○○を主張」「Bは途中で主張の軸が△△へ変化」など
    
    5. **勝敗理由をより精緻に説明**  
       - なぜ winner が A / B / draw になったのかを詳細に述べる
    
    出力フォーマットは次のJSON形式“のみ”で返してください（余計な文章は禁止）：
    
    {
      "meta": {
        "topic": "短いテーマ要約",
        "sideA": "側Aの名前",
        "sideB": "側Bの名前"
      },
      "scores": {
        "A": {
          "validity": 0,
          "consistency": 0,
          "interpretation": 0,
          "clarity": 0,
          "persuasiveness": 0,
          "stance": 0,
          "fallacyPenalty": 0
        },
        "B": {
          "validity": 0,
          "consistency": 0,
          "interpretation": 0,
          "clarity": 0,
          "persuasiveness": 0,
          "stance": 0,
          "fallacyPenalty": 0
        }
      },
      "summaryReasons": ["...", "..."]
    }
    
    `.trim();

    const userPrompt = `
以下は側Aと側Bの議論ログです（そのまま貼り付け）:

${transcript}

meta情報（任意）:
${JSON.stringify(meta, null, 2)}

上記に基づき、指定したJSON形式だけを返してください。
    `.trim();

    try {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!openaiRes.ok) {
        const text = await openaiRes.text();
        return new Response(
          JSON.stringify({ error: "OpenAI error", detail: text }),
          {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          }
        );
      }

      // ★ ChatCompletion ラッパーを一度パース
      const completion = await openaiRes.json();

      // ★ GPTが返した「中身のJSON文字列」だけを取り出す
      const innerJsonText = completion?.choices?.[0]?.message?.content;

      if (!innerJsonText) {
        return new Response(
          JSON.stringify({ error: "No content in OpenAI response" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          }
        );
      }

      // 念のため一度パースして整形し直してから返す（フロント側は .json() で受ける前提）
      let parsed;
      try {
        parsed = JSON.parse(innerJsonText);
      } catch (e) {
        // JSONとしてパースできない場合はそのまま返す（デバッグ用）
        return new Response(
          JSON.stringify({
            error: "Failed to parse inner JSON from OpenAI",
            raw: innerJsonText
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          }
        );
      }

      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Unexpected error", detail: String(e) }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }
  }
};
