import express from "express";
import Thread from "../models/Thread.js";
import getGeminiAPIResponse from "../utils/openai.js";

const router = express.Router();


// ==========================================
// 1. TEST DATABASE CONNECTION
// ==========================================
router.post("/test", async (req, res) => {
    try {
        const thread = new Thread({
            threadId: "abc",
            title: "Testing New Thread2"
        });

        const response = await thread.save();

        return res.status(201).json(response);

    } catch (err) {
        console.error("Test route error:", err.message);

        return res.status(500).json({
            error: "Failed to save in database",
            details: err.message
        });
    }
});


// ==========================================
// 2. GET ALL THREADS
// ==========================================
router.get("/thread", async (req, res) => {
    try {
        const threads = await Thread.find({})
            .sort({ updatedAt: -1 });

        return res.status(200).json(threads);

    } catch (err) {
        console.error("Fetch threads error:", err.message);

        return res.status(500).json({
            error: "Failed to fetch threads"
        });
    }
});


// ==========================================
// 3. GET MESSAGES FROM A SPECIFIC THREAD
// ==========================================
router.get("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;

    try {
        const thread = await Thread.findOne({ threadId });

        if (!thread) {
            return res.status(404).json({
                error: "Thread not found"
            });
        }

        return res.status(200).json(thread.messages);

    } catch (err) {
        console.error("Fetch chat error:", err.message);

        return res.status(500).json({
            error: "Failed to fetch chat"
        });
    }
});


// ==========================================
// 4. DELETE A SPECIFIC THREAD
// ==========================================
router.delete("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;

    try {
        const deletedThread = await Thread.findOneAndDelete({
            threadId
        });

        if (!deletedThread) {
            return res.status(404).json({
                error: "Thread not found"
            });
        }

        return res.status(200).json({
            success: "Thread deleted successfully"
        });

    } catch (err) {
        console.error("Delete thread error:", err.message);

        return res.status(500).json({
            error: "Failed to delete thread"
        });
    }
});


// ==========================================
// 5. SEND MESSAGE AND RECEIVE GEMINI RESPONSE
// ==========================================
router.post("/chat", async (req, res) => {
    const { threadId, message } = req.body;

    // Validate request
    if (
        typeof threadId !== "string" ||
        !threadId.trim() ||
        typeof message !== "string" ||
        !message.trim()
    ) {
        return res.status(400).json({
            error: "A valid threadId and message are required"
        });
    }

    const cleanThreadId = threadId.trim();
    const cleanMessage = message.trim();

    try {
        console.log("Received chat message");

        // Find the existing thread
        let thread = await Thread.findOne({
            threadId: cleanThreadId
        });

        // Create a thread if it doesn't exist
        if (!thread) {
            try {
                thread = await Thread.create({
                    threadId: cleanThreadId,
                    title: cleanMessage,
                    messages: []
                });
            } catch (err) {
                // Another request may have created this thread
                // between findOne() and Thread.create().
                if (err.code !== 11000) {
                    throw err;
                }

                thread = await Thread.findOne({
                    threadId: cleanThreadId
                });

                if (!thread) {
                    throw err;
                }
            }
        }

        // Save the user's message
        thread.messages.push({
            role: "user",
            content: cleanMessage
        });

        thread.updatedAt = new Date();

        await thread.save();

        // Request a response from Gemini
        const assistantReply = await getGeminiAPIResponse(
            cleanMessage
        );

        if (
            typeof assistantReply !== "string" ||
            !assistantReply.trim()
        ) {
            throw new Error("Gemini returned an empty response");
        }

        // Find the latest thread document before saving the reply
        thread = await Thread.findOne({
            threadId: cleanThreadId
        });

        if (!thread) {
            throw new Error("Thread no longer exists");
        }

        // Save Gemini's response
        thread.messages.push({
            role: "assistant",
            content: assistantReply.trim()
        });

        thread.updatedAt = new Date();

        await thread.save();

        console.log("Gemini response received and saved");

        return res.status(200).json({
            reply: assistantReply.trim()
        });

    } catch (err) {
        console.error("Chat route error:", err.message);

        return res.status(500).json({
            error: "Failed to generate AI response",
            details: err.message
        });
    }
});


// ==========================================
// EXPORT ROUTER
// ==========================================
export default router;