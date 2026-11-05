const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ROUTER_URL = process.env.ROUTER_URL || 'https://9router.onprem.site/v1';
const ROUTER_KEY = process.env.ROUTER_KEY || 'sk-a7e6ec7fa26ceade-ii35lw-eb70a6ee';
const ROUTER_MODEL = process.env.ROUTER_MODEL || 'gpt-5.6-sol';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to call 9Router LLM API
async function callLLM(messages, temperature = 0.7) {
  const url = `${ROUTER_URL}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ROUTER_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    body: JSON.stringify({
      model: ROUTER_MODEL,
      messages: messages,
      temperature: temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`9Router error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'anhvan-devops-english',
    model: ROUTER_MODEL,
    router: ROUTER_URL
  });
});

// Curated default vocabularies in case of instant load
const DEFAULT_VOCAB = [
  {
    category: "DevOps & Containers",
    term: "Container Orchestration",
    ipa: "/kənˈteɪnər ˌɔːrkɪˈstreɪʃn/",
    viMeaning: "Điều phối và quản lý tự động vòng đời container",
    definition: "Automating the deployment, scaling, management, and networking of containers across a cluster.",
    example: "Kubernetes is the industry standard tool for container orchestration in cloud-native environments."
  },
  {
    category: "DevOps & Containers",
    term: "Idempotency",
    ipa: "/ˌaɪdəmˈpoʊtənsi/",
    viMeaning: "Tính lũy biến (chạy nhiều lần kết quả vẫn giữ nguyên)",
    definition: "A property where performing an operation multiple times has the same outcome as executing it once.",
    example: "Ansible playbooks are designed with idempotency, ensuring server state remains consistent."
  },
  {
    category: "CI/CD & GitOps",
    term: "Continuous Delivery",
    ipa: "/kənˈtɪnjuəs dɪˈlɪvəri/",
    viMeaning: "Chuyển giao liên tục (code luôn sẵn sàng deploy)",
    definition: "A software engineering approach in which teams produce software in short cycles, ensuring that the software can be reliably released at any time.",
    example: "With our automated GitHub Actions workflow, continuous delivery guarantees every build is deployment-ready."
  },
  {
    category: "Cloud & Infrastructure",
    term: "High Availability (HA)",
    ipa: "/haɪ əˌveɪləˈbɪləti/",
    viMeaning: "Độ sẵn sàng cao (hệ thống hoạt động liên tục không gián đoạn)",
    definition: "A system characteristic aiming to ensure an agreed level of operational performance, usually uptime, for a higher than normal period.",
    example: "We deployed HAProxy across multiple nodes to ensure high availability for our K3s ingress traffic."
  },
  {
    category: "Workplace & Standup",
    term: "Impediment / Blocker",
    ipa: "/ɪmˈpedɪmənt / ˈblɑːkər/",
    viMeaning: "Chướng ngại vật, yếu tố gây nghẽn tiến độ",
    definition: "Any obstacle that slows down the team or prevents a developer from completing their tasks.",
    example: "During our morning standup, I reported that DNS propagation delays are currently my main blocker."
  },
  {
    category: "SRE & Observability",
    term: "Mean Time to Recovery (MTTR)",
    ipa: "/miːn taɪm tuː rɪˈkʌvəri/",
    viMeaning: "Thời gian phục hồi trung bình sau sự cố",
    definition: "The average time required to troubleshoot, fix, and recover from a system failure or outage.",
    example: "Our automated rollback pipeline significantly decreased MTTR during recent production incidents."
  }
];

// 1. Get Vocabulary Endpoint
app.get('/api/vocab/defaults', (req, res) => {
  res.json({ success: true, data: DEFAULT_VOCAB });
});

app.post('/api/vocab/generate', async (req, res) => {
  try {
    const { topic = 'DevOps', level = 'Intern/Junior' } = req.body;
    const prompt = `You are a Senior DevOps Cloud Mentor. Generate 4 new, high-yield English vocabulary words or technical terms for an aspiring candidate applying for a DevOps/Cloud Internship.
Topic: "${topic}", Level: "${level}".
Return ONLY a valid JSON array of objects with the following schema, with NO markdown backticks or extra text:
[
  {
    "category": "Topic category",
    "term": "English term",
    "ipa": "/IPA pronunciation/",
    "viMeaning": "Nghĩa tiếng Việt súc tích",
    "definition": "Clear English explanation",
    "example": "A realistic workplace/technical sentence in DevOps/Cloud context."
  }
]`;

    const raw = await callLLM([
      { role: "system", content: "You output only clean raw JSON arrays." },
      { role: "user", content: prompt }
    ], 0.7);

    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);

    const parsed = JSON.parse(clean.trim());
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error generating vocab:', error);
    res.status(500).json({ success: false, error: error.message, fallback: DEFAULT_VOCAB });
  }
});

// 2. Mock Interview Question Generation
app.post('/api/interview/question', async (req, res) => {
  try {
    const { topic = 'Kubernetes', level = 'Intern/Fresher' } = req.body;
    const prompt = `You are a Technical Lead conducting a mock interview in English for a DevOps/Cloud Internship candidate.
Topic: "${topic}"
Target Candidate Level: "${level}"

Generate ONE realistic interview question that tech companies frequently ask.
Return ONLY a valid JSON object with NO markdown backticks:
{
  "question": "The interview question in professional English",
  "topic": "${topic}",
  "difficulty": "Easy / Medium",
  "guidance_vi": "Gợi ý ngắn bằng tiếng Việt: trọng tâm cần trả lời, từ khóa cần có",
  "key_points": ["Keyword/Concept 1", "Keyword/Concept 2", "Keyword/Concept 3"]
}`;

    const raw = await callLLM([
      { role: "system", content: "You output only clean raw JSON objects." },
      { role: "user", content: prompt }
    ], 0.7);

    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);

    const parsed = JSON.parse(clean.trim());
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error generating interview question:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Mock Interview Evaluation
app.post('/api/interview/evaluate', async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!answer || answer.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Answer cannot be empty" });
    }

    const prompt = `You are an empathetic yet rigorous Senior DevOps Interviewer evaluating an internship candidate's English response.

Interview Question: "${question}"
Candidate's English Answer: "${answer}"

Provide constructive feedback evaluating both Technical Understanding and Professional English Communication.
Return ONLY a valid JSON object with NO markdown backticks:
{
  "score": 8, // Integer from 1 to 10
  "summary_vi": "Nhận xét tổng quan súc tích bằng tiếng Việt",
  "strengths_en": "What the candidate answered well (in English)",
  "improvements": {
    "grammar_pronunciation_vi": "Góp ý sửa lỗi ngữ pháp, từ vựng hoặc cách diễn đạt tiếng Anh",
    "technical_feedback_vi": "Góp ý về tính chính xác kỹ thuật DevOps/Cloud"
  },
  "model_answer_en": "An ideal, polished answer that a strong candidate would speak during the interview (clear, concise, natural)",
  "model_answer_vi": "Bản dịch nghĩa tiếng Việt của câu trả lời mẫu"
}`;

    const raw = await callLLM([
      { role: "system", content: "You output only clean raw JSON objects." },
      { role: "user", content: prompt }
    ], 0.5);

    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);

    const parsed = JSON.parse(clean.trim());
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error evaluating interview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Interactive Mentor Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [] } = req.body;
    const systemPrompt = {
      role: "system",
      content: `You are 'Alex', an encouraging Senior DevOps & Cloud Mentor at a tech company.
Your goal is to help an aspiring student prepare for their DevOps/Cloud Internship interview and build confidence communicating in professional English.
- Always converse primarily in natural, clear English.
- If the user writes in Vietnamese or makes English mistakes, gently explain technical concepts in English and provide short Vietnamese hints/translations when helpful.
- Keep responses engaging, supportive, and packed with practical DevOps/Cloud context (Kubernetes, Docker, CI/CD, Terraform, AWS, Linux).`
    };

    const fullMessages = [systemPrompt, ...messages.slice(-10)];
    const reply = await callLLM(fullMessages, 0.7);

    res.json({ success: true, reply: reply });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DevOps English Hub running on http://0.0.0.0:${PORT}`);
  console.log(`🤖 Connected to 9Router (${ROUTER_URL}) using model ${ROUTER_MODEL}`);
});
