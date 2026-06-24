import {  GoogleGenerativeAI  } from '@google/generative-ai';

/**
 * Client for interacting with the Gemini API to power the multi-agent system.
 */
class LLMClient {
  apiKey: string;
  genAI: any;
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('\x1b[33m%s\x1b[0m', '⚠ Warning: GEMINI_API_KEY is not set. LLM features will fall back to BFS.');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Prompts the LLM with the given persona and state.
   * @param {string} systemInstruction - The persona or system prompt (e.g. ChaosAgent rules).
   * @param {string} promptText - The specific prompt for this turn.
   * @returns {Promise<object|null>} The parsed JSON response, or null if API fails/is absent.
   */
  async ask(systemInstruction, promptText) {
    if (!this.genAI) {
      return null; // Fallback to BFS
    }

    try {
      // Using gemini-2.5-flash for reasoning tasks to avoid rate limits
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      });

      const result = await model.generateContent(promptText);
      const response = await result.response;
      const text = response.text();
      
      return JSON.parse(text);
    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', '[LLM API Error]', error.message);
      return null;
    }
  }
}

export default new LLMClient();
