import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const form = await req.formData(); // Handles multipart
  const message = form.get("message") || "";
  const mode = form.get("mode") || "step_by_step";
  const device = form.get("device") || "unknown";
  const topic = form.get("topic") || "";

  let userText = `User: ${message}\nDevice: ${device}\nMode: ${mode}\nTopic: ${topic}`;
  const hasImage = form.has("screenshot");

  let content = [
    { type: "text", text: userText + (hasImage ? "\n\nAnalyze the uploaded screenshot carefully: describe visible text, buttons, errors, icons, and relate it to the problem." : "") },
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Tech Helper for Seniors: friendly, patient, calm, trustworthy. Use only simple plain English. Short sentences. No jargon. Never ask for passwords/personal info. Reassure gently. Warn softly about scams if relevant.

Output ONLY valid JSON — no extra text, markdown, or explanations.

If mode=='step_by_step' and it's fixable, use:
{"type":"guided_fix","title":"Short title","diagnosis":"1 sentence what's wrong","steps":[{"step":1,"text":"One action"},{"step":2,"text":"Next action"}],"followup_question":"One question next"}

Else use:
{"type":"chat","message":"Short plain answer"}

Max 5 steps, each 1 action. Always end guided_fix with followup. Base on screenshot if provided.`
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
    res.status(500).json({ type: "chat", message: "Sorry, something went wrong. Try describing it again?" });
  }
}

export const config = { api: { bodyParser: false } };
