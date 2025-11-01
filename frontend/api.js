// api.js - Handles all interactions with the Ollama API and now, your RAG backend

// IMPORTANT: OLLAMA_BASE_URL should point to your backend server's URL if it's handling RAG,
// or the Ollama server directly if your frontend makes direct Ollama calls AND RAG is separate.
// For this setup, we'll assume a new RAG_BACKEND_URL for the RAG specific endpoint.
const OLLAMA_DIRECT_URL = `${window.location.origin}`; // For direct Ollama calls (getModels, pullModel)
const RAG_BACKEND_URL = `${window.location.origin}`; // Assuming your backend serves at the same origin, e.g., /api/rag-chat

// --- Ollama Core API Functions (mostly unchanged, except for chat which moves to RAG if enabled) ---

/**
 * Fetches the list of available models from the Ollama server.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of model objects.
 */
export async function getModels() {
    try {
        const response = await fetch(`${OLLAMA_DIRECT_URL}/api/tags`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error("Error fetching models:", error);
        throw new Error(`Error connecting to Ollama or fetching models: ${error.message}. Make sure the Docker container is running and CORS is configured correctly.`);
    }
}

/**
 * Initiates pulling a new model from Ollama.
 * This function handles streaming responses and calls a callback for status updates.
 * @param {string} modelName The name of the model to pull (e.g., 'phi3').
 * @param {Function} onStatusUpdate Callback function for status updates: (statusText) => void.
 * @returns {Promise<void>} A promise that resolves when the pull is complete or rejects on error.
 */
export async function pullModel(modelName, onStatusUpdate) {
    if (!modelName) throw new Error("Model name cannot be empty.");

    onStatusUpdate(`Starting pull for "${modelName}"...`);

    try {
        const response = await fetch(`${OLLAMA_DIRECT_URL}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: true }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    let statusText = parsed.status;
                    if (parsed.total && parsed.completed) {
                        const percent = Math.round((parsed.completed / parsed.total) * 100);
                        statusText += ` - ${percent}%`;
                    }
                    onStatusUpdate(statusText);
                } catch (jsonError) {
                    console.warn("Could not parse JSON line from pull stream:", line, jsonError);
                }
            }
        }
        onStatusUpdate("Pull complete!");
    } catch (error) {
        console.error("Error pulling model:", error);
        throw new Error(`Error pulling model: ${error.message}`);
    }
}

/**
 * Sends a chat message to the Ollama server. If RAG is enabled, it sends the request
 * to a backend RAG endpoint which handles the Brave Search and prompt augmentation.
 * @param {string} modelName The name of the model to use for the chat.
 * @param {Array<Object>} messages An array of message objects { role: "user" | "assistant", content: string }.
 * @param {Function} onChunkReceived Callback function for each content chunk: (contentChunk) => void.
 * @param {boolean} enableRAG If true, uses the RAG backend.
 * @param {Function} onSearchStatusUpdate Callback function for search status: (statusText, isLoading) => void.
 * @returns {Promise<string>} A promise that resolves to the full AI response when complete.
 */
export async function sendChatMessage(modelName, messages, onChunkReceived, enableRAG = false, onSearchStatusUpdate = () => {}) {
    if (!modelName) throw new Error("No model selected.");
    if (!messages || messages.length === 0) throw new Error("No messages provided for chat.");

    const lastUserMessage = messages.findLast(m => m.role === 'user')?.content;
    if (!lastUserMessage) throw new Error("Cannot determine last user message for RAG or direct chat.");

    const endpoint = enableRAG ? `${RAG_BACKEND_URL}/api/rag-chat` : `${OLLAMA_DIRECT_URL}/api/chat`;
    
    // For RAG, we explicitly send the userQuery for the backend to use for search
    // The backend will then construct the full prompt with context before sending to Ollama.
    const requestBody = enableRAG 
        ? { model: modelName, messages: messages, userQuery: lastUserMessage, stream: true }
        : { model: modelName, messages: messages, stream: true };

    if (enableRAG) {
        onSearchStatusUpdate("Searching the web...", true); // Show search indicator
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) { 
            const errorData = await response.json().catch(() => response.text());
            throw new Error(`HTTP error! Status: ${response.status} - ${JSON.stringify(errorData)}`); 
        }

        if (enableRAG) {
            onSearchStatusUpdate("Search complete, generating response.", false); // Update status once search is done (backend has started Ollama)
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    // The backend should return standard Ollama chat format or similar.
                    // If your backend returns other info, adjust parsing here.
                    const content = parsed.message?.content;
                    if (content) {
                        fullResponse += content;
                        onChunkReceived(content);
                    }
                } catch (jsonError) {
                    console.warn("Could not parse JSON line from chat stream:", line, jsonError);
                    // It's possible the backend sends other non-JSON status messages.
                    // You might need to handle these differently or ensure your backend only streams JSON.
                    // For now, we'll log a warning.
                }
            }
        }
        return fullResponse;
    } catch (error) {
        console.error("Error during chat:", error);
        throw new Error(`Error during chat: ${error.message}`);
    } finally {
        if (enableRAG) {
            onSearchStatusUpdate("", false); // Clear RAG status at the end
        }
    }
}