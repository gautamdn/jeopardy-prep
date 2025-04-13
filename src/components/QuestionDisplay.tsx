import React, { useState } from 'react';
import { useJeopardy } from '../contexts/JeopardyContext';
import { JeopardyQuestion } from '../types/jeopardy';

export const QuestionDisplay: React.FC = () => {
  const { model } = useJeopardy();
  const [currentQuestion, setCurrentQuestion] = useState<JeopardyQuestion | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);

  const getRandomQuestion = () => {
    const allQuestions = model.getQuestionsByCategory(currentQuestion?.category || '');
    if (allQuestions.length === 0) return;

    const randomIndex = Math.floor(Math.random() * allQuestions.length);
    setCurrentQuestion(allQuestions[randomIndex]);
    setShowAnswer(false);
    setUserAnswer('');
  };

  const checkAnswer = () => {
    if (!currentQuestion) return;

    setShowAnswer(true);
    const isCorrect = userAnswer.toLowerCase().includes(currentQuestion.answer.toLowerCase());
    if (isCorrect) {
      setScore(prev => prev + currentQuestion.value);
    }
  };

  if (!currentQuestion) {
    return (
      <div className="p-4 text-center">
        <button
          onClick={getRandomQuestion}
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
        >
          Start Practice
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-xl font-semibold mb-2">Category: {currentQuestion.category}</h3>
        <p className="text-lg mb-4">Value: ${currentQuestion.value}</p>
        <div className="bg-blue-100 p-4 rounded-lg mb-4">
          <p className="text-lg">{currentQuestion.question}</p>
        </div>
      </div>

      {!showAnswer ? (
        <div className="mb-4">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Your answer..."
            className="border p-2 rounded w-full mb-2"
          />
          <button
            onClick={checkAnswer}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Check Answer
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <p className="text-lg font-semibold">Correct Answer:</p>
            <p className="text-lg">{currentQuestion.answer}</p>
          </div>
          <button
            onClick={getRandomQuestion}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Next Question
          </button>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xl font-bold">Score: ${score}</p>
      </div>
    </div>
  );
}; 