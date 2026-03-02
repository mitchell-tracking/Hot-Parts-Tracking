
import { GoogleGenAI } from "@google/genai";
import { Part } from "../types";

export const getStatusAnalysis = async (parts: Part[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summary = parts.map(p => {
    const workUnits = p.steps.flatMap(s => s.subSteps && s.subSteps.length > 0 ? s.subSteps : [s]);
    const completed = workUnits.filter(u => u.completed).length;
    const progress = Math.round((completed / workUnits.length) * 100);
    
    let currentTask = "Finished";
    const nextStep = p.steps.find(s => !s.completed);
    if (nextStep) {
      if (nextStep.subSteps && nextStep.subSteps.length > 0) {
        const nextSub = nextStep.subSteps.find(ss => !ss.completed);
        currentTask = `${nextStep.name} (${nextSub?.name})`;
      } else {
        currentTask = nextStep.name + (nextStep.isOptional ? " (Optional)" : "");
      }
    }
    
    return `${p.name}: ${progress}% complete. Current stage: ${currentTask}. Target: ${p.estFinishDate}.`;
  }).join('\n');

  const prompt = `
    Act as a professional production manager. Analyze the following 6 parts currently in production. 
    Note that "Weld Repair" is now an optional step for parts TRN, CH, and DV.
    
    ${summary}
    
    Provide a concise, high-level status update (max 3 sentences). 
    Highlight the progression into specialized testing phases. 
    Acknowledge that some steps are optional and can be skipped if criteria are met.
    Format as a single professional paragraph.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Status analysis unavailable at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to generate AI status report. Please check connection.";
  }
};
