
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const BATCHES_URL =
  "https://rarestudy.github.io/rarestudy/batches.json";

const STUDY_URL =
  "https://pwthor.live/study/batches/";

let cachedBatches = null;
let cacheTime = 0;

// Find batches in JSON
function findArray(value, depth = 0) {
  if (depth > 7 || value == null) return [];

  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === "object") {
      return value;
    }

    for (const item of value) {
      const found = findArray(item, depth + 1);
      if (found.length) return found;
    }

    return value;
  }

  if (typeof value === "object") {
    const keys = [
      "batches",
      "data",
      "results",
      "courses",
      "items",
      "payload"
    ];

    for (const key of keys) {
      if (key in value) {
        const found = findArray(value[key], depth + 1);
        if (found.length) return found;
      }
    }

    for (const item of Object.values(value)) {
      const found = findArray(item, depth + 1);
      if (found.length) return found;
    }
  }

  return [];
}

// Get first available field
function first(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return value;
    }
  }

  return "";
}

// Convert batch data
function normalizeBatch(batch, index) {
  const id = first(batch, [
    "id",
    "_id",
    "batch_id",
    "batchId",
    "course_id",
    "courseId",
    "slug"
  ]);

  const title = first(batch, [
    "name",
    "title",
    "batch_name",
    "batchName",
    "course_name",
    "courseName"
  ]) || `Batch ${index + 1}`;

  const image = first(batch, [
    "image",
    "thumbnail",
    "banner",
    "cover",
    "image_url",
    "thumbnail_url",
    "banner_url"
  ]);

  const description = first(batch, [
    "description",
    "subtitle",
    "details"
  ]) || "";

  return {
    id: String(id || ""),
    title: String(title),
    image: String(image || ""),
    description: String(description)
  };
}

// Batches API
app.get("/api/batches", async (req, res) => {
  try {
    if (
      cachedBatches &&
      Date.now() - cacheTime < 5 * 60 * 1000
    ) {
      return res.json({ batches: cachedBatches });
    }

    const response = await fetch(BATCHES_URL);

    if (!response.ok) {
      throw new Error("Batch source error: " + response.status);
    }

    const raw = await response.json();

    const rows = findArray(raw);

    const batches = rows
      .map(normalizeBatch)
      .filter(batch => batch.id || batch.title);

    cachedBatches = batches;
    cacheTime = Date.now();

    res.json({ batches });

  } catch (error) {
    console.error("Batch Error:", error.message);

    res.status(502).json({
      error: "Batches load nahi ho paaye. Source JSON check karein."
    });
  }
});

// Open selected batch
app.get("/api/study/:id", (req, res) => {
  const id = encodeURIComponent(req.params.id);

  res.redirect(302, STUDY_URL + id);
});

// Educational AI API
app.post("/api/ai", async (req, res) => {
  const question = String(
    req.body?.message || ""
  ).trim();

  if (!question) {
    return res.status(400).json({
      error: "Question likhein."
    });
  }

  if (
    !process.env.AI_API_URL ||
    !process.env.AI_API_KEY ||
    !process.env.AI_MODEL
  ) {
    return res.json({
      reply: "AI Support abhi configure nahi hai."
    });
  }

  try {
    const response = await fetch(
      process.env.AI_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.AI_API_KEY}`
        },

        body: JSON.stringify({
          model: process.env.AI_MODEL,

          messages: [
            {
              role: "system",
              content:
                "You are Prep Master educational doubt support. Answer study questions clearly and appropriately."
            },
            {
              role: "user",
              content: question
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error("AI provider error");
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.reply ||
      "Answer nahi mila.";

    res.json({ reply });

  } catch (error) {
    console.error("AI Error:", error.message);

    res.status(502).json({
      error: "AI service se response nahi mila."
    });
  }
});

// Community Chat
const recentMessages = [];

io.on("connection", socket => {

  socket.emit("chat-history", recentMessages);

  socket.on("chat-message", payload => {

    const username = String(
      payload?.username || "Student"
    ).trim().slice(0, 24);

    const message = String(
      payload?.message || ""
    ).trim().slice(0, 1000);

    if (!message) return;

    const item = {
      username,
      message,
      time: new Date().toISOString()
    };

    recentMessages.push(item);

    if (recentMessages.length > 100) {
      recentMessages.shift();
    }

    io.emit("chat-message", item);
  });
});

// Start Server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `Prep Master running on port ${PORT}`
  );
});
              
