import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AiConsensus = {
  technical: string;
  research: string;
  macro: string;
  risk: string;
  verdict: string;
  conviction: number;
  summary: string;
  cached: boolean;
  date: string;
};

const schema = z.object({
  technical: z.string(),
  research: z.string(),
  macro: z.string(),
  risk: z.string(),
  verdict: z.string(),
  conviction: z.number(),
  summary: z.string(),
});

/**
 * AI-teamet (Technical, Equity Research, Macro, Risk, Portfolio Manager) körs i ETT
 * kompakt anrop och cachas per aktie och dag för att minimera tokenförbrukning.
 */
export const getAiConsensus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ symbol: z.string().min(1).max(8) }).parse(data))
  .handler(async ({ data }): Promise<AiConsensus> => {
    const symbol = data.symbol.toUpperCase();
    const today = new Date().toISOString().slice(0, 10);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cached = await supabaseAdmin
      .from("ai_analysis")
      .select("payload")
      .eq("symbol", symbol)
      .eq("trade_date", today)
      .maybeSingle();
    if (cached.data?.payload) {
      return { ...(cached.data.payload as z.infer<typeof schema>), cached: true, date: today };
    }

    const { fetchChart, fetchFundamentals } = await import("./market.server");
    const { analyse } = await import("./stocks");
    const [chart, fundamentals] = await Promise.all([
      fetchChart(symbol, 420),
      fetchFundamentals(symbol),
    ]);
    if (!chart) throw new Error(`Ingen kursdata för ${symbol}`);
    const a = analyse(symbol, chart.candles, chart.price, chart.changePct, chart.currency);

    const facts = [
      `Aktie: ${a.symbol} (${a.name}, ${a.sector})`,
      `Pris ${a.price} ${a.currency}, dag ${a.changePct}%`,
      `SMA50 ${a.sma50} SMA200 ${a.sma200} RSI14 ${a.rsi14} volym/snitt20 ${a.volumeRatio}`,
      `P-strategi: ${a.criteriaMet}/6 (${a.criteria.map((c) => `${c.label}:${c.ok ? "ja" : "nej"}`).join(", ")})`,
      `Nivåer: IN ${a.entry} SL ${a.stopLoss} TP ${a.takeProfit} R ${a.r} uppsida ${a.upsidePct}%`,
      fundamentals
        ? `Fundamenta: P/E fwd ${fundamentals.peForward ?? "-"}, P/E ttm ${fundamentals.peTrailing ?? "-"}, EPS ${fundamentals.eps ?? "-"}, omsättningstillväxt ${fundamentals.revenueGrowth ?? "-"}, vinstmarginal ${fundamentals.profitMargin ?? "-"}, analytikermål ${fundamentals.targetMean ?? "-"}, beta ${fundamentals.beta ?? "-"}`
        : "Fundamenta: saknas",
    ].join("\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte tillgängligt just nu.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        instructions:
          "Du är ett AI-team för aktieanalys: Technical Analyst (P-strategi), Equity Research Analyst (fundamenta/värdering), Macro Strategist (marknad, sektor, makro), Risk Manager (risk, IN/SL/TP, R) och Portfolio Manager (sammanvägning). Svara på svenska, extremt koncist: max 2 meningar per roll. verdict = LONG, WATCH, NEUTRAL eller AVOID. conviction = heltal 1-10. summary = en mening.",
        input: facts,
        text: {
          format: {
            type: "json_schema",
            name: "ai_consensus",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                technical: { type: "string" },
                research: { type: "string" },
                macro: { type: "string" },
                risk: { type: "string" },
                verdict: { type: "string", enum: ["LONG", "WATCH", "NEUTRAL", "AVOID"] },
                conviction: { type: "integer" },
                summary: { type: "string" },
              },
              required: [
                "technical",
                "research",
                "macro",
                "risk",
                "verdict",
                "conviction",
                "summary",
              ],
            },
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      if (res.status === 429) throw new Error("För många AI-förfrågningar, försök om en stund.");
      if (res.status === 402) throw new Error("AI-krediter saknas i arbetsytan.");
      if (res.status === 403) throw new Error("AI är blockerat i arbetsytan.");
      throw new Error("AI-analysen misslyckades.");
    }

    // Reasoning-modeller måste strömmas; vi samlar texten på servern.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as any;
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            content += evt.delta;
          } else if (evt.type === "response.completed" && !content) {
            content = evt.response?.output_text ?? "";
          }
        } catch {
          // ignorera ofullständiga event
        }
      }
    }
    if (!content.trim()) throw new Error("AI-analysen gav inget svar, försök igen.");

    const parsed = schema.parse(JSON.parse(content));

    await supabaseAdmin
      .from("ai_analysis")
      .upsert({ symbol, trade_date: today, payload: parsed }, { onConflict: "symbol,trade_date" });

    return { ...parsed, cached: false, date: today };
  });
