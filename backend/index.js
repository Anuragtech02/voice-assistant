// server.js - Enhanced Express server to proxy requests to multiple AI APIs
const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 9001;

// Configure CORS to only allow requests from your Webflow domain
app.use(
  cors({
    origin: "*",
    methods: ["POST", "GET", "OPTIONS"],
  }),
);

app.use(express.json());

// Initialize OpenAI with your API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize the Google Generative AI client
const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Create a route to check server status
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Create a route to proxy requests to the appropriate AI API
app.post("/api/chat", async (req, res) => {
  try {
    const { message, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let responseText;

    // Call the appropriate AI API based on the selected model
    if (model === "gemini") {
      // Call Google Gemini API using the Google Generative AI SDK
      responseText = await callGeminiAPI(message);
    } else {
      // Default to OpenAI
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Provide concise and informative responses.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        max_tokens: 500,
      });

      responseText = completion.choices[0].message.content;
    }

    return res.json({
      response: responseText,
      model: model || "openai",
    });
  } catch (error) {
    console.error("Error processing request:", error);

    // Send an appropriate error response
    return res.status(500).json({
      error: "Failed to process your request",
      details: error.message,
      model: req.body.model || "openai",
    });
  }
});

// Helper function to call Google Gemini API using the SDK
async function callGeminiAPI(message) {
  try {
    // For text-only input, use the gemini-2.0-flash model
    const model = googleAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Configure safety settings
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
      safetySettings,
    });

    // Extract and return the text
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
