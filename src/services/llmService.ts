import { JeopardyQuestion } from '../types/jeopardy';

export class LLMService {
  private static readonly API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  private static readonly BASE_URL = 'https://api.openai.com/v1/chat/completions';

  static async generateQuestionsByTopic(topic: string, count: number = 5): Promise<JeopardyQuestion[]> {
    try {
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
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
        airDate: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error generating questions:', error);
      return [];
    }
  }

  static async generateRandomQuestions(count: number = 5): Promise<JeopardyQuestion[]> {
    try {
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
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
        airDate: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error generating random questions:', error);
      return [];
    }
  }
} 