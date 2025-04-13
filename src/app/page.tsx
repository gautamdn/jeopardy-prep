'use client';

import { JeopardyProvider } from '../contexts/JeopardyContext';
import { DailyTopics } from '../components/DailyTopics';
import { QuestionDisplay } from '../components/QuestionDisplay';
import { QuestionModeSelector } from '../components/QuestionModeSelector';

export default function Home() {
  return (
    <JeopardyProvider>
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Jeopardy Prep</h1>
        <div className="mb-8">
          <QuestionModeSelector />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <DailyTopics />
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <QuestionDisplay />
          </div>
        </div>
      </main>
    </JeopardyProvider>
  );
}
