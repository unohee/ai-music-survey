/**
 * Cloudflare Worker - Survey Result Collector
 * GitHub 저장소에 결과를 JSON 파일로 저장
 */

const GITHUB_REPO = "unohee/ai-music-survey";
const RESULTS_PATH = "data/results";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://unohee.github.io",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /api/submit - 결과 저장
    if (request.method === "POST" && url.pathname === "/api/submit") {
      try {
        const data = await request.json();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const safeName = data.nickname.replace(/[^a-zA-Z0-9\uAC00-\uD7A3]/g, "_");
        const filename = `${RESULTS_PATH}/${timestamp}_${safeName}.json`;

        const token = env.GITHUB_TOKEN;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`,
          {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "Survey-Worker",
            },
            body: JSON.stringify({
              message: `Add survey result: ${data.nickname}`,
              content: content,
            }),
          }
        );

        if (response.ok) {
          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const error = await response.text();
          return new Response(
            JSON.stringify({ success: false, error }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // GET /api/stats
    if (request.method === "GET" && url.pathname === "/api/stats") {
      try {
        const token = env.GITHUB_TOKEN;
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${RESULTS_PATH}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "User-Agent": "Survey-Worker",
            },
          }
        );

        if (response.ok) {
          const files = await response.json();
          return new Response(
            JSON.stringify({ total_participants: files.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ total_participants: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ total_participants: 0, error: e.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Survey API", { headers: corsHeaders });
  },
};
