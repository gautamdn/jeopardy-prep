import React from 'react';
import { useJeopardy } from '../contexts/JeopardyContext';
import { QuestionMode } from '../types/jeopardy';

export const QuestionModeSelector: React.FC = () => {
  const { model } = useJeopardy();
  const currentMode = model.getPreferences().questionMode;

  const handleModeChange = (mode: QuestionMode) => {
    model.setQuestionMode(mode);
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Question Source</h3>
      <div className="flex space-x-4">
        <button
          onClick={() => handleModeChange('llm')}
          className={`px-4 py-2 rounded ${
            currentMode === 'llm'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          AI Generated
        </button>
        <button
          onClick={() => handleModeChange('j-archive')}
          className={`px-4 py-2 rounded ${
            currentMode === 'j-archive'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          J-Archive
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        {currentMode === 'llm'
          ? 'Using AI to generate questions (requires OpenAI API key)'
          : 'Using questions from J-Archive (scraping in progress)'}
      </p>
    </div>
  );
}; 