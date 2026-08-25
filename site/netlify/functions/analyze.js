// Valora KI-Schnelltest: Nebenkosten-/Hausgeldabrechnung analysieren.
// Primär: direktes Google Gemini (volle Antworten, mit 503-Retry). Fallback: TokenMix (Text).
// Keine dauerhafte Speicherung. Schlüssel nur aus Umgebungsvariablen.

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const TOKENMIX_KEY = process.env.TOKENMIX_API_KEY || "";
const GEMINI_MODELS = ["gemini-2.5-flash-lite"];

const PROMPT = {
  de: `Du bist Expertin/Experte für deutsche Nebenkosten- und Hausgeldabrechnungen (Valora Property Advisory). Analysiere die bereitgestellte Abrechnung und gib eine klar strukturierte, verständliche Auswertung mit diesen Abschnitten (nutze die Überschriften):
**Überblick** – Art der Abrechnung, Zeitraum, Gesamtbetrag, falls erkennbar.
**Auffällige / möglicherweise nicht umlagefähige Posten** – z. B. Verwaltungskosten, Instandhaltung/Reparaturen, Bankgebühren.
**Plausibilität** – sind die Höhen der Positionen üblich?
**Empfehlungen** – was sollte konkret geprüft oder hinterfragt werden?
Sei sachlich und vorsichtig, weise auf Unsicherheiten hin. KEINE verbindliche Rechtsberatung. Schließe mit einem Satz, dass Valora die Abrechnung gern persönlich und vertieft prüft. Antworte auf Deutsch in kurzen Absätzen. Halte die gesamte Auswertung unter 200 Wörtern.`,
  en: `You are an expert in German service-charge and condominium-fee statements (Valora Property Advisory). Analyse the provided statement and give a clearly structured, understandable assessment with these sections (use the headings):
**Overview** – type of statement, period, total amount if recognisable.
**Conspicuous / possibly non-apportionable items** – e.g. management costs, maintenance/repairs, bank fees.
**Plausibility** – are the amounts of the items usual?
**Recommendations** – what should concretely be checked or questioned?
Be factual and cautious, point out uncertainties. NO binding legal advice. End with a sentence that Valora is happy to review the statement personally and in depth. Answer in English in short paragraphs. Keep the whole assessment under 200 words.`,
  es: `Eres experta/experto en liquidaciones alemanas de gastos y de comunidad (Valora Property Advisory). Analiza la liquidación proporcionada y ofrece una evaluación clara y comprensible con estas secciones (usa los títulos):
**Resumen** – tipo de liquidación, periodo, importe total si es reconocible.
**Partidas llamativas / posiblemente no repercutibles** – p. ej. costes de administración, mantenimiento/reparaciones, comisiones bancarias.
**Plausibilidad** – ¿son habituales los importes de las partidas?
**Recomendaciones** – ¿qué debería comprobarse o cuestionarse concretamente?
Sé objetivo y prudente, señala las incertidumbres. SIN asesoramiento jurídico vinculante. Termina con una frase indicando que Valora con gusto revisa la liquidación de forma personal y en profundidad. Responde en español en párrafos cortos. Mantén toda la evaluación por debajo de 200 palabras.`
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gemini(model, parts, sys) {
  const body = { contents: [{ role: "user", parts }], generationConfig: { maxOutputTokens: 650, temperature: 0.3 } };
  if (sys) body.system_instruction = { parts: [{ text: sys }] };
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + GEMINI_KEY;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 503 || r.status === 429) { lastStatus = r.status; await sleep(500); continue; }
    if (!r.ok) throw new Error("gemini " + r.status);
    const d = await r.json();
    const txt = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts.map(p => p.text).join("");
    if (!txt) throw new Error("gemini empty");
    return txt.trim();
  }
  throw new Error("gemini retries " + lastStatus);
}

async function geminiChain(parts, sys) {
  let err = "";
  for (const m of GEMINI_MODELS) { try { return await gemini(m, parts, sys); } catch (e) { err = String(e.message || e); } }
  throw new Error(err);
}

async function tokenmixText(model, sys, userText) {
  const r = await fetch("https://api.tokenmix.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + TOKENMIX_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: sys }, { role: "user", content: userText }], max_tokens: 1200, temperature: 0.3 })
  });
  if (!r.ok) throw new Error("tokenmix " + r.status);
  const d = await r.json();
  const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!txt) throw new Error("tokenmix empty");
  return txt.trim();
}

exports.handler = async (event) => {
  const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "method" }) };

  let p;
  try { p = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "bad json" }) }; }
  const lang = ["de", "en", "es"].includes(p.lang) ? p.lang : "de";
  const email = (p.email || "").slice(0, 200);
  const sys = PROMPT[lang];
  const text = (p.text || "").slice(0, 12000);
  const fileData = p.fileBase64 || "";
  const mime = p.mimeType || "application/pdf";

  if (!email || email.indexOf("@") < 0) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "email required" }) };
  if (!text && !fileData) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "no input" }) };

  try {
    let result;
    if (fileData) {
      const parts = [{ inline_data: { mime_type: mime, data: fileData } }, { text: "Bitte analysiere das angehängte Dokument gemäß den Vorgaben." }];
      result = await geminiChain(parts, sys);
    } else {
      try { result = await geminiChain([{ text: text }], sys); }
      catch (e1) {
        try { result = await tokenmixText("gemini-2.5-flash", sys, text); }
        catch (e2) { result = await tokenmixText("gemini-2.5-flash-lite", sys, text); }
      }
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ result }) };
  } catch (e) {
    return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "analysis failed", detail: String(e && e.message || e) }) };
  }
};
