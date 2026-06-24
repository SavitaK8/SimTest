import worldModel from './world-model';
import llmClient from './llm-client';
import {  getRandomExplorerAgent  } from './agents';

class DreamerEngine {
  dreams: any[];
  constructor() {
    this.dreams = [];
  }

  /**
   * Generates a hypothetical action using an LLM Agent without real DOM context.
   */
  async _hallucinateAction(stateUrl) {
    if (!llmClient.genAI) {
      // Fallback action if Gemini API key isn't set, so we can still test the Neural World Model
      const actions = [
        { type: 'click', selector: 'button, a', description: 'Generic click fallback' },
        { type: 'fill', selector: 'input', value: '<script>alert(1)</script>', description: 'XSS payload fallback' }
      ];
      return actions[Math.floor(Math.random() * actions.length)];
    }

    const agent = getRandomExplorerAgent();
    const promptText = `
You are hallucinating an action for the Dreamer Engine.
I am currently at URL: ${stateUrl}
Without knowing the DOM, guess a high-value action to attempt.
Return ONLY JSON:
{
  "type": "click" | "fill" | "navigate",
  "selector": "guessed selector like #submit or #email",
  "value": "optional value",
  "description": "Short description"
}
`;
    const res = await llmClient.ask(agent.getSystemPrompt(), promptText);
    return Array.isArray(res) ? res[0] : res;
  }

  /**
   * Phase 7: Evaluates the reward function for a predicted state transition.
   */
  _evaluateReward(prediction) {
    let score = 0;
    
    // Fallback scoring for non-neural runs
    if (prediction.novelty === undefined) {
        if (prediction.isNewState) score += 50;
        if (prediction.predictedCrash) score += 100;
        if (prediction.securityViolation) score += 80;
        if (prediction.authBypass) score += 60;
        return score;
    }

    // Advanced Mathematical Reward (Phase 7 Academic Standard)
    const novelty = prediction.novelty || 0;
    const risk = prediction.rawRisk || 0;
    const coverage_gain = prediction.isNewState ? 1.0 : 0.0; // Boosted if the classifier strictly flags it as new

    // 0.5 * novelty + 0.3 * risk + 0.2 * coverage_gain
    const academicReward = (0.5 * novelty) + (0.3 * risk) + (0.2 * coverage_gain);

    // Multiply by 100 for easier readability in logs
    return academicReward * 100;
  }

  /**
   * Run the Dreamer Loop to find the highest-reward trajectory entirely in memory.
   * @param {string} startUrl - The URL to start dreaming from.
   * @param {number} numDreams - How many parallel futures to imagine.
   * @param {number} maxDepth - How deep each dream goes.
   * @returns {Promise<object>} The best dreamed trajectory.
   */
  async plan(startUrl, numDreams = 5, maxDepth = 3) {
    console.log(`\\n[Dreamer] Imagining ${numDreams} futures to depth ${maxDepth} starting from ${startUrl}...`);
    this.dreams = [];

    for (let i = 0; i < numDreams; i++) {
      let currentStateUrl = startUrl;
      let totalScore = 0;
      let totalUncertainty = 0;
      const path = [];

      for (let depth = 0; depth < maxDepth; depth++) {
        // 1. Hallucinate an Action
        const action = await this._hallucinateAction(currentStateUrl);
        if (!action) break;

        // 2. Phase 8: Predict with Uncertainty
        const prediction = await worldModel.predictUncertain({ url: currentStateUrl }, action);
        
        // 3. Evaluate Reward
        const reward = this._evaluateReward(prediction);
        
        // Phase 8: Discount reward by uncertainty — confident predictions are worth more
        const uncertainty = (prediction as any).uncertainty ? (prediction as any).uncertainty[0] : 0;
        const confidence = 1.0 - Math.min(uncertainty, 1.0);
        const adjustedReward = reward * confidence;
        
        totalScore += adjustedReward;
        totalUncertainty += uncertainty;

        path.push({
          action,
          predictedState: prediction,
          reward: adjustedReward,
          rawReward: reward,
          uncertainty: uncertainty
        });

        currentStateUrl = prediction.url;

        // Fast-fail if we found a massive bug WITH high confidence
        if ((prediction.predictedCrash || prediction.securityViolation) && confidence > 0.7) {
          break; 
        }
      }

      const avgUncertainty = path.length > 0 ? totalUncertainty / path.length : 1.0;

      this.dreams.push({
        id: `Dream-${i+1}`,
        score: totalScore,
        avgUncertainty: avgUncertainty,
        path
      });
    }

    // Sort dreams by score descending
    this.dreams.sort((a, b) => b.score - a.score);
    const bestDream = this.dreams[0];

    if (bestDream) {
      console.log(`[Dreamer] Selected best future: ${bestDream.id} (Score: ${bestDream.score.toFixed(1)}, Uncertainty: ${bestDream.avgUncertainty.toFixed(3)})`);
    }

    return bestDream;
  }
}

export default new DreamerEngine();
