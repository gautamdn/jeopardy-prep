export interface JeopardyQuestion {
  id: string;
  category: string;
  value: number;
  question: string;
  answer: string;
  airDate?: string;
  round?: 'Jeopardy!' | 'Double Jeopardy!' | 'Final Jeopardy!';
  source?: 'j-archive' | 'llm';
}

export interface JeopardyCategory {
  id: string;
  name: string;
  questions: JeopardyQuestion[];
}

export interface StudySession {
  id: string;
  date: string;
  categories: string[];
  questions: JeopardyQuestion[];
  score: number;
}

export interface UserPreferences {
  dailyTopics: string[];
  difficultyLevel: 'easy' | 'medium' | 'hard';
  customCategories: string[];
  notificationSettings: {
    dailyReminder: boolean;
    time: string;
  };
  questionMode: 'j-archive' | 'llm';
}

export type QuestionMode = 'j-archive' | 'llm'; 