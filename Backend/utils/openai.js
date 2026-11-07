import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const getGeminiAPIResponse = async (message) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            contents: message
        });

        return response.text;

    } catch (error) {
        console.error("Gemini API Error:", error.message);
        throw error;
    }
};

export default getGeminiAPIResponse;