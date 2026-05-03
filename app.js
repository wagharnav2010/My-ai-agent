const chat = document.getElementById('chat');
const chatForm = document.getElementById('chatForm');
const taskInput = document.getElementById('taskInput');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const modelSelect = document.getElementById('model');
const statusEl = document.getElementById('status');
const template = document.getElementById('messageTemplate');

const KEY_STORAGE = 'gemini_api_key';
apiKeyInput.value = localStorage.getItem(KEY_STORAGE) || '';

saveKeyBtn.addEventListener('click', () => {
  localStorage.setItem(KEY_STORAGE, apiKeyInput.value.trim());
  saveKeyBtn.textContent = 'Saved ✓';
  setTimeout(() => (saveKeyBtn.textContent = 'Save Locally'), 1200);
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const task = taskInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  if (!task || !apiKey) return;

  addMessage('user', task);
  taskInput.value = '';

  statusEl.textContent = 'Thinking';
  statusEl.className = 'status thinking';

  const loadingNode = addMessage('agent', 'Planning');
  loadingNode.querySelector('.content').classList.add('loading-dots');

  try {
    const responseText = await runGeminiTask(task, apiKey, modelSelect.value);
    loadingNode.remove();
    await renderStepByStep(responseText);
  } catch (err) {
    loadingNode.remove();
    addMessage('agent', `Error: ${err.message}`);
  } finally {
    statusEl.textContent = 'Idle';
    statusEl.className = 'status idle';
  }
});

async function runGeminiTask(task, apiKey, model) {
  const prompt = `You are a Manus-like autonomous task agent.
For the user task, respond as if you are planning/executing in steps.
Format:
1) Goal Summary
2) Plan (numbered)
3) Step-by-step Execution Notes (include concise "thinking" style reasoning)
4) Final Output
Task: ${task}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 900 }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API request failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n')?.trim();
  if (!text) throw new Error('No output returned by model.');
  return text;
}

async function renderStepByStep(fullText) {
  const chunks = fullText.split(/\n(?=\d+\)|[-*]|Step\s*\d+|Final)/i).filter(Boolean);
  if (!chunks.length) {
    addMessage('agent', fullText);
    return;
  }

  for (const chunk of chunks) {
    addMessage('agent', chunk.trim());
    await sleep(700);
  }
}

function addMessage(role, text) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.toggle('user', role === 'user');
  node.querySelector('.role').textContent = role === 'user' ? 'You' : 'Agent';
  node.querySelector('.content').textContent = text;
  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
  return node;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
