import { GoogleGenAI } from "@google/genai";

// Ensure the 'marked' library is available on the window object
declare const marked: {
  parse(markdown: string): string;
};

// --- DOM ELEMENTS ---
const form = document.getElementById("prompt-form") as HTMLFormElement;
const promptInput = document.getElementById("prompt-input") as HTMLTextAreaElement;
const responseContent = document.getElementById("response-content") as HTMLDivElement;
const submitButton = document.getElementById("submit-button") as HTMLButtonElement;
const buttonText = document.getElementById("button-text") as HTMLSpanElement;
const loader = document.getElementById("loader") as HTMLDivElement;
const starterButtons = document.querySelectorAll('.starter-btn');

// History Sidebar Elements
const historyToggleBtn = document.getElementById("history-toggle-btn") as HTMLButtonElement;
const historyList = document.getElementById("history-list") as HTMLUListElement;
const clearHistoryBtn = document.getElementById("clear-history-btn") as HTMLButtonElement;

// --- STATE ---
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
type HistoryItem = { query: string; response: string; };
let history: HistoryItem[] = [];


// --- HISTORY MANAGEMENT ---
const saveHistory = () => {
    localStorage.setItem('ai-policy-history', JSON.stringify(history));
};

const renderHistory = () => {
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<li class="empty-history">No history yet.</li>';
        return;
    }
    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = item.query;
        li.dataset.index = String(index);
        li.title = item.query;
        historyList.appendChild(li);
    });
};

const loadHistory = () => {
    const savedHistory = localStorage.getItem('ai-policy-history');
    history = savedHistory ? JSON.parse(savedHistory) : [];
    renderHistory();
};

const addToHistory = (query: string, response: string) => {
    if (history[0]?.query === query && history[0]?.response === response) return;

    history.unshift({ query, response });
    if (history.length > 50) { // Limit history size
        history.pop();
    }
    saveHistory();
    renderHistory();
};

const clearHistory = () => {
    if (confirm('Are you sure you want to clear the entire history? This action cannot be undone.')) {
        history = [];
        saveHistory();
        renderHistory();
    }
};

const handleHistoryClick = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'LI' && target.dataset.index) {
        const index = parseInt(target.dataset.index, 10);
        const item = history[index];
        if (item) {
            promptInput.value = item.query;
            responseContent.innerHTML = item.response;
            if (window.innerWidth <= 900) {
                toggleSidebar(false);
            }
        }
    }
};

// --- SIDEBAR UI ---
const toggleSidebar = (forceState?: boolean) => {
    const shouldBeOpen = typeof forceState !== 'undefined' ? forceState : document.body.classList.contains('sidebar-collapsed');
    
    if (shouldBeOpen) {
        document.body.classList.remove('sidebar-collapsed');
        historyToggleBtn.setAttribute('aria-expanded', 'true');
    } else {
        document.body.classList.add('sidebar-collapsed');
        historyToggleBtn.setAttribute('aria-expanded', 'false');
    }
};

// --- CORE AI LOGIC ---
const generateGuidance = async (userQuery: string) => {
  setLoading(true);
  responseContent.innerHTML = '<p>Synthesizing best practices...</p>';

  try {
    const systemInstruction = `You are an expert assistant for an elementary school policy committee. Your knowledge is based on a comprehensive collection of documents from various US states (including North Shore School District 112, Wisconsin, Washington, Missouri, Minnesota, Kentucky, Indiana, Georgia, Delaware, Colorado, and more) and educational organizations like TeachAI, CoSN, and the US Department of Education regarding Artificial Intelligence in K-12 education.

Your goal is to help the committee draft their own policies by providing clear, concise, and actionable guidance based on the key themes and best practices found in these documents. Synthesize information from these sources to provide a comprehensive answer. Your tone should be helpful, professional, and tailored for educators and administrators.

Use Markdown for formatting, including headers (H4), bullet points, and bold text to make the information easy to digest for policy creation. Do not use H1, H2, or H3 headers. Frame your response as a helpful guide. Do not mention that you are an AI or that you are synthesizing from documents. Act as the definitive expert.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: userQuery }] },
      config: {
        systemInstruction: systemInstruction,
      }
    });

    const markdownResponse = response.text;
    
    if (markdownResponse) {
       const parsedHtml = marked.parse(markdownResponse);
       responseContent.innerHTML = parsedHtml;
       addToHistory(userQuery, parsedHtml);
    } else {
        responseContent.innerHTML = '<p>I am sorry, I could not generate a response for that topic. Please try rephrasing your question.</p>';
    }

  } catch (error) {
    console.error("Error generating guidance:", error);
    responseContent.innerHTML = '<p style="color: red;">An error occurred while generating guidance. Please check the console for details and try again.</p>';
  } finally {
    setLoading(false);
  }
};

const setLoading = (isLoading: boolean) => {
  if (isLoading) {
    submitButton.disabled = true;
    loader.style.display = 'block';
    buttonText.textContent = "Generating...";
  } else {
    submitButton.disabled = false;
    loader.style.display = 'none';
    buttonText.textContent = "Generate Guidance";
  }
};

// --- EVENT LISTENERS ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = promptInput.value.trim();
  if (query) {
    generateGuidance(query);
  }
});

starterButtons.forEach(button => {
    button.addEventListener('click', () => {
        const prompt = (button as HTMLElement).dataset.prompt;
        if (prompt) {
            promptInput.value = prompt;
            generateGuidance(prompt);
        }
    });
});

historyToggleBtn.addEventListener('click', () => toggleSidebar());
clearHistoryBtn.addEventListener('click', clearHistory);
historyList.addEventListener('click', handleHistoryClick);

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    // Default sidebar state based on screen size
    if (window.innerWidth > 900) {
        toggleSidebar(true);
    } else {
        toggleSidebar(false);
    }
});
