import fs from 'fs';
import path from 'path';
import llmClient from './llm-client';
import axios from 'axios';
import {  DOMToGraph  } from './dom-to-graph';

class WorldModel {
  datasetPath: string;
  datasetContext: string;
  useNeuralWM: boolean;
  neuralServiceUrl: string;

  constructor() {
    this.datasetPath = path.resolve(process.cwd(), 'generated-tests', 'transitions-dataset.jsonl');
    this.datasetContext = '';
    this.useNeuralWM = process.env.USE_NEURAL_WM === 'true';
    this.neuralServiceUrl = process.env.NEURAL_WM_URL || 'http://localhost:8000/predict';
  }

  /**
   * Loads the historical transitions to provide context to the LLM.
   */
  _loadContext() {
    if (!fs.existsSync(this.datasetPath)) return '';
    try {
      const lines = fs.readFileSync(this.datasetPath, 'utf8').split('\\n').filter(Boolean);
      // Take the last 50 transitions to avoid context window explosion
      const recent = lines.slice(-50).join('\\n');
      return `Historical Transitions Dataset:\\n${recent}\\n`;
    } catch (e) {
      return '';
    }
  }

  async remember(currentState) {
    if (!this.useNeuralWM) return;
    try {
      const domString = currentState.html || ''; 
      const graphData = DOMToGraph.parse(domString);
      const response = await axios.post(this.neuralServiceUrl, {
          features: graphData.x,
          edge_index: graphData.edge_index,
          action: 0
      });
      const z = response.data.z;
      await axios.post(this.neuralServiceUrl.replace('/predict', '/remember'), { z });
    } catch (e) {
        // Silently fail if python service is offline
    }
  }

  /**
   * Phase 8: Predict with uncertainty bounds via Monte Carlo Dropout.
   * Returns mean risk predictions AND standard deviations (uncertainty).
   */
  async predictUncertain(currentState, action) {
    if (!this.useNeuralWM) {
      return this.predict(currentState, action);
    }
    try {
      const domString = currentState.html || '';
      const graphData = DOMToGraph.parse(domString);

      let actionInt = 0;
      const actType = typeof action === 'string' ? action : action.type;
      if (actType === 'click') actionInt = 1;
      else if (actType === 'fill') actionInt = 2;
      else if (actType === 'navigate') actionInt = 3;

      const response = await axios.post(this.neuralServiceUrl.replace('/predict', '/predict_uncertain'), {
          features: graphData.x,
          edge_index: graphData.edge_index,
          action: actionInt
      });

      const data = response.data;
      const avgRisk = (data.risks.crash + data.risks.security_issue + data.risks.auth_bypass) / 3.0;
      const avgUncertainty = (data.uncertainty.crash + data.uncertainty.security_issue + data.uncertainty.auth_bypass) / 3.0;

      return {
        url: currentState.url,
        predictedCrash: data.risks.crash > 0.5,
        securityViolation: data.risks.security_issue > 0.5,
        authBypass: data.risks.auth_bypass > 0.5,
        isNewState: data.risks.novelty > 0.7,
        rawRisk: avgRisk,
        uncertainty: avgUncertainty,
        uncertaintyDetail: data.uncertainty
      };
    } catch (error) {
      // Fallback to standard predict
      return this.predict(currentState, action);
    }
  }

  /**
   * Phase 3A: Predict the next state using the LLM in-context.
   * @param {object} currentState - The starting state.
   * @param {object} action - The action taken.
   * @returns {Promise<object>} The predicted next state.
   */
  async predict(currentState, action) {
    if (this.useNeuralWM) {
      try {
        // Phase 3B & 6: Use PyTorch Neural Microservice (GraphSAGE)
        const domString = currentState.html || ''; 
        const graphData = DOMToGraph.parse(domString);
        
        let actionInt = 0;
        const actType = typeof action === 'string' ? action : action.type;
        if (actType === 'click') actionInt = 1;
        else if (actType === 'fill') actionInt = 2;
        else if (actType === 'navigate') actionInt = 3;
        
        const response = await axios.post(this.neuralServiceUrl, {
            features: graphData.x,
            edge_index: graphData.edge_index,
            action: actionInt
        });
        
        const data = response.data;

        // Phase 7: Fetch intrinsic curiosity reward (Cosine Distance)
        let noveltyScore = 0;
        try {
            const rewardRes = await axios.post(this.neuralServiceUrl.replace('/predict', '/intrinsic_reward'), {
                z_next: data.z_next
            });
            noveltyScore = rewardRes.data.novelty;
        } catch(e) {}

        const avgRisk = (data.risks.crash + data.risks.security_issue + data.risks.auth_bypass) / 3.0;

        return {
          url: currentState.url, // Abstract latent space doesn't predict exact URL strings yet
          predictedCrash: data.risks.crash > 0.5,
          securityViolation: data.risks.security_issue > 0.5,
          authBypass: data.risks.auth_bypass > 0.5,
          isNewState: data.risks.novelty > 0.7, // legacy flag
          novelty: noveltyScore,
          rawRisk: avgRisk
        };
      } catch (error) {
        console.error('\\n[World Model] Python service failed or is offline. Fallback to base prediction.\\n');
        return { url: currentState.url, predictedCrash: false, securityViolation: false, authBypass: false, isNewState: false, novelty: 0, rawRisk: 0 };
      }
    }

    if (!llmClient.genAI) {
      // Fallback: without an LLM, we can't hallucinate a world model.
      return { url: currentState.url, predictedCrash: false, securityViolation: false, authBypass: false };
    }

    const context = this._loadContext();
    const systemPrompt = `
You are the SimTest Learned World Model.
Your job is to predict the next state of a web application given the current state and an action.
Analyze the Historical Transitions Dataset to infer the dynamics of the application.
Then, output a JSON object predicting the result of the new action.

Output Schema:
{
  "url": "Predicted new URL (string)",
  "predictedCrash": boolean,
  "securityViolation": boolean,
  "authBypass": boolean,
  "isNewState": boolean
}
`;

    const promptText = `
${context}

Current State URL: ${currentState.url || currentState}
Action to evaluate: ${JSON.stringify(action)}

Predict the next state.
`;

    const prediction = await llmClient.ask(systemPrompt, promptText);
    
    // Return safe fallback if LLM fails
    if (!prediction) {
      return { url: currentState.url, predictedCrash: false, securityViolation: false, authBypass: false, isNewState: false };
    }

    return {
      url: prediction.url || currentState.url,
      predictedCrash: !!prediction.predictedCrash,
      securityViolation: !!prediction.securityViolation,
      authBypass: !!prediction.authBypass,
      isNewState: !!prediction.isNewState
    };
  }
}

export default new WorldModel();
