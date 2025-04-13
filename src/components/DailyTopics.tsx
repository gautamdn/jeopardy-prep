import React, { useState, useEffect } from 'react';
import { useJeopardy } from '../contexts/JeopardyContext';
import { LLMService } from '../services/llmService';

export const DailyTopics: React.FC = () => {
  const { model, isLoading, setIsLoading } = useJeopardy();
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = () => {
    setTopics(model.getDailyTopics());
  };

  const handleAddTopic = async () => {
    if (!newTopic.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      // Add topic to model
      model.addDailyTopic(newTopic.trim());
      
      // Generate questions for the new topic using LLM
      const questions = await LLMService.generateQuestionsByTopic(newTopic.trim());
      if (questions.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }
      
      questions.forEach(question => model.addQuestion(question));
      
      // Update local state
      setTopics(model.getDailyTopics());
      setNewTopic('');
    } catch (error) {
      console.error('Error adding topic:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Daily Topics</h2>
      
      <div className="mb-4">
        <input
          type="text"
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
          placeholder="Enter a new topic (e.g., 'World History', 'Science', 'Literature')"
          className="border p-2 rounded mr-2 w-64"
        />
        <button
          onClick={handleAddTopic}
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isLoading ? 'Generating Questions...' : 'Add Topic'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {topics.map((topic, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-gray-100 rounded"
          >
            <span>{topic}</span>
            <button
              onClick={() => {
                // TODO: Implement topic removal
              }}
              className="text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}; 