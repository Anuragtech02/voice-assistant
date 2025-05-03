// server.js - Enhanced Express server to proxy requests to multiple AI APIs, restricted to provided data
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
const port = process.env.PORT || 3000;

// --- START: Nuclei Data ---
const NUCLEI_DATA = `
What is Nuclei?
Nuclei is a B2B company that provides banks and telcos with customised ecosystems to engage their customers beyond banking services. Nuclei is a digital banking ecosystem provider that integrates third-party products and services into banks' existing digital platforms, enhancing customer engagement, loyalty, and revenue streams.

What segments or ecosystems does Nuclei power?
Nuclei’s ecosystems are customised for the below Segments and any more that can be defined by customer behaviour or any demographic or any identifiable parameters.
- Retail
- Premium
- Expat
- Salaried
- Seniors
- SMB
- Corporate
- Youth
- Gig workers
- CXO

Which regions does Nuclei operate in?
Operational regions:
- India
- Southeast Asia
- Europe
- Middle East
- Exploring other regions and open to expansion

What objectives do Nuclei’s solutions help with?
Nuclei’s solutions help with a range of objectives including hyper-personalisation, customer engagement,  additional revenue streamand ecosystem creation tailored specifically to client segments.

What technology does Nuclei use? Or how are nuclei’s ecosystems integrated into a bank’s platform?
Nuclei provides seamless integration through APIs, enabling banks to offer their customers an array of digital services like travel bookings, shopping, entertainment, and more, directly from the bank's app or website.

What services do Nuclei’s ecosystems provide?
Nuclei has partnered with 250+ trusted, international partners and can power any service of choice ranging from recharge in 80+ countries, travel bookings (flights, hotels), concierge, SaaS tools, etc. Nuclei co-builds these ecosystems with the bank to suit the needs of its customers. So, even if the bank wants a particular partner or service, Nuclei can onboard them instantaneously. Nuclei can also integrate bank’s existing partners on to the platform for a single access experience for customers.

Is the user interface, branding etc customisable?
Yes, all services integrated through Nuclei are fully customizable to align with the bank's branding and customer experience standards.

How long does it take to integrate Nuclei’s solutions?
Integration timelines vary based on the complexity of the services required, typically ranging from a few weeks to a couple of months.

What security measures have Nuclei taken to match the banking regulations and compliance needs?
Nuclei adheres to industry-standard security protocols, including encryption, secure API communication, regular vulnerability assessments, penetration testing, and compliance with global regulatory standards like GDPR and PCI DSS.

Is Nuclei GDPR Compliant?
Nuclei operates on a strict data minimization policy. Typically, data remains hosted securely within the bank’s infrastructure, and Nuclei processes only necessary transactional data with clear, secure mechanisms. We have also GDPR compliant.

What about compliance and security?
Yes, Nuclei maintains compliance with all relevant banking and financial services regulations, ensuring banks can safely integrate and operate third-party ecosystems. It is also ISO certified.

Is Nuclei’s technology current and up to date?
Nuclei employs REST APIs, microservices architecture, cloud-native technologies, and containerized deployments, ensuring scalability, reliability, and seamless integration.

What kind of support does Nuclei provide its customers?
Nuclei guarantees high service availability with rigorous SLA standards, comprehensive monitoring, proactive incident management, and fail-safe redundancies.

What value can banks expect by integrating Nuclei’s ecosystems?
By integrating digital services, banks can monetize through customer transactions, enhanced engagement, and cross-selling of products and services. For more details write to us at info@gonuclei.com
Banks report increased customer engagement, improved customer loyalty, higher transaction volumes, expanded revenue streams, and enriched digital customer experiences.

How does Nuclei adapt to the changing landscape?
Nuclei continuously works on enhancing its platform and solutions to improve efficiency, customer experience, technology upgrade, and optimal platform performance.

How does Nuclei handle feature integrations and updates?
Updates and feature integrations to the ecosystems are handled efficiently through modular microservices, allowing quick deployments with minimal disruption to existing services.
`;
// --- END: Nuclei Data ---

// --- START: AI Instructions ---
const AI_INSTRUCTIONS = `You are an assistant specifically designed to answer questions about Nuclei based *only* on the provided context below.
Do *not* use any information outside of this context.
Do *not* make assumptions or infer information not explicitly stated.
If the answer cannot be found in the provided context, respond with "Based on the provided information, I cannot answer that question."
Keep your answers concise and directly related to the user's question, using only the provided text.

CONTEXT:
---
${NUCLEI_DATA}
---
`;
// --- END: AI Instructions ---

// Configure CORS - Recommended: Replace "*" with your specific Webflow domain in production
app.use(
  cors({
    origin: "*", // Example: "https://your-webflow-site.webflow.io"
    methods: ["POST", "GET", "OPTIONS"],
  }),
);

app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Generative AI
const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Route to check server status
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Route to proxy requests to AI APIs (modified for restricted context)
app.post("/api/chat", async (req, res) => {
  try {
    const { message, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let responseText;

    // The user's actual question
    const userQuestion = message;

    if (model === "gemini") {
      // Construct the prompt for Gemini
      const geminiPrompt = `${AI_INSTRUCTIONS}\nUSER QUESTION:\n${userQuestion}`;
      responseText = await callGeminiAPI(geminiPrompt);
    } else {
      // Default to OpenAI
      // Construct the messages array for OpenAI
      const openAIMessages = [
        {
          role: "system",
          content: AI_INSTRUCTIONS, // System prompt contains instructions and context
        },
        {
          role: "user",
          content: userQuestion, // User's actual question
        },
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: openAIMessages,
        max_tokens: 300, // Adjust as needed, but keep reasonable for concise answers
        temperature: 0.3, // Lower temperature for more factual, less creative responses
      });

      responseText = completion.choices[0].message.content;
    }

    // Clean up potential refusal prefixes if the model adds them unnecessarily
    responseText = responseText.replace(
      /^Based on the provided information, I cannot answer that question\.\s*/i,
      "",
    ); // Remove prefix if answer follows
    if (
      responseText.trim() ===
      "Based on the provided information, I cannot answer that question."
    ) {
      // Keep the refusal if it's the *only* response
    }

    return res.json({
      response: responseText.trim(), // Trim whitespace
      model: model || "openai",
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({
      error: "Failed to process your request",
      details: error.message,
      model: req.body.model || "openai",
    });
  }
});

// Helper function to call Google Gemini API (modified to accept full prompt)
async function callGeminiAPI(fullPrompt) {
  // Renamed parameter
  try {
    const model = googleAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5 flash as it's good and cost-effective

    const safetySettings = [
      // Keep safety settings
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

    const result = await model.generateContent({
      // Send the entire constructed prompt as a single user message
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.3, // Lower temperature for factual answers
        maxOutputTokens: 300, // Adjust as needed
      },
      safetySettings,
    });

    const response = result.response;
    // Add robust check for blocked content or missing text
    if (
      !response ||
      !response.candidates ||
      response.candidates.length === 0 ||
      !response.candidates[0].content ||
      !response.candidates[0].content.parts ||
      response.candidates[0].content.parts.length === 0
    ) {
      if (
        response &&
        response.promptFeedback &&
        response.promptFeedback.blockReason
      ) {
        console.warn(
          `Gemini request blocked. Reason: ${response.promptFeedback.blockReason}`,
        );
        return "My response was blocked due to safety settings.";
      } else {
        console.warn("Gemini response structure unexpected or empty.");
        // Fallback message or re-throw error might be needed depending on desired behavior
        return "Sorry, I encountered an issue generating the response.";
      }
    }
    return response.text(); // Use the built-in text() method
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Check if the error is due to safety settings
    if (error.message && error.message.includes("SAFETY")) {
      return "My response was blocked due to safety settings.";
    }
    throw error; // Re-throw other errors to be caught by the main handler
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
