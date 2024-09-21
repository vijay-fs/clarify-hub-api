const express = require("express");
const OpenAI = require("openai"); // Import OpenAI
const dotenv = require("dotenv");
const puppeteer = require("puppeteer");

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is set correctly in your .env file
});

// Middleware to parse JSON request bodies
app.use(express.json());

// Function to generate an image from Mermaid text using Puppeteer
async function generateMermaidImage(mermaidText) {
  const browser = await puppeteer.launch({
       headless: true,
    executablePath: process.env.CHROME_BIN || null, // Use CHROME_BIN environment variable if set
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-extensions"
    ]
  });
  const page = await browser.newPage();

  // Mermaid HTML template for rendering
  const mermaidHTML = `
  <html>
    <head>
      <style>
        body { margin: 0; padding: 0; }
        #container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        #mermaid { width: 800px; height: 600px; }
      </style>
      <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@9/dist/mermaid.esm.min.mjs';
        window.onload = () => {
          mermaid.initialize({ startOnLoad: true });
          const diagram = \`${mermaidText}\`;
          mermaid.render("mermaidChart", diagram, (svgCode) => {
            document.getElementById('mermaid').innerHTML = svgCode;
          });
        };
      </script>
    </head>
    <body>
      <div id="container">
        <div id="mermaid"></div>
      </div>
    </body>
  </html>`;

  // Set the content of the page
  await page.setContent(mermaidHTML, { waitUntil: "networkidle0" });

  // Wait for the Mermaid chart to render
  await page.waitForSelector("#mermaid");

  // Take a screenshot and save it as a base64 string
  const screenshot = await page.screenshot({ encoding: "base64" });

  // Close the browser
  await browser.close();

  return screenshot;
}

// POST route to handle the prompt and generate a Mermaid flowchart image
app.post("/generate-flowchart-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Use OpenAI to generate the Mermaid diagram text
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Generate a mermaid flowchart based on the content provided below in the exact format, including all the indentations and spaces as shown here:

flowchart TD
    A[Alternative Communication App] -->|Uses symbols and images| B(Helps non-verbal individuals communicate)
    C[Volunteer Connector] -->|Links volunteers with people| D(Assistance in daily tasks)
    D -->|Examples| E[Grocery shopping]
    D -->|Examples| F[Reading mail]
    G[Accessible Language Learning] -->|Designed with accessibility features| H(Includes voice control, captions, and simplified interfaces)
    I[Dietary Scanner] -->|Scans product barcodes| J(Alerts users of allergens)
    J -->|Also alerts| K[Dietary restrictions]
    
Based on this content:

${prompt}

Please output the flowchart exactly in the format above, preserving all indentations and spaces, and do not include any other text or explanation.`
        },
      ],
      model: "gpt-4", // Use "gpt-4" model if available in your account, otherwise "gpt-3.5-turbo" or another supported model
      max_tokens: 300, // Adjust as needed
      temperature: 0.2, // Low temperature for more deterministic output
    });

    // Extract the generated flowchart text from the OpenAI response
    const flowchartText = chatCompletion.choices[0].message.content.trim();
function formatFlowchart(flowchartText) {
  // Remove the mermaid code block markers
  const formattedText = flowchartText
    .replace(/```mermaid/g, '') // Remove starting mermaid code block marker
    .replace(/```/g, '') // Remove ending code block marker
    .trim(); // Remove any leading and trailing whitespace
  
  return formattedText;
}

    // Generate a base64-encoded image of the flowchart using the Mermaid text
    const base64Image = await generateMermaidImage(formatFlowchart(flowchartText));

    // Send the base64 image as the response
    res.json({ image: base64Image});
  } catch (error) {
    console.error("Error generating flowchart image:", error);  
    res.status(500).json({ error: "Failed to generate flowchart image" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
