/* Valora KI-Chat-Widget – selbstständig, mehrsprachig (DE/EN/ES). */
(function () {
  "use strict";
  if (window.__valoraChat) return; window.__valoraChat = true;

  var lang = (document.documentElement.lang || "de").slice(0, 2);
  if (["de", "en", "es"].indexOf(lang) < 0) lang = "de";

  var T = {
    de: { btn: "Fragen?", title: "Valora Assistent", sub: "KI-Assistent · meist sofort", greet: "Hallo! Ich beantworte gern Ihre Fragen zu Valora, Immobilienmanagement, Leipzig oder Mallorca. Wie kann ich helfen?", ph: "Ihre Frage …", send: "Senden", err: "Entschuldigung, es gab ein Problem. Bitte versuchen Sie es erneut oder schreiben Sie an info@valora-property.com.", dis: "KI-Assistent – keine Rechts-/Steuerberatung." },
    en: { btn: "Questions?", title: "Valora Assistant", sub: "AI assistant · usually instant", greet: "Hello! I'm happy to answer your questions about Valora, property management, Leipzig or Mallorca. How can I help?", ph: "Your question …", send: "Send", err: "Sorry, something went wrong. Please try again or email info@valora-property.com.", dis: "AI assistant – no legal/tax advice." },
    es: { btn: "¿Preguntas?", title: "Asistente Valora", sub: "Asistente IA · normalmente al instante", greet: "¡Hola! Con gusto respondo sus preguntas sobre Valora, gestión inmobiliaria, Leipzig o Mallorca. ¿Cómo puedo ayudar?", ph: "Su pregunta …", send: "Enviar", err: "Lo sentimos, hubo un problema. Inténtelo de nuevo o escriba a info@valora-property.com.", dis: "Asistente IA – sin asesoramiento jurídico/fiscal." }
  }[lang];

  var GOLD = "#ceb068";
  var css = "\
.vc-btn{position:fixed;right:22px;bottom:22px;z-index:4000;display:flex;align-items:center;gap:9px;background:#0d0d0d;color:" + GOLD + ";border:1px solid " + GOLD + ";border-radius:40px;padding:13px 20px;font-family:'Inter',sans-serif;font-size:13px;letter-spacing:.04em;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.45);transition:transform .2s,background .2s}\
.vc-btn:hover{transform:translateY(-2px);background:#141414}\
.vc-btn svg{width:18px;height:18px}\
.vc-panel{position:fixed;right:22px;bottom:22px;z-index:4001;width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 40px);background:#0d0d0d;border:1px solid rgba(206,176,104,.3);border-radius:14px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:'Inter',sans-serif}\
.vc-panel.open{display:flex;animation:vcIn .28s ease}\
@keyframes vcIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}\
.vc-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(206,176,104,.18);background:#0a0a0a}\
.vc-mark{width:34px;height:34px;border:1px solid " + GOLD + ";border-radius:50%;display:flex;align-items:center;justify-content:center;color:" + GOLD + ";font-family:'Cormorant Garamond',serif;font-size:18px;flex:0 0 auto}\
.vc-head h4{margin:0;color:#fff;font-size:14px;font-weight:500}\
.vc-head p{margin:2px 0 0;color:#8a8a8a;font-size:11px}\
.vc-x{margin-left:auto;background:none;border:none;color:#888;font-size:22px;cursor:pointer;line-height:1}\
.vc-x:hover{color:" + GOLD + "}\
.vc-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px}\
.vc-m{max-width:84%;padding:11px 14px;border-radius:12px;font-size:13.5px;line-height:1.6}\
.vc-bot{align-self:flex-start;background:#1a1a1a;color:#e7e7e7;border:1px solid rgba(255,255,255,.06)}\
.vc-user{align-self:flex-end;background:rgba(206,176,104,.14);color:#fff;border:1px solid rgba(206,176,104,.3)}\
.vc-typing{align-self:flex-start;color:#888;font-size:13px;padding:4px 6px}\
.vc-foot{border-top:1px solid rgba(206,176,104,.18);padding:12px}\
.vc-row{display:flex;gap:8px}\
.vc-in{flex:1;background:#000;border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:8px;padding:11px 12px;font-family:'Inter',sans-serif;font-size:13.5px;resize:none;max-height:90px}\
.vc-in:focus{outline:none;border-color:" + GOLD + "}\
.vc-go{background:" + GOLD + ";color:#0a0a0a;border:none;border-radius:8px;padding:0 16px;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer}\
.vc-go:disabled{opacity:.5;cursor:default}\
.vc-dis{margin:8px 2px 0;color:#5a5a5a;font-size:10px;text-align:center}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement("button");
  btn.className = "vc-btn"; btn.setAttribute("aria-label", T.title);
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.1-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg><span>' + T.btn + "</span>";
  document.body.appendChild(btn);

  var panel = document.createElement("div");
  panel.className = "vc-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", T.title);
  panel.innerHTML =
    '<div class="vc-head"><div class="vc-mark">V</div><div><h4>' + T.title + '</h4><p>' + T.sub + '</p></div><button class="vc-x" aria-label="Schließen">&times;</button></div>' +
    '<div class="vc-msgs" id="vcMsgs"></div>' +
    '<div class="vc-foot"><div class="vc-row"><textarea class="vc-in" id="vcIn" rows="1" placeholder="' + T.ph + '"></textarea><button class="vc-go" id="vcGo">' + T.send + '</button></div><p class="vc-dis">' + T.dis + '</p></div>';
  document.body.appendChild(panel);

  var msgsEl = panel.querySelector("#vcMsgs");
  var inEl = panel.querySelector("#vcIn");
  var goEl = panel.querySelector("#vcGo");
  var history = [];
  var greeted = false;

  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
  function add(role, text) {
    var m = document.createElement("div");
    m.className = "vc-m " + (role === "user" ? "vc-user" : "vc-bot");
    m.innerHTML = esc(text).replace(/\n/g, "<br>");
    msgsEl.appendChild(m); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function open() {
    panel.classList.add("open"); btn.style.display = "none";
    if (!greeted) { greeted = true; add("bot", T.greet); }
    setTimeout(function(){ inEl.focus(); }, 100);
  }
  function close() { panel.classList.remove("open"); btn.style.display = "flex"; }

  btn.addEventListener("click", open);
  panel.querySelector(".vc-x").addEventListener("click", close);
  inEl.addEventListener("input", function(){ inEl.style.height="auto"; inEl.style.height=Math.min(inEl.scrollHeight,90)+"px"; });
  inEl.addEventListener("keydown", function(e){ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  goEl.addEventListener("click", send);

  async function send() {
    var text = inEl.value.trim(); if (!text) return;
    inEl.value = ""; inEl.style.height = "auto"; goEl.disabled = true;
    add("user", text); history.push({ role: "user", content: text });
    var typing = document.createElement("div"); typing.className = "vc-typing"; typing.textContent = "•••"; msgsEl.appendChild(typing); msgsEl.scrollTop = msgsEl.scrollHeight;
    var d = null;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var r = await fetch("/.netlify/functions/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: lang, messages: history }) });
        d = await r.json();
        if (d && d.reply) break;
      } catch (e) { d = null; }
      if (attempt === 0) await new Promise(function (res) { setTimeout(res, 1500); });
    }
    typing.remove();
    if (d && d.reply) { add("bot", d.reply); history.push({ role: "assistant", content: d.reply }); }
    else { add("bot", T.err); }
    goEl.disabled = false; inEl.focus();
  }
})();
