/**
 * Jarvis-motor — Cloudflare Worker
 * Holder ANTHROPIC_API_KEY trygt og er "hjernen" bak chat-agenten i dashbordet.
 *
 * Arkitektur: workeren er STATELØS. Nettleseren eier dataene (localStorage) og
 * sender gjeldende tilstand + melding hit. Workeren spør Claude (med verktøy),
 * og returnerer { reply, actions }. Nettleseren utfører actions og lagrer selv.
 *
 * Hemmeligheter settes med:  npx wrangler secret put ANTHROPIC_API_KEY
 */

const MODEL = "claude-haiku-4-5-20251001"; // rask + billig; bytt til sonnet for mer kraft

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const TOOLS = [
  { name: "add_task", description: "Legg til et gjøremål på dashbordet.",
    input_schema: { type: "object", properties: { text: { type: "string", description: "Gjøremålet" } }, required: ["text"] } },
  { name: "complete_task", description: "Marker et gjøremål som fullført (match på tekst).",
    input_schema: { type: "object", properties: { match: { type: "string" } }, required: ["match"] } },
  { name: "delete_task", description: "Slett et gjøremål (match på tekst).",
    input_schema: { type: "object", properties: { match: { type: "string" } }, required: ["match"] } },
  { name: "add_event", description: "Legg til en kalenderhendelse.",
    input_schema: { type: "object", properties: {
      date: { type: "string", description: "Dato ÅÅÅÅ-MM-DD" },
      time: { type: "string", description: "Klokkeslett TT:MM, valgfritt" },
      text: { type: "string" } }, required: ["date", "text"] } },
  { name: "add_milestone", description: "Legg til en milepæl med nedtelling.",
    input_schema: { type: "object", properties: {
      name: { type: "string" }, date: { type: "string", description: "Måldato ÅÅÅÅ-MM-DD" } }, required: ["name", "date"] } },
  { name: "add_project", description: "Legg til et prosjekt.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
];

function systemPrompt(state) {
  return `Du er Jarvis — Marcus' personlige assistent inne i dashbord-appen hans. Du er en intelligent, kortfattet tankepartner som hjelper ham å holde oversikt over dagen. Svar alltid på norsk, vennlig og konkret. Ingen emojier med mindre han bruker dem.

I dag er ${state.today} (${state.weekday}). Bruk dette til å regne ut relative datoer ("i morgen", "torsdag", "neste uke").

Gjeldende tilstand på dashbordet:
- Gjøremål: ${JSON.stringify(state.todos || [])}
- Dagens hendelser: ${JSON.stringify(state.todayEvents || [])}
- Milepæler: ${JSON.stringify(state.milestones || [])}
- Prosjekter: ${JSON.stringify((state.projects || []).map(p => p.name))}

Når Marcus ber deg legge til, fullføre eller endre noe — bruk verktøyene. Du kan gjøre flere ting i én melding. Etter at du har brukt verktøy, gi en kort, naturlig bekreftelse på hva du gjorde. Hvis han bare spør eller prater, svar uten å bruke verktøy.`;
}

async function callClaude(body, apiKey) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Anthropic " + r.status + ": " + (await r.text()));
  return r.json();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (url.pathname !== "/chat" || request.method !== "POST")
      return new Response("Jarvis-motor kjører. POST til /chat.", { headers: CORS });

    try {
      const { messages = [], state = {} } = await request.json();
      const system = systemPrompt(state);
      const actions = [];
      let convo = messages.slice(-20); // hold konteksten lett

      // tool-loop: kjør til modellen er ferdig
      for (let i = 0; i < 6; i++) {
        const res = await callClaude(
          { model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages: convo },
          env.ANTHROPIC_API_KEY
        );
        convo.push({ role: "assistant", content: res.content });

        if (res.stop_reason === "tool_use") {
          const results = [];
          for (const block of res.content) {
            if (block.type === "tool_use") {
              actions.push({ type: block.name, ...block.input });
              results.push({ type: "tool_result", tool_use_id: block.id, content: "ok" });
            }
          }
          convo.push({ role: "user", content: results });
          continue;
        }
        // ferdig — hent ut tekst
        const reply = res.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
        return new Response(JSON.stringify({ reply: reply || "Gjort.", actions }), {
          headers: { ...CORS, "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ reply: "Beklager, det ble for mange steg.", actions }), {
        headers: { ...CORS, "content-type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ reply: "Feil i motoren: " + e.message, actions: [] }), {
        status: 500, headers: { ...CORS, "content-type": "application/json" },
      });
    }
  },
};
