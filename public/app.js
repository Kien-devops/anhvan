// DevOps & Cloud English Platform - Frontend Logic

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('active');
  });

  const activeBtn = document.getElementById(`tab-${tabId}`);
  const activeContent = document.getElementById(`view-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) {
    activeContent.classList.remove('hidden');
    activeContent.classList.add('active');
  }
}

// ----------------------------------------------------
// 1. Text-To-Speech (Phát âm giọng chuẩn bản xứ)
// ----------------------------------------------------
function speakText(text) {
  if (!('speechSynthesis' in window)) {
    alert("Trình duyệt của bạn không hỗ trợ Text-to-Speech.");
    return;
  }
  window.speechSynthesis.cancel(); // Stop any ongoing speech

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.92; // Slightly natural pace for technical terms
  utterance.pitch = 1.0;

  // Prefer US English natural voices if available
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
  if (enVoice) {
    utterance.voice = enVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// ----------------------------------------------------
// 2. Speech-To-Text (Thu âm giọng nói người dùng)
// ----------------------------------------------------
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech Recognition not supported in this browser.");
    return null;
  }
  const recog = new SpeechRecognition();
  recog.continuous = true;
  recog.interimResults = true;
  recog.lang = 'en-US';

  recog.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const textarea = document.getElementById('candidate-answer');
    if (textarea) {
      textarea.value = transcript;
    }
  };

  recog.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    stopRecording();
  };

  recog.onend = () => {
    stopRecording();
  };

  return recog;
}

function toggleSpeechRecognition() {
  if (!recognition) {
    recognition = initSpeechRecognition();
  }

  if (!recognition) {
    alert("Trình duyệt của bạn không hỗ trợ Web Speech Recognition (Hãy dùng Chrome hoặc Edge).");
    return;
  }

  if (isRecording) {
    recognition.stop();
    stopRecording();
  } else {
    try {
      recognition.start();
      isRecording = true;
      const btn = document.getElementById('btn-mic');
      const status = document.getElementById('mic-status');
      if (btn) btn.classList.add('mic-recording');
      if (status) status.classList.remove('hidden');
    } catch (e) {
      console.error(e);
    }
  }
}

function stopRecording() {
  isRecording = false;
  const btn = document.getElementById('btn-mic');
  const status = document.getElementById('mic-status');
  if (btn) btn.classList.remove('mic-recording');
  if (status) status.classList.add('hidden');
}

// ----------------------------------------------------
// 3. Daily Vocabulary Management
// ----------------------------------------------------
let currentVocabList = [];

async function loadDefaultVocab() {
  const grid = document.getElementById('vocab-grid');
  grid.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl text-indigo-400"></i> Đang tải từ vựng...</div>`;

  try {
    const res = await fetch('/api/vocab/defaults');
    const data = await res.json();
    if (data.success) {
      currentVocabList = data.data;
      renderVocabCards(currentVocabList);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderVocabCards(list) {
  const grid = document.getElementById('vocab-grid');
  if (!list || list.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500">Chưa có từ vựng nào. Hãy bấm "AI Gen Từ Mới"!</div>`;
    return;
  }

  grid.innerHTML = list.map((item, idx) => `
    <div class="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between group shadow-sm hover:shadow-lg">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            ${item.category || 'DevOps'}
          </span>
          <button onclick="speakText('${item.term.replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors" title="Nghe phát âm">
            <i class="fa-solid fa-volume-high text-xs"></i>
          </button>
        </div>

        <div>
          <h3 class="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">${item.term}</h3>
          <p class="text-xs font-mono text-slate-400 mt-0.5">${item.ipa || ''}</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <p class="text-xs font-semibold text-emerald-400">Nghĩa: ${item.viMeaning}</p>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">${item.definition}</p>
        </div>

        <div class="pt-1">
          <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Ví dụ thực tế:</p>
          <p class="text-xs text-slate-300 italic mt-0.5 border-l-2 border-indigo-500/60 pl-2">
            "${item.example}"
          </p>
        </div>
      </div>

      <div class="pt-4 flex justify-end">
        <button onclick="speakText('${item.example.replace(/'/g, "\\'")}')" class="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors">
          <i class="fa-solid fa-play text-[10px]"></i> Nghe ví dụ
        </button>
      </div>
    </div>
  `).join('');
}

async function generateAIVocab() {
  const topic = document.getElementById('vocab-topic').value;
  const btn = document.getElementById('btn-gen-vocab');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang suy nghĩ...</span>`;

  try {
    const res = await fetch('/api/vocab/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic, level: 'Intern/Junior' })
    });
    const data = await res.json();
    if (data.success && data.data) {
      currentVocabList = [...data.data, ...currentVocabList];
      renderVocabCards(currentVocabList);
    } else {
      alert("Không thể gen từ mới: " + (data.error || 'Vui lòng thử lại sau.'));
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối tới AI backend.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ----------------------------------------------------
// 4. Workplace Communication Phrases
// ----------------------------------------------------
const WORKPLACE_PHRASES = [
  {
    category: "standup",
    en: "Yesterday, I containerized the auth microservice and set up health checks. Today, I'm configuring the Ingress routes in K3s. No blockers so far.",
    vi: "Hôm qua mình đã container hóa auth service và cấu hình health check. Hôm nay mình sẽ cấu hình Ingress route trong K3s. Hiện tại không có vướng mắc gì.",
    context: "Daily Standup Update (Báo cáo tiến độ 3 câu vàng)"
  },
  {
    category: "standup",
    en: "I'm currently blocked by the Cloudflare DNS propagation delay. Could someone from the networking team take a look at the tunnel configuration?",
    vi: "Mình đang bị nghẽn do độ trễ cập nhật DNS của Cloudflare. Nhờ anh em team network hỗ trợ kiểm tra cấu hình tunnel giúp mình được không?",
    context: "Daily Standup - Raising a Blocker (Báo blocker)"
  },
  {
    category: "incident",
    en: "We are observing a sudden spike in 502 Bad Gateway errors on the payment service. I'm checking the pod logs and resource limits right now.",
    vi: "Chúng ta đang ghi nhận lượng lớn lỗi 502 Bad Gateway trên payment service. Mình đang kiểm tra log của pod và giới hạn tài nguyên ngay bây giờ.",
    context: "Incident Response (Báo cáo sự cố hệ thống)"
  },
  {
    category: "incident",
    en: "The control plane is healthy, but worker node-tang1 transitioned to NotReady. I recommend cordoning the node and rolling back the latest deployment.",
    vi: "Node control plane vẫn ổn định, nhưng worker node-tang1 bị chuyển sang trạng thái NotReady. Mình đề xuất cách ly node và rollback bản deploy gần nhất.",
    context: "Troubleshooting & Mitigation (Đề xuất giải pháp sự cố)"
  },
  {
    category: "pr_review",
    en: "LGTM! The multi-stage Dockerfile looks clean and significantly reduces the final image size. Just one nitpick: consider pinning the base image digest for better reproducibility.",
    vi: "Trông rất ổn! Dockerfile multi-stage viết rất gọn và giảm đáng kể dung lượng image. Chỉ có một góp ý nhỏ: nên ghim digest của base image để đảm bảo tính nhất quán.",
    context: "Code Review / Pull Request (Đánh giá PR kỹ thuật)"
  },
  {
    category: "pr_review",
    en: "Could you please add liveness and readiness probes to the Kubernetes deployment manifest before merging this PR?",
    vi: "Bạn có thể bổ sung thêm liveness và readiness probe vào file deployment manifest của Kubernetes trước khi merge PR này được không?",
    context: "Pull Request Feedback (Yêu cầu bổ sung probe)"
  },
  {
    category: "blocker",
    en: "I've hit a roadblock with the database migration script. Do you have 10 minutes for a quick huddle to sanity check this?",
    vi: "Mình đang gặp chút khó khăn với script migration database. Bạn có rảnh 10 phút để trao đổi nhanh rà soát lại giúp mình không?",
    context: "Asking for Guidance (Xin trợ giúp từ Senior)"
  }
];

function renderPhrases(filter = 'all') {
  const container = document.getElementById('phrases-container');
  const filtered = filter === 'all' 
    ? WORKPLACE_PHRASES 
    : WORKPLACE_PHRASES.filter(p => p.category === filter);

  container.innerHTML = filtered.map(item => `
    <div class="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 transition-all">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ${item.context}
          </span>
          <button onclick="speakText('${item.en.replace(/'/g, "\\'")}')" class="p-2 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors" title="Nghe câu này">
            <i class="fa-solid fa-volume-high text-xs"></i>
          </button>
        </div>
        <p class="text-sm font-semibold text-white leading-relaxed font-['JetBrains_Mono']">"${item.en}"</p>
        <p class="text-xs text-slate-400 mt-2 italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          👉 ${item.vi}
        </p>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <button onclick="speakText('${item.en.replace(/'/g, "\\'")}')" class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium">
          <i class="fa-solid fa-play text-[10px]"></i> Luyện nói câu này
        </button>
        <button onclick="navigator.clipboard.writeText('${item.en.replace(/'/g, "\\'")}'); alert('Đã sao chép câu vào clipboard!')" class="text-xs text-slate-500 hover:text-slate-300">
          <i class="fa-regular fa-copy"></i> Copy
        </button>
      </div>
    </div>
  `).join('');
}

function filterPhrases(category) {
  document.querySelectorAll('.phrase-filter').forEach(btn => btn.classList.remove('active', 'bg-indigo-600', 'text-white'));
  event.target.classList.add('active', 'bg-indigo-600', 'text-white');
  renderPhrases(category);
}

// ----------------------------------------------------
// 5. AI Mock Interviewer
// ----------------------------------------------------
let currentInterviewQuestion = "What is the difference between a Pod and a Deployment in Kubernetes, and when would you use a Deployment?";

async function requestNewQuestion() {
  const topic = document.getElementById('interview-topic').value;
  const btn = document.getElementById('btn-new-question');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang chuẩn bị câu hỏi...</span>`;

  try {
    const res = await fetch('/api/interview/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topic, level: 'Intern/Fresher' })
    });
    const data = await res.json();
    if (data.success && data.data) {
      currentInterviewQuestion = data.data.question;
      document.getElementById('interview-question-text').innerText = `"${data.data.question}"`;
      document.getElementById('q-topic-badge').innerText = data.data.topic || topic;
      document.getElementById('q-difficulty-badge').innerText = data.data.difficulty || 'Medium';
      
      const guideBox = document.getElementById('interview-guidance');
      if (data.data.guidance_vi) {
        guideBox.innerHTML = `<i class="fa-solid fa-lightbulb mr-1"></i> <b>Gợi ý trả lời:</b> ${data.data.guidance_vi}`;
        guideBox.classList.remove('hidden');
      } else {
        guideBox.classList.add('hidden');
      }

      // Clear previous evaluation
      document.getElementById('evaluation-result').classList.add('hidden');
      document.getElementById('candidate-answer').value = '';

      // Auto pronounce new question
      speakText(data.data.question);
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi khi tải câu hỏi phỏng vấn mới.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function submitAnswerForEvaluation() {
  const answer = document.getElementById('candidate-answer').value.trim();
  if (!answer) {
    alert("Vui lòng nhập hoặc nói câu trả lời bằng tiếng Anh trước khi nộp bài!");
    return;
  }

  const btn = document.getElementById('btn-submit-eval');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>AI đang chấm điểm & nhận xét...</span>`;

  const evalContainer = document.getElementById('evaluation-result');
  evalContainer.classList.remove('hidden');
  evalContainer.innerHTML = `
    <div class="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 text-center py-10 space-y-3">
      <i class="fa-solid fa-brain fa-bounce text-3xl text-indigo-400"></i>
      <p class="text-sm font-semibold text-slate-300">9Router AI đang phân tích ngữ pháp, từ vựng và kiến thức kỹ thuật DevOps...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: currentInterviewQuestion,
        answer: answer
      })
    });
    const data = await res.json();
    if (data.success && data.data) {
      renderEvaluationResult(data.data);
    } else {
      evalContainer.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">Lỗi chấm điểm: ${data.error || 'Vui lòng thử lại.'}</div>`;
    }
  } catch (err) {
    console.error(err);
    evalContainer.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">Lỗi kết nối tới AI backend.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function renderEvaluationResult(evalData) {
  const evalContainer = document.getElementById('evaluation-result');
  const score = evalData.score || 7;
  const scoreColor = score >= 8 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : (score >= 6 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10');

  evalContainer.innerHTML = `
    <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
      <!-- Header Score -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-chart-simple text-indigo-400"></i> Đánh Giá Từ Tech Lead Phỏng Vấn
          </h3>
          <p class="text-xs text-slate-400 mt-1">${evalData.summary_vi || 'Nhận xét chi tiết câu trả lời của bạn.'}</p>
        </div>
        <div class="flex items-center space-x-3">
          <div class="px-4 py-2 rounded-2xl border text-center ${scoreColor}">
            <div class="text-2xl font-black">${score}<span class="text-xs font-normal text-slate-400">/10</span></div>
            <div class="text-[10px] font-bold uppercase tracking-wider">Interview Score</div>
          </div>
        </div>
      </div>

      <!-- Strengths & Improvements Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl space-y-2">
          <div class="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <i class="fa-solid fa-circle-check"></i> Điểm tốt (Strengths)
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${evalData.strengths_en || 'Good effort expressing your ideas.'}</p>
        </div>

        <div class="bg-amber-950/20 border border-amber-500/20 p-4 rounded-xl space-y-2">
          <div class="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Góp ý ngữ pháp & Từ vựng
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${evalData.improvements?.grammar_pronunciation_vi || 'Xem câu trả lời mẫu bên dưới để cải thiện câu từ.'}</p>
        </div>
      </div>

      <!-- Technical Accuracy -->
      ${evalData.improvements?.technical_feedback_vi ? `
        <div class="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl space-y-1.5">
          <div class="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <i class="fa-solid fa-code"></i> Nhận xét kỹ thuật DevOps
          </div>
          <p class="text-xs text-slate-200 leading-relaxed">${evalData.improvements.technical_feedback_vi}</p>
        </div>
      ` : ''}

      <!-- Model Answer -->
      <div class="bg-slate-950 p-5 rounded-xl border border-indigo-500/30 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <i class="fa-solid fa-star text-amber-400"></i> Câu trả lời mẫu chuẩn Senior (Model Answer)
          </span>
          <button onclick="speakText('${evalData.model_answer_en.replace(/'/g, "\\'")}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
            <i class="fa-solid fa-volume-high"></i> Nghe phát âm mẫu
          </button>
        </div>
        <p class="text-sm font-semibold text-slate-100 font-['JetBrains_Mono'] leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
          "${evalData.model_answer_en}"
        </p>
        <p class="text-xs text-slate-400 italic">
          👉 <b>Dịch nghĩa:</b> ${evalData.model_answer_vi}
        </p>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// 6. Mentor Chat
// ----------------------------------------------------
let chatHistory = [];

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendChatMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  const btn = document.getElementById('btn-send-chat');
  btn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory })
    });
    const data = await res.json();
    if (data.success && data.reply) {
      appendChatMessage('assistant', data.reply);
      chatHistory.push({ role: 'assistant', content: data.reply });
    } else {
      appendChatMessage('assistant', "Sorry, I encountered an error connecting to 9Router AI. Please try again.");
    }
  } catch (err) {
    console.error(err);
    appendChatMessage('assistant', "Network connection error.");
  } finally {
    btn.disabled = false;
  }
}

function appendChatMessage(role, content) {
  const container = document.getElementById('chat-messages');
  const isUser = role === 'user';

  const msgDiv = document.createElement('div');
  msgDiv.className = `flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`;

  msgDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full ${isUser ? 'bg-emerald-600/30 border border-emerald-500/30 text-emerald-400' : 'bg-indigo-600/30 border border-indigo-500/30 text-indigo-400'} flex items-center justify-center text-xs shrink-0">
      <i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i>
    </div>
    <div class="${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800'} p-3.5 rounded-2xl text-sm max-w-[85%] leading-relaxed">
      ${content}
      ${!isUser ? `
        <div class="mt-2 pt-2 border-t border-slate-800/80 flex justify-end">
          <button onclick="speakText('${content.replace(/'/g, "\\'")}')" class="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1">
            <i class="fa-solid fa-volume-high"></i> Nghe
          </button>
        </div>
      ` : ''}
    </div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function clearChatHistory() {
  chatHistory = [];
  document.getElementById('chat-messages').innerHTML = `
    <div class="flex items-start space-x-3">
      <div class="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs shrink-0">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="bg-slate-900 p-3.5 rounded-2xl rounded-tl-none border border-slate-800 text-sm max-w-[85%] text-slate-200">
        Conversation cleared! How can I help you practice your DevOps English today?
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// Initialization
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadDefaultVocab();
  renderPhrases('all');
});
