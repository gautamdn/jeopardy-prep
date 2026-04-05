# Jeopardy Prep v2 — Lovable Build Prompt

Build a full-stack Jeopardy practice app called **Jeopardy Prep** using React and Supabase. The app has two practice modes (Game and Drill), multi-user authentication, a question bank of 538K+ real Jeopardy clues stored in Supabase, hybrid answer evaluation (local keyword matching + Claude AI for borderline answers), and a stats dashboard. Below is every detail you need.

---

## 1. Supabase Setup

### Authentication

Enable Supabase Auth with two providers:

- **Email/password** signup and login
- **Google OAuth**

On first login, create a row in the `profiles` table for the user (use a database trigger on `auth.users` insert, or handle it in app logic after signup).

### Database Tables

Create these tables in Supabase with the exact schemas below.

#### `profiles`

| Column                | Type          | Constraints / Default              |
|-----------------------|---------------|-------------------------------------|
| id                    | uuid          | PK, FK to auth.users.id            |
| display_name          | text          |                                     |
| preferred_categories  | text[]        |                                     |
| daily_goal            | integer       | default 20                          |
| created_at            | timestamptz   | default now()                       |

#### `questions`

| Column      | Type          | Constraints / Default                                      |
|-------------|---------------|-------------------------------------------------------------|
| id          | uuid          | PK, default gen_random_uuid()                               |
| category    | text          | NOT NULL, indexed                                           |
| difficulty  | integer       | NOT NULL (values: 200, 400, 600, 800, 1000)                |
| clue        | text          | NOT NULL                                                    |
| answer      | text          | NOT NULL                                                    |
| source      | text          | NOT NULL ('jarchive' or 'claude')                           |
| verified    | boolean       | default true for jarchive, false for claude                 |
| air_date    | date          | nullable                                                    |
| round       | text          | nullable ('jeopardy', 'double_jeopardy', 'final_jeopardy') |
| created_at  | timestamptz   | default now()                                               |

Create indexes on `category` and `difficulty` columns for fast querying.

#### `game_sessions`

| Column          | Type          | Constraints / Default              |
|-----------------|---------------|-------------------------------------|
| id              | uuid          | PK, default gen_random_uuid()      |
| user_id         | uuid          | FK to auth.users.id, NOT NULL      |
| mode            | text          | NOT NULL ('game' or 'drill')       |
| score           | integer       |                                     |
| total_possible  | integer       |                                     |
| started_at      | timestamptz   | default now()                       |
| completed_at    | timestamptz   | nullable                            |

#### `game_answers`

| Column              | Type          | Constraints / Default              |
|----------------------|---------------|-------------------------------------|
| id                   | uuid          | PK, default gen_random_uuid()      |
| session_id           | uuid          | FK to game_sessions.id, NOT NULL   |
| question_id          | uuid          | FK to questions.id, NOT NULL       |
| user_answer          | text          |                                     |
| is_correct           | boolean       |                                     |
| is_partial           | boolean       | default false                       |
| points_earned        | integer       |                                     |
| evaluation_method    | text          | 'local' or 'claude'                |
| answered_at          | timestamptz   | default now()                       |
| next_review_at       | timestamptz   | nullable                            |

The `next_review_at` field is used for spaced repetition in drill mode. When a user gets a question wrong or partially correct, set this field to schedule the question for review (1 day, then 3 days, then 7 days after the answer).

#### `category_stats`

| Column          | Type          | Constraints / Default                      |
|-----------------|---------------|--------------------------------------------|
| id              | uuid          | PK, default gen_random_uuid()              |
| user_id         | uuid          | FK to auth.users.id, NOT NULL              |
| category        | text          | NOT NULL                                   |
| total_attempts  | integer       | default 0                                  |
| correct_count   | integer       | default 0                                  |
| last_attempted  | timestamptz   |                                             |

Add a UNIQUE constraint on `(user_id, category)`.

### Row Level Security (RLS)

Enable RLS on all tables. Create these policies:

- **profiles**: Users can SELECT, INSERT, and UPDATE only their own row (`id = auth.uid()`).
- **questions**: All authenticated users can SELECT. Only service_role (Edge Functions) can INSERT.
- **game_sessions**: Users can SELECT, INSERT, and UPDATE only their own rows (`user_id = auth.uid()`).
- **game_answers**: Users can SELECT and INSERT only rows belonging to their own sessions (join through `game_sessions` where `user_id = auth.uid()`).
- **category_stats**: Users can SELECT, INSERT, and UPDATE only their own rows (`user_id = auth.uid()`).

---

## 2. Pages and Routing

Use React Router. Protect all routes except Login/Signup behind authentication (redirect unauthenticated users to login).

### 2a. Login / Signup Page (`/login`)

- Use Supabase Auth UI components for email/password and Google OAuth.
- After successful auth, redirect to the Home page.
- Clean, centered card layout.

### 2b. Home Page (`/`)

- **Welcome message** showing the user's display name.
- **Two large cards** side by side:
  - "Play Game" — navigates to `/game`
  - "Practice Drill" — navigates to `/drill`
- **Quick stats section** below the cards showing:
  - Total games played (count of `game_sessions` for this user)
  - Overall accuracy (sum of `correct_count` / sum of `total_attempts` from `category_stats`)
  - Questions answered today

### 2c. Game Board Page (`/game`)

This is the core Jeopardy simulation. Build it exactly as described below.

**Board Layout:**
- A 6-column by 5-row grid.
- Each column represents a category. Show the category name as a header above each column.
- Each row represents a difficulty level: $200, $400, $600, $800, $1000 (top to bottom).
- Each cell shows the dollar value. Cells are clickable.
- After a cell is answered, it greys out and becomes unclickable.

**Loading the Board:**
- When the page mounts, query the `questions` table for 6 random distinct categories. For each category, fetch 5 questions (one per difficulty level: 200, 400, 600, 800, 1000). This gives 30 total questions.
- Use a query like: select 6 random categories from `SELECT DISTINCT category FROM questions ORDER BY random() LIMIT 6`, then for each category select one question per difficulty.

**Daily Double:**
- Randomly pick 1 of the 30 cells to be the Daily Double.
- When the user clicks a Daily Double cell, show a **wager input** before revealing the clue.
- Wager rules: minimum $5, maximum is the user's current score or $1000 (whichever is greater). If the user's score is $0 or negative, the max wager is $1000.

**Clue Modal:**
- When the user clicks a cell, open a modal overlay.
- Show the clue text prominently.
- Show an answer input field with placeholder "What is..."
- Show a Submit button.
- After submission, show whether the answer was correct, incorrect, or partially correct, and update the score.
- Show a "Continue" button to close the modal and return to the board.

**Score Bar:**
- A persistent bar at the top of the board showing the current score (e.g., "Score: $2,400").
- Also show how many clues remain (e.g., "18/30 remaining").

**Final Jeopardy:**
- Trigger Final Jeopardy when all 30 cells are answered OR when the user clicks an "End Round" button.
- Show a single Final Jeopardy category (query one question with `round = 'final_jeopardy'` from the questions table).
- Show a wager input first (min $0, max is current score; if score is $0 or negative, skip Final Jeopardy).
- Then reveal the clue. User answers. Evaluate.
- After Final Jeopardy, show the **Game Summary**.

**Game Summary Modal:**
- Total score
- Accuracy percentage (correct / total answered)
- Category breakdown: for each of the 6 categories, show correct/total and accuracy %
- "Play Again" button (starts a new game)
- "Back to Home" button

**Saving the Session:**
- When the game ends, insert a row into `game_sessions` with mode='game', score, total_possible (sum of all clue values + any wagers), started_at, completed_at.
- Insert a row into `game_answers` for each answered clue.
- Upsert `category_stats` for each category played: increment `total_attempts` and `correct_count` accordingly.

### 2d. Drill Mode Page (`/drill`)

**Initial Selection:**
- Show two options: "Pick Category" (dropdown of available categories) and "Surprise Me" (system picks based on weak areas).
- If "Surprise Me": query `category_stats` for this user, find categories where `correct_count / total_attempts < 0.6` (less than 60% accuracy), and randomly pick from those. If no weak categories exist, pick any random category.

**Clue Card:**
- Single card centered on screen.
- Shows the category name and difficulty level at the top of the card.
- Shows the clue text.
- Answer input field below.
- Submit button.

**After Submission:**
- Show whether the answer was correct, incorrect, or partially correct.
- If Claude evaluation was used, show the explanation text.
- Show the correct answer.
- Show a "Next Question" button.

**Spaced Repetition:**
- Before fetching a new random question, first check `game_answers` for this user where `next_review_at <= now()`. If any exist, serve that question instead.
- When a user gets a question wrong or partially correct in drill mode, set `next_review_at` on the `game_answers` row:
  - First miss: `now() + 1 day`
  - Second miss (already has a `next_review_at`): `now() + 3 days`
  - Third miss: `now() + 7 days`

**Question Generation Fallback:**
- If the selected category has fewer than 5 available questions in the bank (that the user hasn't already answered recently), call the `generate-questions` Edge Function to get more.

**Running Stats:**
- Show at the top of the drill page: questions answered this session, accuracy this session (e.g., "12/15 correct — 80%").

**Saving:**
- Create a `game_sessions` row with mode='drill' when the drill starts. Update it as the user answers questions.
- Insert `game_answers` rows for each answer.
- Upsert `category_stats` after each answer.
- When the user clicks "End Drill" or navigates away, set `completed_at` on the session.

### 2e. Stats Dashboard Page (`/stats`)

- **Accuracy by Category**: A horizontal bar chart showing accuracy % for the user's top 15-20 most-played categories. Use a charting library (Recharts is a good choice). Color-code bars: green for > 70%, yellow for 40-70%, red for < 40%.
- **Weakest Categories**: A highlighted section listing the 5 categories with the lowest accuracy (min 5 attempts). Show category name, accuracy %, and total attempts.
- **Recent Sessions**: A table/list of the last 10 game sessions showing: date, mode (Game/Drill), score, accuracy %, and number of questions.
- **Improvement Over Time**: A line chart showing accuracy % by week over the last 3 months. X-axis = week, Y-axis = accuracy %. Use data from `game_answers` grouped by week.

Add a link to the Stats page in a top navigation bar that is visible on all authenticated pages.

---

## 3. Answer Evaluation Logic

Implement this as a utility function used by both Game and Drill modes.

### Step 1: Normalize

Write a `normalizeAnswer(answer: string): string` function:
1. Convert to lowercase.
2. Strip leading phrases: "what is", "what are", "who is", "who are", "where is", "where are" (case-insensitive).
3. Remove all punctuation (periods, commas, quotes, etc.).
4. Trim whitespace.

### Step 2: Extract Keywords

Write an `extractKeywords(normalized: string): string[]` function:
1. Split by whitespace.
2. Filter out words shorter than 3 characters.
3. Filter out common stop words: "the", "and", "for", "that", "this", "with", "from", "have", "has", "was", "were", "are", "been".

### Step 3: Compare

Write a `compareAnswers(correctAnswer: string, userAnswer: string): number` function:
1. Normalize both answers.
2. Extract keywords from both.
3. Count how many of the correct answer's keywords appear in the user answer's keywords.
4. Return the match percentage: `matchedKeywords / correctKeywords.length * 100`.

### Step 4: Evaluate

Write an `evaluateAnswer(correctAnswer: string, userAnswer: string, clue: string, clueValue: number)` function:
1. Call `compareAnswers`. Get the match percentage.
2. If **match >= 80%**: return `{ verdict: 'correct', points: clueValue, explanation: null, method: 'local' }`.
3. If **match === 0%**: return `{ verdict: 'incorrect', points: -clueValue, explanation: null, method: 'local' }`.
4. If **match is 1-79%**: call the `evaluate-answer` Supabase Edge Function (see below). Based on Claude's response:
   - `'correct'` -> points = +clueValue
   - `'partial'` -> points = +Math.round(clueValue / 2)
   - `'incorrect'` -> points = -clueValue
   - Return `{ verdict, points, explanation: claude_explanation, method: 'claude' }`.
5. If the Edge Function call fails (timeout, error), fall back to the local result: treat < 50% as incorrect, >= 50% as partial.

---

## 4. Supabase Edge Functions

Create two Edge Functions. These will be called from the React frontend using `supabase.functions.invoke()`.

### 4a. `evaluate-answer`

**HTTP Method:** POST

**Request body:**
```json
{
  "correct_answer": "string",
  "user_answer": "string",
  "clue": "string"
}
```

**Logic:**
1. Call the Claude API (Anthropic REST API) using model `claude-haiku-4-5`.
2. System prompt: `"You are a Jeopardy answer evaluator. Given a Jeopardy clue and the correct answer, evaluate whether the user's response is correct, partially correct, or incorrect. Be lenient with minor spelling errors, acceptable alternate names, and partial information. Return JSON only."`
3. User prompt: `"Clue: {clue}\nCorrect answer: {correct_answer}\nUser's answer: {user_answer}\n\nEvaluate the user's answer. Return JSON: { \"verdict\": \"correct\" | \"partial\" | \"incorrect\", \"explanation\": \"brief explanation\" }"`
4. Parse Claude's JSON response.

**Response body:**
```json
{
  "verdict": "correct" | "partial" | "incorrect",
  "explanation": "string"
}
```

**Environment variable:** Store the Anthropic API key as `ANTHROPIC_API_KEY` in Supabase Edge Function secrets.

### 4b. `generate-questions`

**HTTP Method:** POST

**Request body:**
```json
{
  "category": "string",
  "difficulty": 200 | 400 | 600 | 800 | 1000,
  "count": 5
}
```

**Logic:**
1. Call the Claude API using model `claude-sonnet-4-6`.
2. System prompt: `"You are a Jeopardy question writer. Generate authentic Jeopardy-style clues. Each clue should be a statement/description (not a question), and the correct response should be in 'What is...?' format. Match the difficulty level to real Jeopardy: $200 clues are straightforward, $1000 clues are challenging. Return JSON only."`
3. User prompt: `"Generate {count} Jeopardy clues for the category \"{category}\" at difficulty ${difficulty}. Return a JSON array: [{ \"clue\": \"string\", \"answer\": \"string\" }, ...]"`
4. Parse Claude's JSON response.
5. Insert the generated questions into the `questions` table with `source = 'claude'` and `verified = false`.
6. Return the generated questions to the client.

**Response body:**
```json
{
  "questions": [
    { "id": "uuid", "clue": "string", "answer": "string", "category": "string", "difficulty": 200 }
  ]
}
```

---

## 5. Styling and Design

### Color Palette

- **Primary (Jeopardy Blue):** `#060CE9`
- **Primary Light:** `#1a1fff` (hover states)
- **Primary Dark:** `#04099e` (active states)
- **Gold/Yellow accent:** `#FFD700` (for Daily Double, score displays, correct answers)
- **Background:** `#0a0a2e` (dark navy, like the Jeopardy set)
- **Card/Surface:** `#1a1a4e` (slightly lighter navy for cards and the board)
- **Text Primary:** `#FFFFFF`
- **Text Secondary:** `#b0b0d0`
- **Correct Green:** `#22c55e`
- **Incorrect Red:** `#ef4444`
- **Partial Yellow:** `#eab308`

### Board Styling

The game board should feel like the real Jeopardy TV show:
- Category headers in white text on the primary blue background, bold, uppercase.
- Dollar value cells in gold/yellow text on the blue background.
- Cells should have a subtle border and a hover effect (slight brightness increase).
- Answered cells should dim to a dark grey.
- The overall page background should be the dark navy.

### General UI

- Use a clean sans-serif font (Inter or system fonts).
- Rounded corners on cards and buttons (8px border-radius).
- Smooth transitions and hover effects.
- The clue modal should have a semi-transparent dark overlay behind it.
- Clue text in the modal should be large and readable (at least 20px).
- Responsive: the board should work on tablets but is primarily desktop. Drill mode and stats should work well on mobile.
- Add a top navigation bar on authenticated pages with links to: Home, Game, Drill, Stats, and a user menu (display name + logout).

---

## 6. Navigation Bar

Add a persistent top navigation bar on all authenticated pages:
- Logo/app name "Jeopardy Prep" on the left (links to Home).
- Navigation links: Home, Game, Drill, Stats.
- User section on the right: display name and a Logout button.
- Style: dark background matching the app theme, white text.

---

## 7. State Management

- Use React Context or Zustand for global auth state (current user, profile).
- Game state (board, score, answered cells, current clue) should be managed with React state (useState/useReducer) within the Game Board page component.
- Drill state (current question, session stats) similarly local to the Drill page.

---

## 8. Key Interactions Summary

1. **User signs up** -> profile row created -> redirected to Home.
2. **User clicks "Play Game"** -> 30 questions fetched (6 categories x 5 difficulties) -> board rendered -> user clicks cells -> clue modal -> answer evaluated -> score updates -> all cells done or "End Round" -> Final Jeopardy -> summary -> session saved.
3. **User clicks "Practice Drill"** -> picks category or "Surprise Me" -> questions served one at a time -> answer evaluated -> feedback shown -> stats updated -> "End Drill" saves session.
4. **User visits Stats** -> charts and tables rendered from `category_stats` and `game_sessions` data.

---

## 9. Error Handling

- If the Edge Function for answer evaluation fails, fall back to the local keyword match result.
- If the Edge Function for question generation fails, show an error toast and let the user try again or pick a different category.
- If the board query returns fewer than 6 complete categories (5 questions each), re-query with different random categories until you get 6 full ones, or show fewer columns if truly insufficient.
- Show loading spinners during data fetches and Edge Function calls.
- Show toast notifications for errors (e.g., "Failed to save session" or "Couldn't reach AI evaluator, using local match").

---

## 10. Question Bank Note

The `questions` table will be pre-seeded with 538K+ real Jeopardy clues from the jwolle1/jeopardy_clue_dataset (this seeding happens outside of Lovable, via a separate script). The app should assume the table already has data. The `generate-questions` Edge Function is only used as a supplement when drill mode needs more questions for a specific category.

---

Build all of the above as a complete, working React + Supabase application. Make sure all database queries use the Supabase JS client, all Edge Function calls use `supabase.functions.invoke()`, and all pages are properly routed and protected behind authentication.
