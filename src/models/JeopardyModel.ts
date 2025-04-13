import { JeopardyQuestion, JeopardyCategory, StudySession, UserPreferences, QuestionMode } from '../types/jeopardy';
import { IQuestionService, JArchiveService, LLMService } from '../services/QuestionService';

export class JeopardyModel {
  private questions: JeopardyQuestion[] = [];
  private categories: JeopardyCategory[] = [];
  private studySessions: StudySession[] = [];
  private userPreferences: UserPreferences;
  private questionService: IQuestionService;

  constructor(initialPreferences: UserPreferences) {
    this.userPreferences = initialPreferences;
    this.questionService = this.getQuestionService(initialPreferences.questionMode);
  }

  private getQuestionService(mode: QuestionMode): IQuestionService {
    return mode === 'j-archive' ? new JArchiveService() : new LLMService();
  }

  setQuestionMode(mode: QuestionMode): void {
    this.userPreferences.questionMode = mode;
    this.questionService = this.getQuestionService(mode);
  }

  // Question Management
  addQuestion(question: JeopardyQuestion): void {
    this.questions.push(question);
  }

  getQuestionsByCategory(category: string): JeopardyQuestion[] {
    return this.questions.filter(q => q.category === category);
  }

  // Category Management
  addCategory(category: JeopardyCategory): void {
    this.categories.push(category);
  }

  getCategories(): JeopardyCategory[] {
    return this.categories;
  }

  // Study Session Management
  createStudySession(categories: string[]): StudySession {
    const session: StudySession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      categories,
      questions: this.getQuestionsByCategories(categories),
      score: 0
    };
    this.studySessions.push(session);
    return session;
  }

  private getQuestionsByCategories(categories: string[]): JeopardyQuestion[] {
    return this.questions.filter(q => categories.includes(q.category));
  }

  // User Preferences
  updatePreferences(preferences: Partial<UserPreferences>): void {
    if (preferences.questionMode && preferences.questionMode !== this.userPreferences.questionMode) {
      this.setQuestionMode(preferences.questionMode);
    }
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  getPreferences(): UserPreferences {
    return this.userPreferences;
  }

  // Daily Topics
  getDailyTopics(): string[] {
    return this.userPreferences.dailyTopics;
  }

  addDailyTopic(topic: string): void {
    if (!this.userPreferences.dailyTopics.includes(topic)) {
      this.userPreferences.dailyTopics.push(topic);
    }
  }

  // Question Generation
  async generateQuestionsByTopic(topic: string, count: number = 5): Promise<JeopardyQuestion[]> {
    return this.questionService.generateQuestionsByTopic(topic, count);
  }

  async generateRandomQuestions(count: number = 5): Promise<JeopardyQuestion[]> {
    return this.questionService.generateRandomQuestions(count);
  }
} 