// app.js - Main application logic, DOM manipulation, and event handling

// Import functions from api.js
import { getModels, pullModel, sendChatMessage } from './api.js';

// DOM Elements
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt-input");
const sendButton = document.getElementById("send-btn");
const modelSelect = document.getElementById("model-select");
const pullModelInput = document.getElementById("pull-model-input");
const pullModelBtn = document.getElementById("pull-model-btn");
const pullStatus = document.getElementById("pull-status");
const ragToggle = document.getElementById("rag-toggle");
const ragStatus = document.getElementById("rag-status"); // New element for RAG status

let conversationHistory = []; // Stores the chat history for context

// --- UI Utility Functions ---

/**
 * Adds a message to the chat window.
 * @param {string} text The message content.
 * @param {"user" | "ai"} sender The sender of the message.
 * @returns {HTMLElement} The created message element.
 */
function addMessage(text, sender) { 
    const el = document.createElement("div"); 
    el.classList.add("message", `${sender}-message`); 
    el.innerText = text; 
    chatWindow.appendChild(el); 
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return el; 
}

/**
 * Toggles the enabled state of the chat input and send button.
 * Also updates the send button's content to show a loader when disabled.
 * @param {boolean} isEnabled True to enable, false to disable.
 */
function toggleForm(isEnabled) { 
    promptInput.disabled = !isEnabled; 
    sendButton.disabled = !isEnabled; 
    if (isEnabled) { 
        promptInput.focus(); 
        sendButton.innerHTML = 'Send'; 
    } else { 
        sendButton.innerHTML = '<div class="loader"></div>'; 
    } 
}

/**
 * Updates the pull status display.
 * @param {string} statusText The text to display.
 */
function updatePullStatus(statusText) {
    pullStatus.style.display = 'block';
    if (pullStatus.innerText.length === 0 || !pullStatus.innerText.includes("Starting pull")) {
        pullStatus.innerText = statusText;
    } else {
        pullStatus.innerText += `\n${statusText}`;
    }
    pullStatus.scrollTop = pullStatus.scrollHeight;
}

/**
 * Updates the RAG search status display.
 * @param {string} statusText The text to display.
 * @param {boolean} isLoading True to show loader, false to hide.
 */
function updateRagStatus(statusText, isLoading) {
    ragStatus.innerText = statusText;
    ragStatus.style.display = isLoading || statusText ? 'block' : 'none';
    if (isLoading) {
        // Add loader specific to RAG status if it's loading
        ragStatus.innerHTML = `${statusText} <span class="loader"></span>`;
    }
}


// --- Event Handlers ---

/**
 * Populates the model selection dropdown.
 */
async function handlePopulateModels() {
    try {
        const models = await getModels();
        modelSelect.innerHTML = '';
        if (models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.innerText = model.name;
                modelSelect.appendChild(option);
            });
            modelSelect.selectedIndex = 0;
        } else {
            addMessage("No models available. Pull a model using the controls above.", "ai");
        }
    } catch (error) {
        addMessage(error.message, "ai");
    }
}

/**
 * Handles the "Pull Model" button click.
 */
async function handlePullModel() {
    const modelToPull = pullModelInput.value.trim();
    if (!modelToPull) return;

    pullModelBtn.disabled = true;

    try {
        await pullModel(modelToPull, updatePullStatus);
        await handlePopulateModels();
        addMessage(`Model "${modelToPull}" pulled successfully!`, "ai");
    } catch (error) {
        updatePullStatus(`\nError: ${error.message}`);
        addMessage(`Error pulling model "${modelToPull}": ${error.message}`, "ai");
    } finally {
        pullModelInput.value = '';
        pullModelBtn.disabled = false;
        setTimeout(() => { pullStatus.style.display = 'none'; }, 5000);
    }
}

/**
 * Handles the user submitting a chat message.
 * @param {Event} e The submit event.
 */
async function handleChatSubmit(e) {
    e.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt || sendButton.disabled) return;

    const selectedModel = modelSelect.value;
    if (!selectedModel) {
        addMessage("Please select a model from the dropdown first.", "ai");
        return;
    }

    const enableRagSearch = ragToggle.checked;

    addMessage(prompt, "user");
    // Important: Only add the user's latest message to history *after* it's been processed by RAG,
    // or keep a separate history for display vs. what's sent to Ollama.
    // For simplicity, we'll keep adding the raw user message to `conversationHistory`.
    // The RAG backend will decide how to use this history to build the full prompt for Ollama.
    conversationHistory.push({ role: "user", content: prompt }); 
    
    promptInput.value = "";
    promptInput.style.height = 'auto';
    toggleForm(false);
    
    const aiMessageElement = addMessage("...", "ai");
    let currentAiResponse = "";

    try {
        const fullResponse = await sendChatMessage(
            selectedModel, 
            conversationHistory, 
            (chunk) => { // onChunkReceived callback
                currentAiResponse += chunk;
                aiMessageElement.innerText = currentAiResponse;
                chatWindow.scrollTop = chatWindow.scrollHeight;
            },
            enableRagSearch, // Pass RAG state
            updateRagStatus // Pass search status update callback
        );
        
        conversationHistory.push({ role: "assistant", content: fullResponse });
        
    } catch (error) {
        console.error("Error during chat:", error);
        aiMessageElement.innerText = `Error: ${error.message}`;
        aiMessageElement.style.color = '#ff8a80';
    } finally {
        toggleForm(true);
        updateRagStatus("", false); // Clear RAG status at the end
    }
}

// --- Event Listeners ---
chatForm.addEventListener("submit", handleChatSubmit);

promptInput.addEventListener('input', () => { 
    promptInput.style.height = 'auto'; 
    promptInput.style.height = `${promptInput.scrollHeight}px`; 
});

promptInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        chatForm.dispatchEvent(new Event('submit')); 
    } 
});

pullModelBtn.addEventListener('click', handlePullModel);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    handlePopulateModels();
    addMessage("Welcome! Select an available model or pull a new one to begin. Toggle 'Enable RAG' for internet search capabilities.", "ai");
});