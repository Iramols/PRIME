// ========== COACH CHAT ==========
async function callClaude(userMsg, history, maxTokens = 300) {
  const msgs = [...history, { role:'user', content: userMsg }];
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens: maxTokens, system:SYSTEM, messages:msgs })
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const d = await r.json();
  if (!d.content || !d.content[0]) throw new Error('Lege response van API');
  return d.content[0].text;
}

function addMsg(role, text) {
  const chat = document.getElementById('chat-area');
  const div = document.createElement('div');
  div.className = `msg ${role==='user' ? 'user-msg' : ''}`;
  div.innerHTML = `<div class="msg-av ${role}">${role==='coach'?'IRA':'JIJ'}</div><div class="msg-bubble">${text.replace(/\n/g,'<br>')}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function addTyping() {
  const chat = document.getElementById('chat-area');
  const div = document.createElement('div');
  div.className = 'msg'; div.id = 'typing-msg';
  div.innerHTML = `<div class="msg-av coach">IRA</div><div class="msg-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
}

async function sendMsg() {
  const inp = document.getElementById('chat-input');
  const msg = inp.value.trim(); if (!msg) return;
  inp.value = '';
  document.getElementById('send-btn').disabled = true;
  addMsg('user', msg);
  addTyping();
  chatHistory.push({ role:'user', content:msg });
  try {
    const reply = await callClaude(msg, chatHistory.slice(-10));
    document.getElementById('typing-msg')?.remove();
    addMsg('coach', reply);
    chatHistory.push({ role:'assistant', content:reply });
  } catch {
    document.getElementById('typing-msg')?.remove();
    addMsg('coach', 'Even geen verbinding. Probeer het opnieuw.');
  }
  document.getElementById('send-btn').disabled = false;
}

function qMsg(q) { document.getElementById('chat-input').value = q; sendMsg(); }

