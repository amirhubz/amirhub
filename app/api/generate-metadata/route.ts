import { Mistral } from "@mistralai/mistralai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, customApiKey, keywordCount } = await req.json();

    const apiKey = customApiKey;
    if (!apiKey) {
      return NextResponse.json({ error: "Mistral API Key is required. Please provide it in the input box." }, { status: 400 });
    }

    const client = new Mistral({ apiKey });

    const chatResponse = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `You are an expert Microstock Metadata Optimizer and SEO specialist. 
          Your goal is to provide metadata that maximizes visibility on platforms like Shutterstock and Adobe Stock.
          
          RULES:
          - title: A descriptive, SEO-rich title (max 70 chars).
          - description: A highly descriptive, long-form SEO-friendly text. 
            MANDATORY: Minimum 100 characters, Maximum 200 characters. 
            Focus on subject, environment, lighting, and mood.
          - keywords: An array of exactly ${keywordCount || 40} highly relevant, single-word keywords.
          - categories: Precisely 2 most relevant categories from the provided list. 
            You must analyze the subject carefully to pick the most accurate categories.
          
          ENFORCED CATEGORY LIST:
          [Abstract, Animals/Wildlife, Arts, Backgrounds/Textures, Beauty/Fashion, Buildings/Landmarks, Business/Finance, Celebrities, Education, Food and drink, Healthcare/Medical, Holidays, Industrial, Interiors, Miscellaneous, Nature, Objects, Parks/Outdoor, People, Religion, Science, Signs/Symbols, Sports/Recreation, Technology, Transportation, Vintage]
          
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
    if (!text) {
      throw new Error("Empty response from Mistral");
    }

    const result = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Mistral Error:", error);
    const errorMessage = error.message || "Failed to generate metadata";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
