const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = "AIzaSyAxIHPPMWkWxJ6KMp_w5XMWhtUyogWDLxY";
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // There isn't a direct listModels in the standard SDK easily accessible without extra auth usually
    // but let's try a simple generation with a known model to see if it works
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("test");
    console.log("Gemini 1.5 Flash worked!");
  } catch (e) {
    console.error("Gemini 1.5 Flash failed:", e.message);
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("test");
        console.log("Gemini Pro worked!");
    } catch (e2) {
        console.error("Gemini Pro failed:", e2.message);
    }
  }
}

listModels();
