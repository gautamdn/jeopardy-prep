/**
 * Seed script: Import jwolle1/jeopardy_clue_dataset into Supabase
 *
 * Usage:
 *   npx tsx scripts/seed-questions.ts
 *
 * Required env vars:
 *   SUPABASE_URL            - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (not the anon key)
 *
 * The script downloads the TSV from GitHub, parses it, and batch-inserts
 * rows into the "questions" table.
 *
 * TSV source: https://github.com/jwolle1/jeopardy_clue_dataset
 * Columns in the dataset:
 *   round | clue_value | daily_double_value | category | comments | answer | question | air_date | notes
 *
 * NOTE on Jeopardy terminology in the dataset:
 *   - "answer" in the TSV = the clue text shown to contestants
 *   - "question" in the TSV = the correct response ("What is ...?")
 *
 * If the download URL is wrong (file was renamed), update TSV_URL below.
 */

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TSV_URL =
  "https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/main/combined_season1-40.tsv";

const BATCH_SIZE = 1000;

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionRow {
  category: string;
  difficulty: number;
  clue: string;
  answer: string;
  source: "jarchive";
  verified: true;
  air_date: string | null;
  round: "jeopardy" | "double_jeopardy" | "final_jeopardy" | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

/** Map the TSV `round` column (numeric) to our enum */
function mapRound(
  raw: string
): "jeopardy" | "double_jeopardy" | "final_jeopardy" | null {
  switch (raw.trim()) {
    case "1":
      return "jeopardy";
    case "2":
      return "double_jeopardy";
    case "3":
      return "final_jeopardy";
    default:
      return null;
  }
}

/**
 * Normalise the clue value to one of the standard difficulty tiers.
 * Daily Doubles and older seasons may have non-standard values;
 * we round to the nearest tier.
 */
function normaliseDifficulty(raw: string): number {
  const val = parseInt(raw, 10);
  if (isNaN(val) || val <= 0) return 200; // default lowest tier
  const tiers = [200, 400, 600, 800, 1000];
  let closest = tiers[0];
  for (const t of tiers) {
    if (Math.abs(t - val) < Math.abs(closest - val)) {
      closest = t;
    }
  }
  return closest;
}

/** Parse a TSV string into an array of string arrays (handling quoted fields) */
function parseTsv(tsv: string): string[][] {
  const lines = tsv.split("\n");
  return lines.map((line) => line.split("\t"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Downloading TSV from GitHub...");

  const response = await fetch(TSV_URL);
  if (!response.ok) {
    // Try alternate filenames if the primary URL fails
    const alternateUrls = [
      "https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/main/combined.tsv",
      "https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/master/combined_season1-40.tsv",
      "https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/master/combined.tsv",
    ];
    let altResponse: Response | null = null;
    for (const url of alternateUrls) {
      console.log(`Primary URL failed (${response.status}). Trying ${url}...`);
      const r = await fetch(url);
      if (r.ok) {
        altResponse = r;
        break;
      }
    }
    if (!altResponse) {
      console.error(
        "Could not download TSV from any known URL. Please update TSV_URL in the script."
      );
      process.exit(1);
    }
    var tsvText = await altResponse.text();
  } else {
    var tsvText = await response.text();
  }

  console.log(`Downloaded ${(tsvText.length / 1024 / 1024).toFixed(1)} MB`);

  // Parse TSV
  const rows = parseTsv(tsvText);
  if (rows.length < 2) {
    console.error("TSV appears to be empty.");
    process.exit(1);
  }

  // Extract headers and normalise them
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  console.log(`TSV headers: ${headers.join(", ")}`);

  // Build a column index map
  const colIndex = (name: string): number => {
    const idx = headers.indexOf(name);
    if (idx === -1) {
      // Try partial match
      const partial = headers.findIndex((h) => h.includes(name));
      return partial;
    }
    return idx;
  };

  const iRound = colIndex("round");
  const iClueValue = colIndex("clue_value");
  const iCategory = colIndex("category");
  const iAnswer = colIndex("answer"); // TSV "answer" = clue text shown to contestants
  const iQuestion = colIndex("question"); // TSV "question" = correct response
  const iAirDate = colIndex("air_date");

  console.log(
    `Column indices: round=${iRound}, clue_value=${iClueValue}, category=${iCategory}, answer(clue)=${iAnswer}, question(response)=${iQuestion}, air_date=${iAirDate}`
  );

  // Validate we found the critical columns
  if (iCategory === -1 || iAnswer === -1 || iQuestion === -1) {
    console.error(
      "Could not find required columns (category, answer, question) in the TSV headers."
    );
    console.error("Headers found:", headers);
    process.exit(1);
  }

  // Map rows to database records, skipping header row
  const dataRows = rows.slice(1);
  const records: QuestionRow[] = [];
  let skipped = 0;

  for (const cols of dataRows) {
    // Skip incomplete rows
    if (cols.length < Math.max(iCategory, iAnswer, iQuestion) + 1) {
      skipped++;
      continue;
    }

    const clueText = stripHtml(cols[iAnswer] ?? "");
    const answerText = stripHtml(cols[iQuestion] ?? "");
    const category = (cols[iCategory] ?? "").trim();

    // Skip rows with empty clue or answer
    if (!clueText || !answerText || !category) {
      skipped++;
      continue;
    }

    const rawAirDate = iAirDate !== -1 ? (cols[iAirDate] ?? "").trim() : "";
    const airDate = rawAirDate && /^\d{4}-\d{2}-\d{2}$/.test(rawAirDate) ? rawAirDate : null;

    const rawRound = iRound !== -1 ? (cols[iRound] ?? "").trim() : "";
    const round = mapRound(rawRound);

    const rawValue = iClueValue !== -1 ? (cols[iClueValue] ?? "").trim() : "";
    const difficulty = normaliseDifficulty(rawValue);

    records.push({
      category,
      difficulty,
      clue: clueText,
      answer: answerText,
      source: "jarchive",
      verified: true,
      air_date: airDate,
      round,
    });
  }

  console.log(
    `Parsed ${records.length} valid records (${skipped} rows skipped)`
  );

  if (records.length === 0) {
    console.error("No valid records to insert.");
    process.exit(1);
  }

  // Insert in batches
  let inserted = 0;
  let errors = 0;
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await supabase.from("questions").insert(batch);

    if (error) {
      console.error(
        `Batch ${batchNum}/${totalBatches} failed: ${error.message}`
      );
      errors++;
    } else {
      inserted += batch.length;
      console.log(
        `Batch ${batchNum}/${totalBatches}: inserted ${batch.length} rows (total: ${inserted})`
      );
    }
  }

  console.log("\n--- Done ---");
  console.log(`Total inserted: ${inserted}`);
  console.log(`Total skipped:  ${skipped}`);
  console.log(`Failed batches: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
