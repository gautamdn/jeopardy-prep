import React, { useState, useEffect } from 'react';
import { useJeopardy } from '../contexts/JeopardyContext';
import { JeopardyQuestion } from '../types/jeopardy';

export const QuestionDisplay: React.FC = () => {
  const { model } = useJeopardy();
  const [currentQuestion, setCurrentQuestion] = useState<JeopardyQuestion | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const getRandomQuestion = async () => {
    try {
      console.log('Starting getRandomQuestion...');
      
      // Get all questions from all topics
      const allQuestions = model.getAllQuestions();
      console.log('Current questions:', allQuestions);
      
      if (allQuestions.length === 0) {
        const topics = model.getDailyTopics();
        console.log('Available topics:', topics);
        
        if (topics.length === 0) {
          console.log('No topics found');
          setError('No topics available. Please add some topics first.');
          return;
        }

        // Generate questions for each topic
        for (const topic of topics) {
          console.log('Generating questions for topic:', topic);
          try {
            const newQuestions = await model.generateQuestionsByTopic(topic, 2);
            console.log('Generated questions:', newQuestions);
            newQuestions.forEach(q => model.addQuestion(q));
          } catch (topicError) {
            console.error('Error generating questions for topic:', topic, topicError);
          }
        }
      }

      // Get all questions again after generation
      const availableQuestions = model.getAllQuestions();
      console.log('Available questions after generation:', availableQuestions);
      
      if (availableQuestions.length === 0) {
        console.log('No questions available after generation');
        setError('Failed to generate questions. Please try again.');
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      setCurrentQuestion(availableQuestions[randomIndex]);
      setShowAnswer(false);
      setUserAnswer('');
      setError(null);
    } catch (err) {
      console.error('Error in getRandomQuestion:', err);
      setError('Failed to generate questions. Please try again.');
    }
  };

  const checkAnswer = () => {
    if (!currentQuestion) return;

    setShowAnswer(true);
    
    // Extract keywords from the correct answer by:
    // 1. Remove "What/Who is/are" prefix
    // 2. Remove punctuation and convert to lowercase
    // 3. Split into words and filter out common words
    const correctAnswer = currentQuestion.answer
      .replace(/^(what|who|where|when|why|how) (is|are|was|were) /i, '')
      .replace(/[.,?!]/g, '')
      .toLowerCase();
    
    const userKeywords = userAnswer.toLowerCase()
      .replace(/^(what|who|where|when|why|how) (is|are|was|were) /i, '')
      .replace(/[.,?!]/g, '')
      .split(' ')
      .filter(word => word.length > 2); // Filter out short words

    const correctKeywords = correctAnswer
      .split(' ')
      .filter(word => word.length > 2);

    // Check if the user's answer contains enough keywords
    const matchedKeywords = userKeywords.filter(word => 
      correctKeywords.some(correct => correct.includes(word) || word.includes(correct))
    );

    const percentageMatched = matchedKeywords.length / correctKeywords.length;
    const isCorrect = percentageMatched >= 0.5; // Require at least 50% keyword match

    if (isCorrect) {
      setScore(prev => prev + currentQuestion.value);
    }
  };

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={getRandomQuestion}
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
        >
          Try Again
        </button>
      </div>
    );
  }

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