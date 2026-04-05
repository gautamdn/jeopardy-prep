const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { correct_answer, user_answer, clue } = await req.json();

    if (!correct_answer || !user_answer || !clue) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: correct_answer, user_answer, clue",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const prompt = `Given this Jeopardy clue and the correct answer, evaluate the user's response. Return JSON: { "verdict": "correct" | "partial" | "incorrect", "explanation": string }

Clue: "${clue}"
Correct answer: "${correct_answer}"
User's answer: "${user_answer}"

Rules for evaluation:
- "correct": The user's answer matches the correct answer in meaning, even if phrased differently or missing the "What is" prefix.
- "partial": The user's answer is close but not fully correct (e.g. got part of a multi-part answer, or a closely related but not exact answer).
- "incorrect": The user's answer is wrong.

Return ONLY the JSON object, no other text.`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorBody = await claudeResponse.text();
      throw new Error(`Claude API error (${claudeResponse.status}): ${errorBody}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text;

    // Extract JSON object from response (handle potential markdown fences)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse evaluation from Claude response");
    }

    const evaluation = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(evaluation), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
