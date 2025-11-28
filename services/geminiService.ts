import { GoogleGenAI } from "@google/genai";
import { PageData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const askGeminiAboutData = async (query: string, contextData: PageData[]): Promise<string> => {
  try {
    // Limit context to prevent token overflow, taking the most relevant parts
    const contextString = JSON.stringify(contextData.slice(0, 15).map(p => ({
      title: p.title,
      type: p.type,
      tags: p.tags,
      meta_content: p.content, // Now using metadata properties as content
      lastEdited: p.lastEdited
    })));

    const prompt = `
      Você é o Izy, um assistente inteligente especialista em Notion.
      O usuário fará uma pergunta sobre seus documentos do Notion.
      
      Aqui estão os metadados dos documentos recentes encontrados (Contexto):
      ${contextString}
      
      Pergunta do usuário: "${query}"
      
      Instruções:
      1. Responda de forma amigável e direta.
      2. Use o contexto fornecido para encontrar a resposta.
      3. Se a pergunta for sobre "o que eu trabalhei recentemente", use os dados de 'lastEdited'.
      4. Se a informação não estiver clara nos metadados, sugira que o usuário abra o documento específico.
      
      Responda em Português.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não consegui processar uma resposta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Desculpe, estou tendo dificuldades para processar seus dados no momento.";
  }
};