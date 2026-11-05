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
// 1. Text-To-Speech (Bấm nghe thì nghe, bấm dừng thì dừng)
// ----------------------------------------------------
let currentSpeakingText = null;
let currentSpeakingButton = null;

function toggleSpeak(text, btnElement) {
  if (!('speechSynthesis' in window)) {
    alert("Trình duyệt của bạn không hỗ trợ Text-to-Speech.");
    return;
  }

  // If already speaking
  if (window.speechSynthesis.speaking) {
    const isSameButton = currentSpeakingButton === btnElement;
    const isSameText = currentSpeakingText === text;

    // Stop speaking immediately
    window.speechSynthesis.cancel();
    if (currentSpeakingButton) {
      resetSpeakingButton(currentSpeakingButton);
    }

    // If user clicked the active speaking button or same text, we STOP and return!
    if (isSameButton || isSameText) {
      currentSpeakingText = null;
      currentSpeakingButton = null;
      return;
    }
  }

  // Start new speech
  window.speechSynthesis.cancel();
  if (currentSpeakingButton) {
    resetSpeakingButton(currentSpeakingButton);
  }

  currentSpeakingText = text;
  currentSpeakingButton = btnElement;

  if (btnElement) {
    if (!btnElement.dataset.origHtml) {
      btnElement.dataset.origHtml = btnElement.innerHTML;
    }
    const hasSpan = btnElement.querySelector('span');
    if (hasSpan) {
      btnElement.innerHTML = `<i class="fa-solid fa-circle-stop text-rose-400 animate-pulse text-xs"></i> <span class="text-rose-300 font-bold">Dừng đọc</span>`;
    } else {
      btnElement.innerHTML = `<i class="fa-solid fa-circle-stop text-rose-400 animate-pulse text-xs"></i>`;
    }
    btnElement.classList.add('border-rose-500/50', 'bg-rose-950/20');
  }

  const cleanText = text.replace(/[#*`_>\[\]]/g, '').replace(/["']/g, ' ').replace(/\n+/g, ' ').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
  if (enVoice) {
    utterance.voice = enVoice;
  }

  utterance.onend = () => {
    if (btnElement) resetSpeakingButton(btnElement);
    if (currentSpeakingButton === btnElement) {
      currentSpeakingButton = null;
      currentSpeakingText = null;
    }
  };

  utterance.onerror = () => {
    if (btnElement) resetSpeakingButton(btnElement);
    if (currentSpeakingButton === btnElement) {
      currentSpeakingButton = null;
      currentSpeakingText = null;
    }
  };

  window.speechSynthesis.speak(utterance);
}

function resetSpeakingButton(btnElement) {
  if (!btnElement) return;
  if (btnElement.dataset.origHtml) {
    btnElement.innerHTML = btnElement.dataset.origHtml;
  }
  btnElement.classList.remove('border-rose-500/50', 'bg-rose-950/20');
}

function toggleSpeakQuestion() {
  const textEl = document.getElementById('interview-question-text');
  const text = textEl ? textEl.innerText.replace(/"/g, '').trim() : '';
  const btn = document.getElementById('btn-speak-question');
  if (text) {
    toggleSpeak(text, btn);
  }
}

// Backward compatibility alias (supports toggleSpeak)
function speakText(text, btnElement = null) {
  toggleSpeak(text, btnElement);
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
// 3. Daily Vocabulary Management & Progress Tracking
// ----------------------------------------------------
let currentVocabList = [];
let learnedVocabMap = new Map(); // lowercase term -> object
let interviewHistoryList = [];

async function loadProgressData() {
  try {
    const res = await fetch('/api/progress?t=' + Date.now());
    const json = await res.json();
    if (json.success && json.data) {
      learnedVocabMap.clear();
      (json.data.learnedVocab || []).forEach(item => {
        learnedVocabMap.set(item.term.toLowerCase(), item);
      });
      interviewHistoryList = json.data.interviewHistory || [];
      updateProgressUI();
    }
  } catch (e) {
    console.error('Error loading progress:', e);
  }
}

function updateProgressUI() {
  const badge = document.getElementById('badge-learned-count');
  if (badge) badge.innerText = learnedVocabMap.size;

  const statVocab = document.getElementById('stat-vocab-count');
  if (statVocab) statVocab.innerText = learnedVocabMap.size;

  const statInt = document.getElementById('stat-interview-count');
  if (statInt) statInt.innerText = interviewHistoryList.length;

  const statAvg = document.getElementById('stat-avg-score');
  if (statAvg) {
    if (interviewHistoryList.length > 0) {
      const avg = (interviewHistoryList.reduce((acc, cur) => acc + (cur.score || 0), 0) / interviewHistoryList.length).toFixed(1);
      statAvg.innerText = `${avg}/10`;
    } else {
      statAvg.innerText = '--/10';
    }
  }

  renderLearnedVocab();
  renderInterviewHistory();
  if (currentVocabList && currentVocabList.length > 0) {
    renderVocabCards(currentVocabList);
  }
}

async function loadDefaultVocab() {
  const grid = document.getElementById('vocab-grid');
  grid.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl text-indigo-400"></i> Đang tải từ vựng...</div>`;

  try {
    const res = await fetch('/api/vocab/defaults?t=' + Date.now());
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

  const hideLearned = document.getElementById('chk-hide-learned')?.checked || false;
  const filteredList = hideLearned 
    ? list.filter(item => !learnedVocabMap.has(item.term.trim().toLowerCase()))
    : list;

  if (filteredList.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-slate-900/30 rounded-2xl border border-slate-800">
        <i class="fa-solid fa-circle-check text-2xl text-emerald-400 mb-2"></i>
        <p class="text-sm font-semibold text-white">Bạn đã thuộc hết các từ vựng này rồi!</p>
        <p class="text-xs text-slate-400 mt-1">Bỏ tick "Ẩn từ đã học" để ôn lại, hoặc bấm "AI Gen Từ Mới" để học thêm từ mới nhé.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredList.map((item) => {
    const isLearned = learnedVocabMap.has(item.term.toLowerCase());
    return `
    <div class="bg-slate-900/60 hover:bg-slate-900/90 border ${isLearned ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-800'} hover:border-indigo-500/40 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between group shadow-sm hover:shadow-lg">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            ${item.category || 'DevOps'}
          </span>
          <div class="flex items-center space-x-1.5">
            <button onclick="toggleLearnedVocab('${item.term.replace(/'/g, "\\'")}', '${(item.category||'').replace(/'/g, "\\'")}', '${(item.ipa||'').replace(/'/g, "\\'")}', '${(item.viMeaning||'').replace(/'/g, "\\'")}', '${(item.definition||'').replace(/'/g, "\\'")}', '${(item.example||'').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${isLearned ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-emerald-300'}" title="${isLearned ? 'Bấm để bỏ đánh dấu' : 'Bấm để đánh dấu đã thuộc từ này'}">
              <i class="fa-solid fa-check"></i>
              <span>${isLearned ? 'Đã học' : 'Học từ này'}</span>
            </button>
            <button onclick="toggleSpeak('${item.term.replace(/'/g, "\\'")}', this)" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-transparent" title="Bấm nghe phát âm, bấm lần nữa để dừng">
              <i class="fa-solid fa-volume-high text-xs"></i>
            </button>
          </div>
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
        <button onclick="toggleSpeak('${item.example.replace(/'/g, "\\'")}', this)" class="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors" title="Bấm nghe ví dụ, bấm lần nữa để dừng">
          <i class="fa-solid fa-play text-[10px]"></i> <span>Nghe ví dụ</span>
        </button>
      </div>
    </div>
  `;
  }).join('');
}

async function toggleLearnedVocab(term, category, ipa, viMeaning, definition, example) {
  try {
    const res = await fetch('/api/progress/vocab/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, category, ipa, viMeaning, definition, example })
    });
    const json = await res.json();
    if (json.success) {
      if (json.isLearned) {
        learnedVocabMap.set(term.toLowerCase(), { term, category, ipa, viMeaning, definition, example });
      } else {
        learnedVocabMap.delete(term.toLowerCase());
      }
      updateProgressUI();
    }
  } catch (e) {
    console.error('Error toggling vocab:', e);
  }
}

async function deleteLearnedVocab(term) {
  try {
    const res = await fetch(`/api/progress/vocab/${encodeURIComponent(term)}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      learnedVocabMap.delete(term.toLowerCase());
      updateProgressUI();
    }
  } catch (e) {
    console.error('Error deleting learned word:', e);
  }
}

function renderLearnedVocab() {
  const container = document.getElementById('learned-vocab-container');
  if (!container) return;

  if (learnedVocabMap.size === 0) {
    container.innerHTML = `
      <div class="col-span-full py-10 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
        <i class="fa-solid fa-book-open-reader text-2xl text-slate-500 mb-2"></i>
        <p class="text-xs">Bạn chưa đánh dấu từ vựng nào. Hãy sang tab "Từ Vựng Mỗi Ngày" và bấm "Học từ này"!</p>
      </div>
    `;
    return;
  }

  const list = Array.from(learnedVocabMap.values());
  container.innerHTML = list.map(item => `
    <div class="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between space-y-2">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
            ${item.category || 'DevOps'}
          </span>
          <div class="flex items-center space-x-1">
            <button onclick="toggleSpeak('${item.term.replace(/'/g, "\\'")}', this)" class="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white" title="Bấm nghe, bấm lần nữa để dừng">
              <i class="fa-solid fa-volume-high text-xs"></i>
            </button>
            <button onclick="deleteLearnedVocab('${item.term.replace(/'/g, "\\'")}')" class="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400" title="Xóa khỏi kho đã học">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
        <h4 class="text-base font-bold text-white mt-1">${item.term}</h4>
        <p class="text-xs text-emerald-300 font-medium">${item.viMeaning || ''}</p>
        <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">${item.definition || ''}</p>
      </div>
      <div class="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 italic">
        "${item.example || ''}"
      </div>
    </div>
  `).join('');
}

function renderInterviewHistory() {
  const container = document.getElementById('interview-history-container');
  if (!container) return;

  if (interviewHistoryList.length === 0) {
    container.innerHTML = `
      <div class="py-10 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
        <i class="fa-solid fa-microphone text-2xl text-slate-500 mb-2"></i>
        <p class="text-xs">Chưa có bài phỏng vấn nào được lưu. Hãy sang tab "Luyện Phỏng Vấn AI" để trả lời câu hỏi và nhận chấm điểm!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = interviewHistoryList.map(item => {
    const scoreColor = item.score >= 8 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : (item.score >= 6 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10');
    return `
      <div class="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div>
            <span class="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">${item.topic || 'DevOps Interview'}</span>
            <p class="text-sm font-bold text-white mt-0.5">"${item.question}"</p>
          </div>
          <div class="flex items-center space-x-3 shrink-0">
            <div class="px-3 py-1 rounded-xl border ${scoreColor} text-center">
              <span class="text-lg font-black">${item.score}</span><span class="text-[10px] text-slate-400">/10</span>
            </div>
            <button onclick="deleteInterviewHistory('${item.id}')" class="p-2 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400" title="Xóa bài này">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>

        <div>
          <p class="text-[11px] uppercase font-bold text-slate-400">Câu trả lời của bạn:</p>
          <p class="text-xs text-slate-200 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono mt-1">
            ${item.answer}
          </p>
        </div>

        <div class="text-xs text-slate-300">
          <span class="text-emerald-400 font-semibold">Nhận xét AI:</span> ${item.summary_vi || ''}
        </div>

        ${item.model_answer_en ? `
          <div class="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] font-bold text-indigo-300 uppercase">Câu trả lời mẫu chuẩn:</span>
              <button onclick="toggleSpeak('${item.model_answer_en.replace(/'/g, "\\'")}', this)" class="text-[10px] text-indigo-400 hover:text-indigo-200 flex items-center gap-1" title="Bấm nghe, bấm lần nữa để dừng">
                <i class="fa-solid fa-volume-high"></i> <span>Nghe</span>
              </button>
            </div>
            <p class="text-xs text-slate-200 font-mono italic">"${item.model_answer_en}"</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function deleteInterviewHistory(id) {
  try {
    const res = await fetch(`/api/progress/interview/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      interviewHistoryList = interviewHistoryList.filter(h => h.id !== id);
      updateProgressUI();
    }
  } catch (e) {
    console.error('Error deleting interview session:', e);
  }
}

async function generateAIVocab() {
  const topic = document.getElementById('vocab-topic').value;
  const btn = document.getElementById('btn-gen-vocab');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang suy nghĩ...</span>`;

  try {
    const existingTerms = currentVocabList.map(v => v.term);
    const learnedTerms = Array.from(learnedVocabMap.keys());

    const res = await fetch('/api/vocab/generate?t=' + Date.now(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topic: topic, 
        level: 'Intern/Junior',
        existingTerms: existingTerms,
        learnedTerms: learnedTerms
      })
    });
    const data = await res.json();
    if (data.success && data.data && data.data.length > 0) {
      // Filter out any word that has already been learned or already exists in current study list
      const freshTerms = data.data.filter(item => {
        if (!item || !item.term) return false;
        const norm = item.term.trim().toLowerCase();
        const isLearned = learnedVocabMap.has(norm);
        const isDuplicate = currentVocabList.some(c => c.term.trim().toLowerCase() === norm);
        return !isLearned && !isDuplicate;
      });

      if (freshTerms.length === 0) {
        alert("Các từ AI vừa gợi ý bạn đều đã thuộc hoặc đã có trong danh sách! Hãy bấm lại lần nữa để AI chọn các từ kỹ thuật khác.");
      } else {
        currentVocabList = [...freshTerms, ...currentVocabList];
        renderVocabCards(currentVocabList);
      }
    } else {
      alert("Không có từ mới nào được tạo hoặc có lỗi: " + (data.error || 'Vui lòng thử lại sau.'));
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
  },
  {
    category: "architecture",
    en: "To decouple the services and prevent cascading timeouts, I recommend introducing an asynchronous message queue between the ingest and processing layers.",
    vi: "Để tách rời các service và tránh nghẽn timeout dây chuyền, mình đề xuất bổ sung hàng đợi message bất đồng bộ giữa tầng ingest và xử lý dữ liệu.",
    context: "Architecture Discussion (Đề xuất thiết kế hệ thống)"
  }
];

let currentPhrasesList = [...WORKPLACE_PHRASES];
let currentPhraseFilter = 'all';

function renderPhrases(filter = 'all') {
  currentPhraseFilter = filter;
  const container = document.getElementById('phrases-container');
  const filtered = filter === 'all' 
    ? currentPhrasesList 
    : currentPhrasesList.filter(p => p.category === filter);

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-slate-900/30 rounded-2xl border border-slate-800">
        <i class="fa-solid fa-comments text-2xl text-slate-500 mb-2"></i>
        <p class="text-sm">Chưa có mẫu câu nào cho danh mục này.</p>
        <button onclick="generateAIPhrases()" class="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl">
          <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Bấm để AI sinh mẫu câu ngay
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 transition-all duration-200 shadow-sm hover:shadow-md">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ${item.context}
          </span>
          <button onclick="toggleSpeak('${item.en.replace(/'/g, "\\'")}', this)" class="p-2 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors border border-transparent" title="Bấm nghe phát âm, bấm lần nữa để dừng">
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
  if (event && event.target) {
    event.target.classList.add('active', 'bg-indigo-600', 'text-white');
  }
  renderPhrases(category);
}

async function generateAIPhrases() {
  const category = document.getElementById('phrase-gen-category').value;
  const btn = document.getElementById('btn-gen-phrases');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>AI đang soạn mẫu câu...</span>`;

  try {
    const res = await fetch('/api/phrases/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: category, count: 3 })
    });
    const data = await res.json();
    if (data.success && data.data) {
      currentPhrasesList = [...data.data, ...currentPhrasesList];
      renderPhrases(currentPhraseFilter);
    } else {
      alert("Không thể gen mẫu câu: " + (data.error || 'Vui lòng thử lại.'));
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối tới AI backend.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function resetDefaultPhrases() {
  currentPhrasesList = [...WORKPLACE_PHRASES];
  renderPhrases(currentPhraseFilter);
}

// ----------------------------------------------------
// 5. AI Mock Interviewer
// ----------------------------------------------------
let currentInterviewQuestion = "What is the difference between a Pod and a Deployment in Kubernetes, and when would you use a Deployment?";
let askedInterviewQuestions = [currentInterviewQuestion];

async function requestNewQuestion() {
  const topic = document.getElementById('interview-topic').value;
  const styleEl = document.getElementById('interview-style');
  const style = styleEl ? styleEl.value : 'scenario';
  
  const btn = document.getElementById('btn-new-question');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang đổi câu hỏi mới...</span>`;

  try {
    const res = await fetch('/api/interview/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topic: topic, 
        level: 'Intern/Junior',
        interviewStyle: style,
        previousQuestions: askedInterviewQuestions.slice(-10)
      })
    });
    const data = await res.json();
    if (data.success && data.data && data.data.question) {
      currentInterviewQuestion = data.data.question;
      askedInterviewQuestions.push(currentInterviewQuestion);

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

      // Clear previous evaluation and hints
      document.getElementById('evaluation-result').classList.add('hidden');
      document.getElementById('candidate-answer').value = '';
      const hintBox = document.getElementById('question-hint-box');
      if (hintBox) {
        hintBox.classList.add('hidden');
        hintBox.innerHTML = '';
      }

      // Speak new question and sync button state
      toggleSpeakQuestion();
    } else {
      alert("Không thể đổi câu hỏi: " + (data.error || 'Vui lòng thử lại.'));
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi khi tải câu hỏi phỏng vấn mới.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ----------------------------------------------------
// Gen Câu Gợi Ý & Dàn Ý Trả Lời (AI Hint Generator)
// ----------------------------------------------------
async function requestQuestionHint() {
  const btn = document.getElementById('btn-question-hint');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang gen gợi ý...</span>`;

  const hintBox = document.getElementById('question-hint-box');
  hintBox.classList.remove('hidden');
  hintBox.innerHTML = `
    <div class="py-4 text-center text-amber-300 text-xs flex items-center justify-center gap-2">
      <i class="fa-solid fa-brain fa-bounce text-sm"></i>
      <span>9Router AI đang soạn dàn ý & mẫu câu trả lời chuẩn...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/interview/hint?t=' + Date.now(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: currentInterviewQuestion,
        topic: document.getElementById('interview-topic').value
      })
    });
    const data = await res.json();
    if (data.success && data.data) {
      const h = data.data;
      hintBox.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <span class="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <i class="fa-solid fa-lightbulb"></i> Gợi ý trả lời & Dàn ý chuyên môn
            </span>
            <button onclick="document.getElementById('question-hint-box').classList.add('hidden')" class="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800">
              <i class="fa-solid fa-xmark"></i> Đóng
            </button>
          </div>

          <!-- Keywords -->
          <div>
            <p class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1.5">Từ khóa chuyên môn nên nói:</p>
            <div class="flex flex-wrap gap-1.5">
              ${(h.key_keywords || []).map(kw => `<span class="px-2.5 py-0.5 rounded-md text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-medium">${kw}</span>`).join('')}
            </div>
          </div>

          <!-- Steps outline -->
          <div>
            <p class="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">Dàn ý trả lời 3 bước:</p>
            <ul class="text-xs text-slate-200 space-y-1 list-disc pl-4">
              ${(h.outline_steps || []).map(step => `<li>${step}</li>`).join('')}
            </ul>
          </div>

          <!-- Starter Template -->
          <div class="p-3 bg-slate-900/90 rounded-xl border border-amber-500/30 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <i class="fa-solid fa-bullhorn"></i> Mẫu câu trả lời gợi ý (Starter Template):
              </span>
              <button onclick="toggleSpeak('${h.starter_template_en.replace(/'/g, "\\'")}', this)" class="text-[11px] text-indigo-400 hover:text-indigo-200 flex items-center gap-1" title="Bấm nghe, bấm lần nữa để dừng">
                <i class="fa-solid fa-volume-high"></i> <span>Nghe đọc mẫu</span>
              </button>
            </div>
            <p class="text-xs text-slate-100 font-['JetBrains_Mono'] italic bg-slate-950/70 p-2 rounded border border-slate-800">
              "${h.starter_template_en}"
            </p>
            <p class="text-xs text-slate-400 italic">👉 <b>Dịch nghĩa:</b> ${h.starter_template_vi}</p>
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button onclick="insertTemplateToAnswer('${h.starter_template_en.replace(/'/g, "\\'")}')" class="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md active:scale-95 transition-all">
              <i class="fa-solid fa-arrow-down"></i> Chèn vào ô trả lời để luyện nói
            </button>
          </div>
        </div>
      `;
    } else {
      hintBox.innerHTML = `<div class="text-xs text-rose-400">Không thể tạo gợi ý lúc này. Vui lòng thử lại.</div>`;
    }
  } catch (err) {
    console.error(err);
    hintBox.innerHTML = `<div class="text-xs text-rose-400">Lỗi kết nối khi tạo gợi ý.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function insertTemplateToAnswer(text) {
  const textarea = document.getElementById('candidate-answer');
  if (textarea) {
    textarea.value = text;
    textarea.focus();
    alert('Đã chèn khung câu gợi ý vào ô trả lời! Bạn có thể chỉnh sửa hoặc bấm Mic để luyện nói theo.');
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
      loadProgressData();
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
          <button onclick="toggleSpeak('${evalData.model_answer_en.replace(/'/g, "\\'")}', this)" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm border border-transparent" title="Bấm nghe, bấm lần nữa để dừng">
            <i class="fa-solid fa-volume-high"></i> <span>Nghe phát âm mẫu</span>
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
const CHAT_TOPIC_CONFIGS = {
  k8s: {
    name: "Kubernetes & Containers",
    welcome: "Hey Kien! I'm ready to dive into **Kubernetes & Containers**! ☸️ We can discuss Pod lifecycle, CrashLoopBackOff troubleshooting, Ingress routing, or do a live mock interview quiz. What would you like to explore?",
    chips: [
      "Can you quiz me on Kubernetes Pod lifecycle?",
      "How do I explain CrashLoopBackOff to an interviewer in English?",
      "What is the difference between ClusterIP, NodePort, and Ingress?",
      "How do you handle OOMKilled (Exit Code 137) in production?"
    ]
  },
  aws: {
    name: "AWS Cloud & 5 Certifications",
    welcome: "Awesome, let's focus on **AWS Cloud & your 5 Certifications (DOP-C02, SAA, SOA, DVA, CLF)**! ☁️ What architectural pattern or scenario exam question shall we practice explaining in English?",
    chips: [
      "Quiz me on AWS DOP-C02 Blue/Green deployment strategies!",
      "How do I explain Multi-AZ high availability in an interview?",
      "Explain S3 lifecycle tiering for cost optimization.",
      "How does Route 53 health check DNS failover work?"
    ]
  },
  cicd: {
    name: "CI/CD & DevSecOps Pipelines",
    welcome: "Let's level up your **CI/CD, GitOps & DevSecOps** communication! 🚀 We can practice explaining GitHub Actions automation, Trivy vulnerability scans, or SonarQube quality gates. Where should we begin?",
    chips: [
      "How do I explain shift-left security in GitHub Actions?",
      "Review my Docker multi-stage build optimization.",
      "Explain the difference between Blue/Green and Canary.",
      "How do you eliminate hardcoded secrets in CI/CD pipelines?"
    ]
  },
  linux: {
    name: "Linux Internals & Networking",
    welcome: "Ready for **Linux Internals & Network Troubleshooting**! 🐧 We can practice diagnosing high load, investigating network drops with tcpdump, or explaining cgroups and container isolation in English.",
    chips: [
      "How do I explain Linux cgroups and namespaces to an interviewer?",
      "Walk me through troubleshooting a high CPU & memory server.",
      "How do you use tcpdump and netstat to debug network drops?",
      "Explain the difference between soft links and hard links."
    ]
  },
  project_network: {
    name: "Project: AWS EKS Secure Network Fabric",
    welcome: "Let's defend your signature project: **AWS EKS Secure Network Fabric**! 🛡️ We can practice explaining TGW segmentation, GWLB with GENEVE encapsulation, and Suricata IDS/IPS in professional English.",
    chips: [
      "Why did I choose GWLB with GENEVE over a traditional proxy?",
      "Explain TGW route table isolation and symmetric routing.",
      "How does AWS Network Firewall handle centralized egress?",
      "Quiz me as an interviewer grilling my network fabric project!"
    ]
  },
  project_dr: {
    name: "Project: Multi-Region Disaster Recovery",
    welcome: "Let's practice presenting your **AWS Multi-Region Disaster Recovery** platform ($0 standby compute cost)! 🔄 What key metrics or failover mechanisms would you like to practice speaking?",
    chips: [
      "How do I explain achieving $0 standby compute cost in English?",
      "Explain our target RTO and RPO and how we measure them.",
      "How do we replicate DynamoDB and S3 across AWS regions?",
      "Ask me a tough interview question about my DR project!"
    ]
  },
  project_sre: {
    name: "Project: Cloud-Native SRE Platform",
    welcome: "Observability time! 📊 Let's practice discussing your **Cloud-Native SRE Platform** with Prometheus, Loki, Grafana, and Alertmanager.",
    chips: [
      "How do I define and measure SLIs and SLOs in an interview?",
      "Explain Prometheus rate() vs irate() and multi-burn-rate alerts.",
      "How did you prevent high cardinality label issues in Loki?",
      "Grill me on conducting a blameless postmortem in English!"
    ]
  },
  project_k3s: {
    name: "Project: On-Premise K3s Homelab",
    welcome: "Let's talk about your **On-Premise K3s Homelab**! ☸️ We can practice explaining bare-metal cluster setup, Cloudflare Tunnels, and External Secrets Operator (ESO).",
    chips: [
      "How do I explain running bare-metal K3s vs AWS EKS?",
      "How does Cloudflare Zero Trust Tunnel secure our homelab?",
      "Explain how External Secrets Operator (ESO) syncs secrets.",
      "Ask me a troubleshooting question about K3s worker nodes!"
    ]
  },
  project_devsecops: {
    name: "Project: DevSecOps CI/CD Pipeline",
    welcome: "Security first! 🚀 Let's talk about your **DevSecOps CI/CD Pipeline** with Trivy scanning, SonarQube quality gates, and non-root container packaging.",
    chips: [
      "How do you integrate Trivy container scanning in GitHub Actions?",
      "Explain our SonarQube quality gate rules and metrics.",
      "Why is running as non-root critical for container security?",
      "How do you handle critical CVEs in production releases?"
    ]
  },
  mock_interview: {
    name: "1-on-1 Interactive Mock Interview",
    welcome: "Tech Lead mode activated! 🎯 I'll conduct a realistic 1-on-1 technical interview in English. I'll ask one question at a time, evaluate your response, and challenge you with follow-ups. Ready? Say 'I'm ready' or pick a starter below!",
    chips: [
      "Start a technical interview for a DevOps Intern position!",
      "Ask me a challenging behavioral question using STAR method.",
      "I'm ready. Grill me on Kubernetes and Linux networking!",
      "Ask me a question about my AWS experience."
    ]
  },
  standup: {
    name: "Daily Standup & Workplace Communication",
    welcome: "Let's polish your workplace English! 📋 We can practice your 3-point Daily Standup update (Yesterday, Today, Blockers), reporting an incident, or asking a Senior engineer for guidance.",
    chips: [
      "Help me formulate my 3-bullet standup update for today.",
      "How do I report a blocker professionally in English?",
      "How do I ask a Senior engineer for a 10-minute huddle?",
      "Practice communicating a deployment delay to my team."
    ]
  },
  incident: {
    name: "Incident Drill & Production Outage",
    welcome: "🚨 **INCIDENT DRILL ACTIVE!** You are on-call. A high-priority production alert just fired. We will roleplay the incident response in English, from triage to mitigation and postmortem. Are you ready?",
    chips: [
      "Simulate a sudden 502 Bad Gateway spike on production!",
      "How do I send a clear outage announcement to stakeholders?",
      "A worker node just transitioned to NotReady. What now?",
      "Let's write a blameless postmortem for a failed deployment."
    ]
  }
};

let chatHistory = [];

function onChatTopicChange() {
  const select = document.getElementById('chat-topic');
  const topicKey = select ? select.value : 'k8s';
  const config = CHAT_TOPIC_CONFIGS[topicKey] || CHAT_TOPIC_CONFIGS.k8s;

  // Render quick chips
  renderChatChips(config.chips);

  // Clear previous chat and set tailored welcome message
  chatHistory = [{ role: 'assistant', content: config.welcome }];
  const container = document.getElementById('chat-messages');
  if (container) {
    container.innerHTML = '';
    appendChatMessage('assistant', config.welcome);
  }
}

function renderChatChips(chips) {
  const chipsContainer = document.getElementById('chat-quick-chips');
  if (!chipsContainer) return;
  if (!chips || chips.length === 0) {
    chipsContainer.innerHTML = '';
    return;
  }

  chipsContainer.innerHTML = chips.map(c => `
    <button onclick="useQuickPrompt('${c.replace(/'/g, "\\'")}')" class="whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600/30 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-200 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0">
      <i class="fa-regular fa-comment-dots text-indigo-400 text-[10px]"></i>
      <span>${c}</span>
    </button>
  `).join('');
}

function useQuickPrompt(text) {
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = text;
    sendChatMessage();
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const topicSelect = document.getElementById('chat-topic');
  const activeTopic = topicSelect ? topicSelect.value : 'k8s';

  input.value = '';
  appendChatMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  const btn = document.getElementById('btn-send-chat');
  btn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: chatHistory,
        topic: activeTopic
      })
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

  let formattedContent = '';
  if (!isUser && typeof marked !== 'undefined') {
    formattedContent = marked.parse(content);
  } else {
    formattedContent = `<p class="whitespace-pre-wrap">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
  }

  // Clean raw speech text for text-to-speech
  const cleanSpeech = content.replace(/[#*`_>\[\]]/g, '').replace(/\n+/g, ' ');

  msgDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full ${isUser ? 'bg-emerald-600/30 border border-emerald-500/30 text-emerald-400' : 'bg-indigo-600/30 border border-indigo-500/30 text-indigo-400'} flex items-center justify-center text-xs shrink-0 mt-1 shadow-sm">
      <i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i>
    </div>
    <div class="${isUser ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-md' : 'bg-slate-900/90 text-slate-200 rounded-2xl rounded-tl-none border border-slate-800/90 p-4 shadow-md chat-markdown'} text-sm max-w-[85%] leading-relaxed">
      ${formattedContent}
      ${!isUser ? `
        <div class="mt-3 pt-2 border-t border-slate-800/80 flex justify-end">
          <button onclick="toggleSpeak('${cleanSpeech.replace(/'/g, "\\'")}', this)" class="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors border border-transparent px-2 py-0.5 rounded" title="Bấm nghe, bấm lần nữa để dừng">
            <i class="fa-solid fa-volume-high text-[10px]"></i> <span>Nghe phát âm</span>
          </button>
        </div>
      ` : ''}
    </div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function clearChatHistory() {
  const select = document.getElementById('chat-topic');
  const topicKey = select ? select.value : 'k8s';
  const config = CHAT_TOPIC_CONFIGS[topicKey] || CHAT_TOPIC_CONFIGS.k8s;
  chatHistory = [{ role: 'assistant', content: config.welcome }];
  document.getElementById('chat-messages').innerHTML = `
    <div class="flex items-start space-x-3">
      <div class="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs shrink-0">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="bg-slate-900 p-3.5 rounded-2xl rounded-tl-none border border-slate-800 text-sm max-w-[85%] text-slate-200 chat-markdown">
        ${typeof marked !== 'undefined' ? marked.parse(config.welcome) : config.welcome}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// Initialization
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadProgressData();
  loadDefaultVocab();
  renderPhrases('all');
  onChatTopicChange();
});

