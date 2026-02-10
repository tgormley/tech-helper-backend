import OpenAI from "openai";

export default async function handler(req, res) {
  // Allow CORS from any origin (for testing; you can restrict later)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const form = await req.formData();
    const message = form.get("message") || "";
    const mode = form.get("mode") || "step_by_step";
    const device = form.get("device") || "unknown";
    const topic = form.get("topic") || "";

    let userText = `User: ${message}\nDevice: ${device}\nMode: ${mode}\nTopic: ${topic}`;
    const hasImage = form.has("screenshot");

    let content = [
      { type: "text", text: userText + (hasImage ? "\n\nAnalyze the uploaded screenshot: describe text, buttons, errors, icons, and relate to problem." : "") },
    ];

    if (hasImage) {
      const file = form.get("screenshot");
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      content.push({
        type: "image_url",
        image_url: { url: `data:${file.type};base64,${base64}` },
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are Tech Helper for Seniors: friendly, patient, calm, trustworthy. Use simple plain English. Short sentences. No jargon. Never ask for passwords/personal info. Reassure gently. Warn softly about scams if relevant.\n\nOutput ONLY valid JSON — no extra text.\n\nIf mode=='step_by_step' and fixable, use: {\"type\":\"guided_fix\",\"title\":\"Short title\",\"diagnosis\":\"1 sentence what's wrong\",\"steps\":[{\"step\":1,\"text\":\"One action\"}],\"followup_question\":\"One question next\"}\nElse: {\"type\":\"chat\",\"message\":\"Short answer\"}\nMax 5 steps. Base on screenshot if provided."
        },
        { role: "user", content },
      ],
    });

    const raw = completion.choices[0].message.content.trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const json = JSON.parse(cleaned);

    res.status(200).json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ type: "chat", message: "Sorry, something went wrong. Try again?" });
  }
}

export const config = { api: { bodyParser: false } };
