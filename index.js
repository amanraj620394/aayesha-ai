require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const VERIFY_TOKEN = "instagram_ai_secret";
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

// Home
app.get("/", (req, res) => {
    res.send("Aaysha Instagram AI is running!");
});

// Meta webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        return res.status(200).send(challenge);
    }

    res.sendStatus(403);
});

// Instagram DM receive
app.post("/webhook", async (req, res) => {
    console.log("\n📩 Instagram message received:");
    console.log(JSON.stringify(req.body, null, 2));

    res.sendStatus(200);

    try {
        const entry = req.body.entry?.[0];
        const messaging = entry?.messaging?.[0];

        if (!messaging?.message?.text) return;

        const senderId = messaging.sender.id;
        const userMessage = messaging.message.text;

        console.log("👤 User:", userMessage);

        // Gemini AI
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: `
You are Aaysha, a funny, confident and slightly teasing Instagram girl.

Style:
- Reply naturally like a real person
- Short replies, usually 1-2 sentences
- Funny and playful
- Light flirting is okay
- Do not be overly romantic
- Do not use vulgar or explicit sexual language
- Use emojis naturally
- Never mention that you are an AI or bot

User message:
${userMessage}
`
        });

        const reply = response.text.trim();

        console.log("🤖 Aaysha:", reply);

        // Send reply to Instagram
        const result = await fetch(
            "https://graph.instagram.com/v23.0/me/messages",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${INSTAGRAM_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    recipient: {
                        id: senderId
                    },
                    message: {
                        text: reply
                    }
                })
            }
        );

        const data = await result.json();

        console.log("📤 Instagram reply result:");
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("❌ Error:", error);
    }
});

// Start server
app.listen(3000, () => {
    console.log("🚀 Aaysha AI running on http://localhost:3000");
});