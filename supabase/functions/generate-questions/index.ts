import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { category, difficulty, count } = await req.json();

    if (!category || !difficulty || !count) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: category, difficulty, count" }),
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

    const difficultyLabel =
      difficulty <= 200
        ? "very easy"
        : difficulty <= 400
          ? "easy"
          : difficulty <= 600
            ? "moderate"
            : difficulty <= 800
              ? "hard"
              : "very hard";

    const prompt = `Generate exactly ${count} Jeopardy-style clues for the category "${category}" at ${difficultyLabel} difficulty (value: $${difficulty}).

In Jeopardy, the host reads a clue (a declarative statement) and contestants must respond in the form of a question, e.g. "What is ...?" or "Who is ...?".

Requirements:
- Each clue should be an authentic Jeopardy-style statement, not a question
- The answer must be in "What is...?" or "Who is...?" form as appropriate
- Clues should be factually accurate
- Difficulty should match the ${difficultyLabel} level — ${difficultyLabel === "very easy" ? "common knowledge" : difficultyLabel === "easy" ? "straightforward facts" : difficultyLabel === "moderate" ? "requires solid general knowledge" : difficultyLabel === "hard" ? "requires specialized knowledge" : "expert-level, obscure facts"}

Return ONLY a JSON array with no other text. Each element must have these fields:
- "clue": the Jeopardy clue statement
- "answer": the correct response in "What is...?" / "Who is...?" form
- "category": "${category}"
- "difficulty": ${difficulty}`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
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

    // Extract JSON array from the response (handle potential markdown fences)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to parse questions from Claude response");
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Insert into Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rows = questions.map((q: { clue: string; answer: string; category: string; difficulty: number }) => ({
      clue: q.clue,
      answer: q.answer,
      category: q.category,
      difficulty: q.difficulty,
      source: "claude",
      verified: false,
    }));

    const { data: insertedData, error: dbError } = await supabase
      .from("questions")
      .insert(rows)
      .select();

    if (dbError) {
      throw new Error(`Database insert error: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ questions: insertedData ?? questions }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
