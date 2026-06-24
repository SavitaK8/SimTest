import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {  DOMToGraph  } from './dom-to-graph';

const DATASET_PATH = path.resolve(__dirname, '../generated-tests/transitions-dataset.jsonl');
const NEURAL_URL = process.env.NEURAL_WM_URL || 'http://localhost:8000/predict';
const REPORT_OUT = path.resolve(__dirname, '../generated-tests/risk-validation-report.md');

async function validateRiskHead() {
    console.log('🚀 Starting Phase 5B: Risk Head Validation');

    if (!fs.existsSync(DATASET_PATH)) {
        console.error('Dataset not found!');
        return;
    }

    const lines = fs.readFileSync(DATASET_PATH, 'utf8').split('\\n').filter(Boolean);
    console.log(`Loaded ${lines.length} historical transitions.`);

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    let predictionsList = [];

    let processedCount = 0;

    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            const domString = data.state.html || data.state.url;
            const graphData = DOMToGraph.parse(domString);
            
            let actionInt = 0;
            const actType = typeof data.action === 'string' ? data.action : data.action.type;
            if (actType === 'click') actionInt = 1;
            else if (actType === 'fill') actionInt = 2;
            else if (actType === 'navigate') actionInt = 3;

            // Ground Truth
            const actualBugs = data.bugs || [];
            const hasActualRisk = actualBugs.length > 0;
            const y_true = hasActualRisk ? 1 : 0;

            // Predict
            const response = await axios.post(NEURAL_URL, {
                features: graphData.x,
                edge_index: graphData.edge_index,
                action: actionInt
            });

            const risks = response.data.risks;
            const maxRisk = Math.max(risks.crash, risks.security_issue, risks.auth_bypass);
            const predictedRisk = maxRisk > 0.5;

            predictionsList.push({ t: y_true, p: maxRisk });

            // Confusion Matrix Logic
            if (predictedRisk && hasActualRisk) truePositives++;
            else if (predictedRisk && !hasActualRisk) falsePositives++;
            else if (!predictedRisk && !hasActualRisk) trueNegatives++;
            else if (!predictedRisk && hasActualRisk) falseNegatives++;

            processedCount++;
            process.stdout.write(`\\rProcessed ${processedCount}/${lines.length}...`);

        } catch (error) {
            // Ignore offline errors to continue loop
        }
    }

    console.log('\\n\\n📊 Validation Complete!');

    // Calculate Metrics
    const total = truePositives + falsePositives + trueNegatives + falseNegatives;
    const precision = truePositives + falsePositives > 0 ? (truePositives / (truePositives + falsePositives)) : 0;
    const recall = truePositives + falseNegatives > 0 ? (truePositives / (truePositives + falseNegatives)) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = total > 0 ? ((truePositives + trueNegatives) / total) : 0;

    // Calculate ROC-AUC using Wilcoxon-Mann-Whitney rank sum (approximate)
    let sortedPreds = [...predictionsList].sort((a, b) => a.p - b.p);
    let numPos = sortedPreds.filter(x => x.t === 1).length;
    let numNeg = sortedPreds.length - numPos;
    let rankSumPos = 0;
    for (let i = 0; i < sortedPreds.length; i++) {
        if (sortedPreds[i].t === 1) rankSumPos += (i + 1);
    }
    let roc_auc = (numPos > 0 && numNeg > 0) ? (rankSumPos - (numPos * (numPos + 1)) / 2) / (numPos * numNeg) : 0;

    // Calculate PR-AUC (Rectangular integration)
    let sortedDesc = [...predictionsList].sort((a, b) => b.p - a.p);
    let tpCount = 0;
    let fpCount = 0;
    let lastRecall = 0;
    let pr_auc = 0;
    for (let i = 0; i < sortedDesc.length; i++) {
        if (sortedDesc[i].t === 1) tpCount++;
        else fpCount++;
        let p = tpCount / (tpCount + fpCount);
        let r = numPos > 0 ? tpCount / numPos : 0;
        pr_auc += (r - lastRecall) * p;
        lastRecall = r;
    }

    // Generate Markdown
    let md = `# Phase 5B: Neural Risk Head Validation Report\\n\\n`;
    md += `This report empirically validates the predictive accuracy of the PyTorch Risk Head against historical ground-truth data.\\n\\n`;
    md += `## Confusion Matrix\\n`;
    md += `| | **Actual Risk (Bug)** | **Actual Safe (No Bug)** |\\n`;
    md += `|---|---|---|\\n`;
    md += `| **Predicted Risk (>0.5)** | ${truePositives} (TP) | ${falsePositives} (FP) |\\n`;
    md += `| **Predicted Safe (<0.5)** | ${falseNegatives} (FN) | ${trueNegatives} (TN) |\\n\\n`;
    
    md += `## Statistical Efficacy\\n`;
    md += `- **Total Samples Evaluated**: ${total}\\n`;
    md += `- **Accuracy**: ${(accuracy * 100).toFixed(2)}%\\n`;
    md += `- **Precision (Positive Predictive Value)**: ${(precision * 100).toFixed(2)}%\\n`;
    md += `- **Recall (Sensitivity)**: ${(recall * 100).toFixed(2)}%\\n`;
    md += `- **F1-Score**: ${(f1Score * 100).toFixed(2)}%\\n`;
    md += `- **ROC-AUC**: ${(roc_auc * 100).toFixed(2)}%\\n`;
    md += `- **PR-AUC**: ${(pr_auc * 100).toFixed(2)}%\\n\\n`;

    md += `### Insights\\n`;
    if (roc_auc < 0.6) {
        md += `> ⚠️ **Poor Discriminative Power**: ROC-AUC is low. The model is struggling to differentiate between safe and risky states globally.\\n`;
    } else if (recall < 0.5) {
        md += `> ⚠️ **Low Recall**: The model is missing actual bugs. We may need to train on a larger dataset or upgrade to GraphSAGE (Phase 6).\\n`;
    } else if (precision < 0.5) {
        md += `> ⚠️ **Low Precision**: The model is hallucinating risks too often (False Positives). Consider tuning the binary crossentropy threshold.\\n`;
    } else {
        md += `> ✅ **Strong Performance**: The Risk Head successfully differentiates between safe and dangerous state trajectories before they are executed in the browser.\\n`;
    }

    fs.writeFileSync(REPORT_OUT, md);
    console.log(`Report generated at: ${REPORT_OUT}`);
}

validateRiskHead();
