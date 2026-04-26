import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Retrieves the Gemini model with optional system instructions
 */
export const getModel = (modelName: string = "gemini-1.5-flash-latest", systemInstruction?: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined
  });
};

/**
 * Simple wrapper for generating content with Gemini
 */
export async function generateContent(prompt: string, systemPrompt?: string) {
  try {
    const model = getModel("gemini-1.5-flash-latest", systemPrompt);
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    console.warn("Primary model failed, attempting fallback to gemini-pro:", error.message);
    try {
      const fallbackModel = getModel("gemini-pro", systemPrompt);
      const result = await fallbackModel.generateContent(prompt);
      return result.response.text();
    } catch (fallbackError) {
      console.error("AI Generation failed on both primary and fallback models:", fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Simple wrapper for chat sessions
 */
export async function startChat(history: any[] = [], systemPrompt?: string) {
  // Find the index of the first 'user' message
  const firstUserIndex = history.findIndex(h => h.role === 'user');
  
  // Only include history starting from the first user message
  const relevantHistory = firstUserIndex !== -1 ? history.slice(firstUserIndex) : [];

  // Prepare history in the format expected by Google SDK
  const formattedHistory = relevantHistory.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  try {
    const model = getModel("gemini-1.5-flash-latest", systemPrompt);
    return model.startChat({
      history: formattedHistory,
    });
  } catch (error: any) {
    console.warn("Chat initialization failed, trying fallback to gemini-pro:", error.message);
    try {
      const fallbackModel = getModel("gemini-pro", systemPrompt);
      return fallbackModel.startChat({
        history: formattedHistory,
      });
    } catch (fallbackError) {
      console.error("Chat failed on both models:", fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Analyzes media (PDF, Image, etc) along with a text prompt
 */
export async function analyzeMedia(prompt: string, mediaBase64: string, mimeType: string = "application/pdf", systemPrompt?: string) {
  // Extract base64 if it's a data URI
  const base64 = mediaBase64.includes(",") ? mediaBase64.split(",")[1] : mediaBase64;
  
  const content = [
    prompt,
    {
      inlineData: {
        data: base64,
        mimeType: mimeType
      }
    }
  ];

  try {
    const model = getModel("gemini-1.5-flash-latest", systemPrompt);
    const result = await model.generateContent(content);
    return result.response.text();
  } catch (error: any) {
    console.warn("Media analysis failed with primary model, trying fallback:", error.message);
    try {
      const fallbackModel = getModel("gemini-pro", systemPrompt);
      const result = await fallbackModel.generateContent(content);
      return result.response.text();
    } catch (fallbackError) {
      console.error("Media analysis failed on both models:", fallbackError);
      throw fallbackError;
    }
  }
}
