import { Mistral } from "@mistralai/mistralai";
import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const CATEGORIES = [
  "Abstract", "Animals/Wildlife", "Arts", "Backgrounds/Textures", "Beauty/Fashion", 
  "Buildings/Landmarks", "Business/Finance", "Celebrities", "Education", "Food and drink", 
  "Healthcare/Medical", "Holidays", "Industrial", "Interiors", "Miscellaneous", "Nature", 
  "Objects", "Parks/Outdoor", "People", "Religion", "Science", "Signs/Symbols", 
  "Sports/Recreation", "Technology", "Transportation", "Vintage"
];

function cleanKeywords(keywords: any[], count: number): string[] {
  if (!Array.isArray(keywords)) return [];
  const cleaned = Array.from(new Set(
    keywords
      .map(k => String(k).trim().toLowerCase())
      .filter(k => k.length > 0 && !k.includes(',') && !k.includes(' '))
  )).slice(0, count);
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, customApiKey, keywordCount, imageBase64, mimeType } = await req.json();

    // If an image is provided, we MUST use Gemini for "proper scanning"
    if (imageBase64) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: mimeType || "image/jpeg"
                }
              },
              {
                text: `Analyze this image for a professional Microstock portfolio (like Shutterstock). 
                Generate metadata optimized for SEO.
                
                REQUIREMENTS:
                1. Title: Descriptive, SEO-rich (max 70 chars).
                2. Description: Detailed, 100-200 characters. Focus on lighting, mood, subject.
                3. Keywords: Exactly ${keywordCount || 40} unique, single-word keywords.
                4. Categories: Exactly 2 most relevant from this list: [${CATEGORIES.join(", ")}].
                
                Return JSON only.`
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                categories: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "description", "keywords", "categories"]
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from Gemini");
        const data = JSON.parse(text);
        return NextResponse.json({
          ...data,
          keywords: cleanKeywords(data.keywords, keywordCount || 40)
        });
      } catch (geminiError: any) {
        console.error("Gemini Vision Error:", geminiError);
        // Fallback to Mistral if Gemini fails, but vision won't work there
      }
    }

    // Default to Mistral if no image or Gemini fails
    const apiKey = customApiKey;
    if (!apiKey) {
      // If no Mistral key and no Gemini image, we can try Gemini text-only as ultimate fallback
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: `You are an expert Microstock Metadata Optimizer.
          Title: max 70 chars.
          Description: 100-200 chars.
          Keywords: Exactly ${keywordCount || 40} unique single-word keywords.
          Categories: Exactly 2 from [${CATEGORIES.join(", ")}].
          Return JSON.`,
          responseMimeType: "application/json"
        }
      });
      const text = textResponse.text;
      if (!text) throw new Error("Empty response from AI");
      const data = JSON.parse(text);
      return NextResponse.json({
        ...data,
        keywords: cleanKeywords(data.keywords, keywordCount || 40)
      });
    }

    const client = new Mistral({ apiKey });

    const chatResponse = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `You are an expert Microstock Metadata Optimizer and SEO specialist. 
          
          RULES:
          - title: A descriptive, SEO-rich title (max 70 chars).
          - description: SEO-friendly text (100-200 chars).
          - keywords: Exactly ${keywordCount || 40} unique, single-word keywords.
          - categories: Exactly 2 from: [${CATEGORIES.join(", ")}]
          
          JSON RESPONSE FORMAT:
          {
            "title": "string",
            "description": "string",
            "keywords": ["word1", "word2", ...],
            "categories": ["cat1", "cat2"]
          }`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      responseFormat: { type: "json_object" }
    });

    const text = chatResponse.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from Mistral");

    const result = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    return NextResponse.json({
      ...result,
      keywords: cleanKeywords(result.keywords, keywordCount || 40)
    });
  } catch (error: any) {
    console.error("Metadata API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate metadata" }, { status: 500 });
  }
}
