// Valora KI-Chatbot – sicherer Proxy mit automatischem Modell-/Anbieter-Wechsel.
// Primär: direktes Google Gemini (volle Antworten, Free-Tier). Fallback: TokenMix.
// Schlüssel ausschließlich aus Umgebungsvariablen.

const TOKENMIX_KEY = process.env.TOKENMIX_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const CHAIN = [
  { type: "gemini",   model: "gemini-2.5-flash-lite" },
  { type: "gemini",   model: "gemini-2.5-flash" },
  { type: "tokenmix", model: "gemini-2.5-flash" },
  { type: "tokenmix", model: "gemini-2.5-flash-lite" }
];

const SYSTEM = {
  de: `Du bist der digitale Assistent von "Valora Property Advisory" (Gründerin: Vivian Möbius). Antworte professionell, freundlich und kompakt (2-4 Sätze), auf Deutsch. Beende deine Antwort immer mit einem vollständigen Satz.
Fakten: Valora ist KEINE klassische Hausverwaltung, sondern die unabhängige Ebene darüber – wir schließen die Lücke zwischen Eigentümer und Verwaltung (Steuern statt Verwalten). Leistungen: strategisches Immobilienmanagement, Eigentümerbegleitung & Potenzialanalyse, Kapitalanlage- & Ferienimmobilien, Immobilienverkauf. Schwerpunkte: Leipzig und Palma de Mallorca, standortunabhängig. Auf Mallorca: feste lokale Ansprechpartner und auf Wunsch Vollservice (Schlüsselverwaltung, Objektkontrolle), auch bei Abwesenheit. Das Erstgespräch ist kostenfrei. Kontakt: info@valora-property.com, Tel. 0172 577 0633.
Regeln: Erfinde KEINE Preise oder konkreten Renditezahlen. Keine Rechts- oder Steuerberatung. Verweise bei konkreten Anliegen auf den kostenlosen Potenzialcheck (/potenzialcheck.html) oder das Kontaktformular.`,
  en: `You are the digital assistant of "Valora Property Advisory" (founder: Vivian Möbius). Answer professionally, warmly and concisely (2-4 sentences), in English. Always end with a complete sentence.
Facts: Valora is NOT a classic property management company but the independent level above it – we close the gap between owner and management (steer, don't just administer). Services: strategic property management, owner advisory & potential analysis, investment & holiday properties, property sales. Focus: Leipzig and Palma de Mallorca, location-independent. On Mallorca: dedicated local contacts and, on request, full service (key holding, property inspections), even in your absence. The initial consultation is free. Contact: info@valora-property.com, phone +49 172 577 0633.
Rules: NEVER invent prices or specific yield figures. No legal or tax advice. For concrete matters, refer to the free Potential Check (/en/potenzialcheck.html) or the contact form.`,
  es: `Eres el asistente digital de "Valora Property Advisory" (fundadora: Vivian Möbius). Responde de forma profesional, cordial y concisa (2-4 frases), en español. Termina siempre con una frase completa.
Datos: Valora NO es una administración de fincas clásica, sino el nivel independiente por encima de ella: cerramos la brecha entre el propietario y la administración (dirigir, no solo administrar). Servicios: gestión inmobiliaria estratégica, acompañamiento al propietario y análisis de potencial, inmuebles de inversión y vacacionales, venta de inmuebles. Enfoque: Leipzig y Palma de Mallorca, independiente de la ubicación. En Mallorca: contactos locales fijos y, si se desea, servicio integral (gestión de llaves, inspección del inmueble), incluso en su ausencia. La primera consulta es gratuita. Contacto: info@valora-property.com, tel. +49 172 577 0633.
Reglas: NUNCA inventes precios ni cifras de rentabilidad. Sin asesoramiento jurídico ni fiscal. Para asuntos concretos, remite al chequeo de potencial gratuito (/es/potenzialcheck.html) o al formulario de contacto.`
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callGemini(model, messages) {
  const sys = messages.find(m => m.role === "system");
  const contents = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const body = { contents, generationConfig: { maxOutputTokens: 500, temperature: 0.4 } };
  if (sys) body.system_instruction = { parts: [{ text: sys.content }] };
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + GEMINI_KEY;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 503 || r.status === 429) { lastStatus = r.status; await sleep(700 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error("gemini " + r.status);
    const d = await r.json();
    const txt = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts.map(p => p.text).join("");
    if (!txt) throw new Error("gemini empty");
    return txt.trim();
  }
  throw new Error("gemini retries " + lastStatus);
}

async function callTokenmix(model, messages) {
  const r = await fetch("https://api.tokenmix.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + TOKENMIX_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: 500, temperature: 0.4 })
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

  let payload;
  try { payload = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "bad json" }) }; }

  const lang = ["de", "en", "es"].includes(payload.lang) ? payload.lang : "de";
  let history = Array.isArray(payload.messages) ? payload.messages : [];
  history = history
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "no message" }) };

  const messages = [{ role: "system", content: SYSTEM[lang] }, ...history];

  let lastErr = "";
  for (const step of CHAIN) {
    try {
      if (step.type === "tokenmix" && !TOKENMIX_KEY) continue;
      if (step.type === "gemini" && !GEMINI_KEY) continue;
      const reply = step.type === "tokenmix" ? await callTokenmix(step.model, messages) : await callGemini(step.model, messages);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ reply, via: step.type + ":" + step.model }) };
    } catch (e) { lastErr = String(e && e.message || e); }
  }
  return { statusCode: 503, headers: cors, body: JSON.stringify({ error: "all providers failed", detail: lastErr }) };
};
