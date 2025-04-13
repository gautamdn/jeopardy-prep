import React, { createContext, useContext, useState, ReactNode } from 'react';
import { JeopardyModel } from '../models/JeopardyModel';
import { UserPreferences } from '../types/jeopardy';

interface JeopardyContextType {
  model: JeopardyModel;
  currentSession: string | null;
  setCurrentSession: (sessionId: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const defaultPreferences: UserPreferences = {
  dailyTopics: [],
  difficultyLevel: 'medium',
  customCategories: [],
  notificationSettings: {
    dailyReminder: true,
    time: '09:00'
  },
  questionMode: 'llm'
};

const JeopardyContext = createContext<JeopardyContextType | undefined>(undefined);

export const JeopardyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [model] = useState(() => new JeopardyModel(defaultPreferences));
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <JeopardyContext.Provider
      value={{
        model,
        currentSession,
        setCurrentSession,
        isLoading,
        setIsLoading
      }}
    >
      {children}
    </JeopardyContext.Provider>
  );
};

export const useJeopardy = () => {
  const context = useContext(JeopardyContext);
  if (context === undefined) {
    throw new Error('useJeopardy must be used within a JeopardyProvider');
  }
  return context;
}; 