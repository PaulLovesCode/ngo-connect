import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiModel = "gemini-3-flash-preview";

export interface EmergencyAnalysis {
  description: string;
  location: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requiredSkills: string[];
}

export async function analyzeEmergency(text: string): Promise<EmergencyAnalysis> {
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: `Analyze the following emergency report and extract details. 
    Report: "${text}"
    
    Urgency Prioritization Rules:
    1. Medical emergencies (injuries, sickness, life-threatening): CRITICAL or HIGH.
    2. Hunger/Food shortages: HIGH or MEDIUM.
    3. Winter clothes/shelter in cold: MEDIUM.
    4. Education/Schooling needs: LOW (Code Blue).
    5. General Charity/Donations: LOW.
    
    Provide the output in JSON format with:
    - description: a concise summary
    - location: extracted location
    - urgency: one of [low, medium, high, critical]
    - requiredSkills: list of skills needed (e.g., Medicine, First Aid, Logistics, Construction, Teaching, Counseling)`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          location: { type: Type.STRING },
          urgency: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
          requiredSkills: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["description", "location", "urgency", "requiredSkills"]
      }
    }
  });

  return JSON.parse(response.text || "{}") as EmergencyAnalysis;
}

export async function ocrImage(base64Image: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: {
      parts: [
        { text: "Extract all text from this image. If it's a form or handwritten note about an emergency, preserve the details clearly." },
        { inlineData: { data: base64Image, mimeType } }
      ]
    }
  });

  return response.text || "";
}
