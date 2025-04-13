import { JeopardyQuestion, QuestionMode } from '../types/jeopardy';

export interface IQuestionService {
  generateQuestionsByTopic(topic: string, count?: number): Promise<JeopardyQuestion[]>;
  generateRandomQuestions(count?: number): Promise<JeopardyQuestion[]>;
  getMode(): QuestionMode;
}

export class JArchiveService implements IQuestionService {
  private static readonly BASE_URL = 'https://j-archive.com';

  getMode(): QuestionMode {
    return 'j-archive';
  }

  async generateQuestionsByTopic(topic: string, count: number = 5): Promise<JeopardyQuestion[]> {
    try {
      const response = await fetch(`${JArchiveService.BASE_URL}/search.php?search=${encodeURIComponent(topic)}`);
      const html = await response.text();
      
      // Parse HTML and extract questions
      const questions: JeopardyQuestion[] = [];
      
      // TODO: Implement proper HTML parsing logic
      // This would involve:
      // 1. Extracting question text
      // 2. Extracting answers
      // 3. Extracting values
      // 4. Extracting air dates
      
      return questions.map(q => ({
        ...q,
        source: 'j-archive'
      }));
    } catch (error) {
      console.error('Error fetching questions:', error);
      return [];
    }
  }

  async generateRandomQuestions(count: number = 5): Promise<JeopardyQuestion[]> {
    try {
      const response = await fetch(`${JArchiveService.BASE_URL}/random.php`);
      const html = await response.text();
      
      const questions: JeopardyQuestion[] = [];
      // TODO: Implement proper HTML parsing logic
      
      return questions.slice(0, count).map(q => ({
        ...q,
        source: 'j-archive'
      }));
    } catch (error) {
      console.error('Error fetching random questions:', error);
      return [];
    }
  }
}

export class LLMService implements IQuestionService {
  private static readonly API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  private static readonly BASE_URL = 'https://api.openai.com/v1/chat/completions';

  getMode(): QuestionMode {
    return 'llm';
  }

  async generateQuestionsByTopic(topic: string, count: number = 5): Promise<JeopardyQuestion[]> {
    try {
      const response = await fetch(LLMService.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLMService.API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a Jeopardy question writer. Generate questions in the format: "This is the answer" (What is the question?). Make them challenging but fair.'
            },
            {
              role: 'user',
              content: `Generate ${count} Jeopardy questions about ${topic}. For each question, provide:
              1. The answer (in the form of a statement)
              2. The question (in the form of "What is...?")
              3. A difficulty value (200, 400, 600, 800, or 1000)
              Format as JSON array with fields: answer, question, value`
            }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      const rawQuestions = JSON.parse(data.choices[0].message.content);

      return rawQuestions.map((q: any, index: number) => ({
        id: `${topic}-${index}-${Date.now()}`,
        category: topic,
        value: q.value,
        question: q.answer,
        answer: q.question,
        airDate: new Date().toISOString(),
        source: 'llm'
      }));
    } catch (error) {
      console.error('Error generating questions:', error);
      return [];
    }
  }

  async generateRandomQuestions(count: number = 5): Promise<JeopardyQuestion[]> {
    try {
      const response = await fetch(LLMService.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLMService.API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a Jeopardy question writer. Generate questions in the format: "This is the answer" (What is the question?). Make them challenging but fair.'
            },
            {
              role: 'user',
              content: `Generate ${count} random Jeopardy questions across different categories. For each question, provide:
              1. The category
              2. The answer (in the form of a statement)
              3. The question (in the form of "What is...?")
              4. A difficulty value (200, 400, 600, 800, or 1000)
              Format as JSON array with fields: category, answer, question, value`
            }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      const rawQuestions = JSON.parse(data.choices[0].message.content);

      return rawQuestions.map((q: any, index: number) => ({
        id: `random-${index}-${Date.now()}`,
        category: q.category,
        value: q.value,
        question: q.answer,
        answer: q.question,
        airDate: new Date().toISOString(),
        source: 'llm'
      }));
    } catch (error) {
      console.error('Error generating random questions:', error);
      return [];
    }
  }
} 