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

// ===============================
// Conversation Memory
// ===============================

const conversations = new Map();

const MEMORY_TIME = 2 * 60 * 60 * 1000; // 2 hours
const MAX_MESSAGES = 40; // Maximum messages kept per person


// ===============================
// Home
// ===============================

app.get("/", (req, res) => {
    res.send("Aaysha Instagram AI is running!");
});


// ===============================
// Meta Webhook Verification
// ===============================

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


// ===============================
// Instagram DM Receive
// ===============================

app.post("/webhook", async (req, res) => {

    console.log("\n📩 Instagram message received:");
    console.log(JSON.stringify(req.body, null, 2));

    // Immediately tell Meta that webhook was received
    res.sendStatus(200);

    try {

        const entry = req.body.entry?.[0];
        const messaging = entry?.messaging?.[0];

        if (!messaging?.message?.text) {
            return;
        }

        // Ignore messages sent by Aaysha herself
        if (messaging.message.is_echo) {
            return;
        }

        const senderId = messaging.sender?.id;
        const userMessage = messaging.message.text;

        if (!senderId || !userMessage) {
            return;
        }

        console.log("👤 User:", userMessage);


        // ===============================
        // Get Existing Memory
        // ===============================

        let history = conversations.get(senderId) || [];

        const now = Date.now();

        // Remove messages older than 2 hours
        history = history.filter(
            msg => now - msg.time < MEMORY_TIME
        );


        // Add user's new message
        history.push({
            role: "user",
            text: userMessage,
            time: now
        });


        // Keep memory limited
        if (history.length > MAX_MESSAGES) {
            history = history.slice(-MAX_MESSAGES);
        }


        // ===============================
        // Prepare Conversation History
        // ===============================

        const conversationText = history
            .map(msg => {
                const name = msg.role === "user" ? "User" : "Aaysha";
                return `${name}: ${msg.text}`;
            })
            .join("\n");


        // ===============================
        // Gemini AI
        // ===============================

        const response = await ai.models.generateContent({

            model: "gemini-3.6-flash",

            contents: `
You are Aaysha, a funny, confident and slightly teasing Instagram girl.

Your personality:
- Natural and human-like
- Funny and playful
- Confident
- Slightly teasing
- Light flirting is okay
- Do not be overly romantic
- Do not use vulgar or explicit sexual language
- Use emojis naturally
- Keep replies short, usually 1-2 sentences
- Never say you are an AI, bot, assistant or language model
- Do not repeat the same reply unnecessarily
- Understand the ongoing conversation and reply according to the context

IMPORTANT:
The conversation below is the recent conversation with this person.
Use it to remember what they were talking about.

Recent conversation:
${conversationText}

Now reply naturally to the user's latest message.
`
        });


        const reply = response.text.trim();

        console.log("🤖 Aaysha:", reply);


        // ===============================
        // Save Aaysha's Reply to Memory
        // ===============================

        history.push({
            role: "assistant",
            text: reply,
            time: Date.now()
        });


        // Keep only recent messages
        history = history.filter(
            msg => Date.now() - msg.time < MEMORY_TIME
        );

        if (history.length > MAX_MESSAGES) {
            history = history.slice(-MAX_MESSAGES);
        }

        conversations.set(senderId, history);


        // ===============================
        // Send Reply to Instagram
        // ===============================

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


// ===============================
// Start Server
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Aaysha AI running on port ${PORT}`);

});
