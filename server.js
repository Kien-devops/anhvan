const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const ROUTER_URL = process.env.ROUTER_URL || 'https://9router.onprem.site/v1';
const ROUTER_KEY = process.env.ROUTER_KEY || 'sk-a7e6ec7fa26ceade-ii35lw-eb70a6ee';
const ROUTER_MODEL = process.env.ROUTER_MODEL || 'gpt-5.6-sol';

// Persistent storage directory on server-tang4 (hostPath mounted to /app/data)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'progress.json');

function readProgress() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading progress file:', err);
  }
  return { learnedVocab: [], interviewHistory: [] };
}

function saveProgress(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving progress file:', err);
  }
}

app.use(cors());
app.use(express.json());

// Strict no-cache headers for static files to prevent browser caching stale scripts
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

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
    const { topic = 'DevOps', level = 'Intern/Junior', existingTerms = [], learnedTerms = [] } = req.body;
    
    // Read learned vocab directly from persistent storage on server-tang4
    const progress = readProgress();
    const storedLearned = (progress.learnedVocab || []).map(v => v.term.trim().toLowerCase());
    const clientLearned = (learnedTerms || []).map(t => String(t).trim().toLowerCase());
    const clientExisting = (existingTerms || []).map(t => (typeof t === 'string' ? t : t.term || '').trim().toLowerCase());

    const excludeSet = new Set([...storedLearned, ...clientLearned, ...clientExisting].filter(Boolean));
    const excludeList = Array.from(excludeSet);

    const exclusionNotice = excludeList.length > 0 
      ? `CRITICAL EXCLUSION RULE:
The user has ALREADY studied or has these terms in their list:
${excludeList.slice(-60).map(t => `"${t}"`).join(', ')}
You MUST NOT output or repeat ANY of the above terms. Generate ONLY completely fresh, new vocabulary terms for topic "${topic}".`
      : '';

    const prompt = `You are a Senior DevOps Cloud Mentor. Generate 4 new, high-yield English vocabulary words or technical terms for an aspiring candidate applying for a DevOps/Cloud Internship.
Topic: "${topic}", Level: "${level}".
${exclusionNotice}

Return ONLY a valid JSON array of objects with the following schema, with NO markdown backticks or extra text:
[
  {
    "category": "${topic}",
    "term": "Fresh English term (NEVER repeat excluded terms)",
    "ipa": "/IPA pronunciation/",
    "viMeaning": "Nghĩa tiếng Việt súc tích",
    "definition": "Clear English explanation",
    "example": "A realistic workplace/technical sentence in DevOps/Cloud context."
  }
]`;

    const raw = await callLLM([
      { role: "system", content: "You output only clean raw JSON arrays. You strictly obey the exclusion rule and NEVER repeat terms that are already learned or provided in the excluded list." },
      { role: "user", content: prompt }
    ], 0.85);

    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);

    let parsed = JSON.parse(clean.trim());
    if (Array.isArray(parsed)) {
      // Programmatically reject ANY term that was already learned or exists (100% guarantee)
      parsed = parsed.filter(item => {
        if (!item || !item.term) return false;
        const norm = item.term.trim().toLowerCase();
        return !excludeSet.has(norm);
      });
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error generating vocab:', error);
    res.status(500).json({ success: false, error: error.message, fallback: [] });
  }
});

// 2. Generate Workplace Communication Phrases
app.post('/api/phrases/generate', async (req, res) => {
  try {
    const { category = 'standup', count = 3 } = req.body;
    const prompt = `You are an expert English communication coach for DevOps engineers and Cloud architects.
Generate ${count} realistic, professional English workplace communication phrases for the category: "${category}".
(Categories: standup = Daily Standup, incident = Outage & Troubleshooting, pr_review = Code / PR Review, blocker = Raising Blockers & Asking for Help, architecture = System Architecture & Technical Discussions).

Return ONLY a valid JSON array of objects with the following schema, with NO markdown backticks or extra text:
[
  {
    "category": "${category}",
    "en": "Authentic English sentence spoken by engineers in international tech companies.",
    "vi": "Bản dịch nghĩa tiếng Việt tự nhiên và chuẩn chuyên môn IT.",
    "context": "Mô tả ngắn gọn ngữ cảnh sử dụng (vd: Báo cáo blocker, Đề xuất rollback, Góp ý review PR...)"
  }
]`;

    const raw = await callLLM([
      { role: "system", content: "You output only clean raw JSON arrays." },
      { role: "user", content: prompt }
    ], 0.85);

    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);

    const parsed = JSON.parse(clean.trim());
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error generating phrases:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Mock Interview Question Generation
const TOPIC_DETAILS = {
  // Pinned Projects
  "project:eks-network-fabric": {
    name: "Project: AWS EKS Secure Network Fabric",
    stack: "AWS EKS, Transit Gateway (TGW), Gateway Load Balancer (GWLB), Suricata IDS/IPS with GENEVE encapsulation, AWS Network Firewall, Centralized Egress",
    subtopics: [
      "Why use GWLB with GENEVE encapsulation for Suricata deep packet inspection rather than traditional proxying?",
      "Transit Gateway route table isolation: routing East-West and North-South traffic to the inspection VPC without asymmetric routing",
      "Centralized egress architecture using AWS Network Firewall: stateful inspection, TLS SNI domain allowlisting, and NAT Gateway placement",
      "How GENEVE headers preserve the original client IP and port when forwarding packets through Suricata worker instances",
      "Defense-in-depth: combining Kubernetes EKS NetworkPolicies with inline Suricata IDS/IPS and AWS Network Firewall"
    ]
  },
  "project:multi-region-dr": {
    name: "Project: AWS Multi-Region Disaster Recovery",
    stack: "Automated Multi-Region DR, $0 Standby Compute Cost, Amazon Route 53 ARC / Health Checks, S3 Cross-Region Replication, DynamoDB Global Tables, RDS snapshot automation",
    subtopics: [
      "How do you achieve $0 idle compute cost in the secondary region while meeting tight RTO and RPO targets?",
      "Route 53 Application Recovery Controller (ARC) and DNS health check failover mechanics during region failure",
      "Data consistency vs replication latency: S3 Cross-Region Replication vs DynamoDB Global Tables vs RDS automated cross-region snapshot restores",
      "Automated infrastructure spin-up in the secondary region using Terraform/CloudFormation during an actual disaster recovery event",
      "How do you conduct Chaos Engineering or game day simulations to test multi-region failover without impacting production?"
    ]
  },
  "project:cloud-native-sre": {
    name: "Project: Cloud-Native SRE Platform",
    stack: "Prometheus, Loki, Grafana, Alertmanager, SRE Metrics (SLI/SLO/Error Budgets), Discord/Slack notifications",
    subtopics: [
      "Designing meaningful SLIs and SLOs for Kubernetes microservices: latency percentiles (p99/p95) vs error rates",
      "Prometheus PromQL: rate() vs irate() and multi-window multi-burn-rate alerting for error budget burn rates",
      "Loki log aggregation with Promtail: optimizing log streams and preventing high cardinality label explosions",
      "Alertmanager routing, inhibition, and deduplication rules to avoid alert fatigue during major incidents",
      "Conducting a Blameless Postmortem: incident timeline reconstruction, root cause analysis, and preventative action items"
    ]
  },
  "project:k3s-onprem": {
    name: "Project: On-Premise K3s Homelab",
    stack: "Bare-metal K3s Cluster, HAProxy, Cloudflare Zero Trust Tunnels, External Secrets Operator (ESO), Headlamp, Traefik Ingress",
    subtopics: [
      "Bare-metal K3s vs cloud managed EKS: resource constraints, control plane management, and worker node architecture",
      "Publishing internal services securely with Cloudflare Zero Trust Tunnels without opening public router inbound ports",
      "HAProxy reverse proxy configuration: SSL termination, health checking, and routing traffic to K3s ingress controllers",
      "Automating Kubernetes secrets syncing using External Secrets Operator (ESO) connected to cloud secret stores",
      "Persistent storage management on bare-metal Kubernetes: local HostPath vs distributed storage trade-offs"
    ]
  },
  "project:devsecops-pipeline": {
    name: "Project: DevSecOps CI/CD Pipeline",
    stack: "GitHub Actions, Trivy Container Scanner, SonarQube Quality Gate, GHCR, HashiCorp Vault / AWS Secrets Manager, Non-root containers",
    subtopics: [
      "Shift-left security: automating Trivy vulnerability scans and SonarQube quality gates directly in GitHub Actions",
      "Container hardening: multi-stage Docker builds, distroless base images, non-root users, and read-only root filesystems",
      "Eliminating hardcoded secrets using GitHub OIDC with cloud IAM roles and external secrets synchronization",
      "Container image provenance, digest pinning, and cryptographic signing before pushing to GitHub Container Registry (GHCR)",
      "How to triage and handle high/critical CVEs reported by vulnerability scanners without halting urgent hotfixes"
    ]
  },

  // 5 AWS Certifications
  "cert:dop-c02": {
    name: "AWS Certified DevOps Engineer – Professional (DOP-C02)",
    stack: "Advanced CI/CD, Infrastructure as Code, Automated Remediation, EventBridge, CloudFormation StackSets, Service Control Policies, Multi-account governance",
    subtopics: [
      "Automating Blue/Green and Canary deployments using AWS CodeDeploy, ECS/EKS, and Route 53 weighted DNS routing",
      "Event-driven automated remediation using Amazon EventBridge rules, AWS Config, and Systems Manager Automation runbooks",
      "Cross-account continuous delivery pipelines with AWS CodePipeline, customer-managed KMS keys, and assume role delegations",
      "Disaster recovery automation: cross-region AMI replication, RDS cross-region read replicas, and CloudFormation StackSets",
      "Centralized multi-account logging architecture with CloudWatch Logs subscription filters and Kinesis Data Firehose"
    ]
  },
  "cert:saa-c03": {
    name: "AWS Certified Solutions Architect – Associate (SAA-C03)",
    stack: "AWS Well-Architected Framework, High Availability, Resilient Multi-AZ VPCs, Asynchronous Decoupling, S3 Lifecycle, Cost Optimization",
    subtopics: [
      "Designing a highly available, fault-tolerant Multi-AZ VPC with public subnets, private subnets, NAT Gateways, and ALB",
      "Decoupling microservices using Amazon SQS FIFO queues, SNS fan-out patterns, and EventBridge buses",
      "S3 storage tiering: S3 Standard vs Intelligent-Tiering vs Glacier Instant/Deep Archive and lifecycle rules",
      "Database selection: Amazon RDS Multi-AZ vs Amazon Aurora Global Database vs DynamoDB for specific workload requirements",
      "Securing cloud architectures with IAM least privilege, Service Control Policies (SCPs), and VPC Endpoints (PrivateLink)"
    ]
  },
  "cert:soa-c02": {
    name: "AWS Certified SysOps Administrator – Associate (SOA-C02)",
    stack: "Monitoring & Reporting, Systems Manager, Remediation, High Availability & Business Continuity, Security & Compliance",
    subtopics: [
      "Diagnosing degraded EC2 instances: system status checks vs instance status checks and auto-recovery CloudWatch alarms",
      "AWS Systems Manager Session Manager for secure bastion-less shell access and Patch Manager automated patching baselines",
      "Analyzing VPC Flow Logs using CloudWatch Insights and Athena to detect rejected traffic and network anomalies",
      "Monitoring and optimizing cloud expenditures using AWS Budgets, Cost Anomaly Detection, and Compute Optimizer",
      "Backup compliance: configuring AWS Backup plans, cross-region and cross-account vault locks"
    ]
  },
  "cert:dva-c02": {
    name: "AWS Certified Developer – Associate (DVA-C02)",
    stack: "Serverless with AWS Lambda & API Gateway, Amazon DynamoDB, AWS X-Ray, Amazon Cognito, AWS KMS",
    subtopics: [
      "Serverless architecture: managing AWS Lambda concurrency, cold starts, provisioning, and API Gateway request validation",
      "Amazon DynamoDB advanced patterns: partition and sort key design, Global Secondary Indexes (GSIs), and query vs scan",
      "Distributed tracing with AWS X-Ray: instrumenting subsegments, annotations, and pinpointing downstream service latency",
      "User authentication and authorization using Amazon Cognito User Pools, Identity Pools, and JWT token validation",
      "Secure application configuration using AWS AppConfig, Systems Manager Parameter Store, and Secrets Manager caching"
    ]
  },
  "cert:clf-c02": {
    name: "AWS Certified Cloud Practitioner (CLF-C02)",
    stack: "Cloud Value Proposition, Shared Responsibility Model, AWS Well-Architected 6 Pillars, Cloud Adoption Framework, Billing & Pricing",
    subtopics: [
      "AWS Shared Responsibility Model: explaining what AWS manages versus what the customer is responsible for",
      "The 6 pillars of the AWS Well-Architected Framework and practical real-world trade-offs",
      "AWS Global Infrastructure: Regions, Availability Zones, Local Zones, and Edge Locations (CloudFront)",
      "Cloud economics: TCO, CapEx vs OpEx, and AWS Pricing Calculator estimation principles",
      "Root user security: why root credentials must not be used for daily tasks, MFA, and credential reports"
    ]
  },

  // Core DevOps
  "Kubernetes & Container Orchestration": {
    name: "Kubernetes & Container Orchestration",
    stack: "Pod Lifecycle, Ingress, Services, ConfigMaps, Secrets, Probes, Resource Management",
    subtopics: [
      "CrashLoopBackOff and pod troubleshooting with kubectl logs, describe, and events",
      "Difference between ClusterIP, NodePort, LoadBalancer, and Ingress routing in Kubernetes",
      "Readiness vs Liveness probes and preventing cascading traffic failures during rolling updates",
      "Resource requests, resource limits, and diagnosing OOMKilled (Exit Code 137) scenarios",
      "ConfigMaps, Secrets, and how sensitive data is securely mounted and synchronized in pods"
    ]
  },
  "CI/CD Pipeline & GitHub Actions": {
    name: "CI/CD Pipeline & GitHub Actions",
    stack: "Multi-stage pipelines, automated testing, security scanning, caching, deployment strategies",
    subtopics: [
      "Designing multi-stage CI/CD pipelines with build, automated test, vulnerability scan, and deploy jobs",
      "Optimizing GitHub Actions build time with layer caching, matrix builds, and reusable workflows",
      "Implementing semantic versioning, automated changelog generation, and Git tags in CI/CD",
      "Securing runner environments: self-hosted runner security vs GitHub-hosted runners",
      "Environment approval gates, branch protection rules, and PR merge checks"
    ]
  },
  "Linux System & Networking Troubleshooting": {
    name: "Linux System & Networking Troubleshooting",
    stack: "Linux kernel, systemd, cgroups, tcpdump, ss, curl, netstat, DNS resolution",
    subtopics: [
      "Investigating high CPU/Memory load: top, htop, vmstat, and dmesg diagnostics",
      "Linux network troubleshooting: netstat, ss, curl -Iv, tcpdump, and DNS resolution issues (resolv.conf)",
      "Systemd service lifecycle, journalctl log inspection, and writing custom service units",
      "File permissions, sticky bits, umask, and Linux user/group privilege escalation prevention",
      "Understanding Linux cgroups and namespaces: how container isolation actually works at the kernel level"
    ]
  },
  "DevOps Culture & Soft Skills": {
    name: "DevOps Culture & Soft Skills",
    stack: "STAR Method, Blameless Culture, Stakeholder Communication, Incident Management",
    subtopics: [
      "How to communicate a major production incident and downtime to stakeholders using blameless language",
      "Resolving technical conflicts between developers wanting fast delivery and operations demanding stability",
      "How to prioritize technical debt against urgent feature delivery requests from management",
      "STAR method: Describe a challenging bug you fixed and what you learned from the experience",
      "What steps do you take when you are blocked by another team or lack sufficient documentation?"
    ]
  }
};

app.post('/api/interview/question', async (req, res) => {
  try {
    const { 
      topic = 'Kubernetes & Container Orchestration', 
      level = 'Intern/Junior',
      interviewStyle = 'scenario',
      previousQuestions = [] 
    } = req.body;

    const topicInfo = TOPIC_DETAILS[topic] || {
      name: topic,
      stack: "DevOps, Cloud, CI/CD, Containerization",
      subtopics: [
        "Troubleshooting container failures",
        "CI/CD pipeline security and automation",
        "Infrastructure as Code and cloud resilience",
        "Observability and incident triage"
      ]
    };

    const subtopicList = topicInfo.subtopics;
    const suggestedSubtopic = subtopicList[Math.floor(Math.random() * subtopicList.length)];
    const randomSeed = Math.floor(Math.random() * 100000);

    let stylePromptGuide = "";
    if (interviewStyle === 'project') {
      stylePromptGuide = `The candidate (Nguyen Trung Kien) has built this project in their portfolio. Ask a deep, practical question specifically referencing their technical stack (${topicInfo.stack}). Challenge them on their architectural design choices, why they chose this specific tool or pattern, trade-offs, and how they would defend their implementation in a job interview.`;
    } else if (interviewStyle === 'cert_exam') {
      stylePromptGuide = `Frame this question as an authentic, high-level scenario question from the real AWS certification exam or an AWS partner company technical interview. Test deep knowledge of AWS architectural trade-offs, security, resilience, or cost optimization.`;
    } else if (interviewStyle === 'deep_dive') {
      stylePromptGuide = `Conduct a technical deep-dive into the internals (kernel, protocol, packet flow, or controller mechanics). Challenge the candidate on what happens under the hood.`;
    } else if (interviewStyle === 'behavioral') {
      stylePromptGuide = `Ask a behavioral / situational interview question using the STAR method (Situation, Task, Action, Result) in the context of DevOps collaboration, handling mistakes, or working with team members.`;
    } else {
      stylePromptGuide = `Pose a realistic operational scenario or debugging puzzle (e.g. production alert, failure mode, network latency, or unexpected error) that an intern/junior engineer would encounter on the job.`;
    }

    const prompt = `You are a Senior DevOps & Cloud Tech Lead interviewing candidate Nguyen Trung Kien for a DevOps/Cloud Internship at a top global technology company.
Domain/Topic: "${topicInfo.name}"
Technical Stack: "${topicInfo.stack}"
Interview Style: "${interviewStyle}"
Specific Area to Focus on: "${suggestedSubtopic}"
Style Instructions: ${stylePromptGuide}
Random Seed: ${randomSeed}

IMPORTANT RULE:
1. The "question" field MUST be written 100% in professional English for an English technical interview.
2. Only "guidance_vi" should be in Vietnamese.
3. Do NOT repeat or generate questions similar to these previously asked questions:
${previousQuestions.length > 0 ? previousQuestions.map(q => `- ${q}`).join('\n') : '(None yet)'}

Generate ONE fresh, engaging, and realistic technical question that tests understanding without being a generic textbook definition.
Return ONLY a valid JSON object with NO markdown backticks:
{
  "question": "The fresh interview question in professional English",
  "topic": "${topicInfo.name}",
  "difficulty": "Medium / Hard / Scenario",
  "guidance_vi": "Gợi ý ngắn bằng tiếng Việt: trọng tâm cần trả lời, từ khóa kỹ thuật cần có",
  "key_points": ["Keyword/Concept 1", "Keyword/Concept 2", "Keyword/Concept 3"]
}`;

    const raw = await callLLM([
      { role: "system", content: "You output only clean raw JSON objects. Vary your questions widely and never repeat recent questions." },
      { role: "user", content: prompt }
    ], 0.95);

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

// 3. Mock Interview Question Hint Generation
app.post('/api/interview/hint', async (req, res) => {
  try {
    const { question, topic = 'DevOps' } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: "Question is required" });
    }

    const topicInfo = TOPIC_DETAILS[topic];
    const contextStack = topicInfo ? `Related Architecture & Stack: ${topicInfo.name} (${topicInfo.stack})` : `Topic: ${topic}`;

    const prompt = `You are a Senior DevOps Interview Coach helping candidate Nguyen Trung Kien formulate a strong answer in English.
Question: "${question}"
${contextStack}

Provide:
1. Three high-impact technical keywords, architectural terms, or tools to mention.
2. A clear 3-step speaking outline that demonstrates deep technical understanding.
3. A natural, professional starter template that the candidate can use to begin their answer.

Return ONLY a valid JSON object with NO markdown backticks:
{
  "key_keywords": ["keyword 1", "keyword 2", "keyword 3"],
  "outline_steps": [
    "Step 1: Explain the problem/context...",
    "Step 2: Propose the technical solution...",
    "Step 3: Measure results or communicate to team..."
  ],
  "starter_template_en": "To approach this situation, I would first... Then, I would... Finally, to verify the result, I would...",
  "starter_template_vi": "Bản dịch nghĩa tiếng Việt của khung câu trả lời mẫu."
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
    console.error('Error generating interview hint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Mock Interview Evaluation
app.post('/api/interview/evaluate', async (req, res) => {
  try {
    const { question, answer, topic = 'DevOps' } = req.body;
    if (!answer || answer.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Answer cannot be empty" });
    }

    const topicInfo = TOPIC_DETAILS[topic];
    const contextStack = topicInfo ? `Domain: ${topicInfo.name} (Stack: ${topicInfo.stack})` : `Domain: ${topic}`;

    const prompt = `You are an empathetic yet rigorous Senior DevOps Interviewer evaluating candidate Nguyen Trung Kien's English response for a DevOps/Cloud Internship.
${contextStack}

Interview Question: "${question}"
Candidate's English Answer: "${answer}"

Provide constructive feedback evaluating both Technical Accuracy (giving positive recognition for correct architectural choices and tools) and Professional English Communication.
Return ONLY a valid JSON object with NO markdown backticks:
{
  "score": 8, // Integer from 1 to 10
  "summary_vi": "Nhận xét tổng quan súc tích bằng tiếng Việt",
  "strengths_en": "What the candidate answered well (in English)",
  "improvements": {
    "grammar_pronunciation_vi": "Góp ý sửa lỗi ngữ pháp, từ vựng hoặc cách diễn đạt tiếng Anh",
    "technical_feedback_vi": "Góp ý về tính chính xác kỹ thuật DevOps/Cloud hoặc từ khóa kiến trúc nên bổ sung"
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

    // Automatically persist interview practice to persistent database on server-tang4
    try {
      const progress = readProgress();
      if (!Array.isArray(progress.interviewHistory)) progress.interviewHistory = [];
      const historyItem = {
        id: 'int_' + Date.now(),
        question: question,
        topic: topic,
        answer: answer,
        score: parsed.score || 7,
        summary_vi: parsed.summary_vi || '',
        strengths_en: parsed.strengths_en || '',
        improvements: parsed.improvements || {},
        model_answer_en: parsed.model_answer_en || '',
        model_answer_vi: parsed.model_answer_vi || '',
        practicedAt: new Date().toISOString()
      };
      progress.interviewHistory.unshift(historyItem);
      // Keep recent 50 sessions
      if (progress.interviewHistory.length > 50) {
        progress.interviewHistory = progress.interviewHistory.slice(0, 50);
      }
      saveProgress(progress);
    } catch (saveErr) {
      console.error('Failed to auto-save interview progress:', saveErr);
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error evaluating interview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Persistent Progress Endpoints (server-tang4 storage)
app.get('/api/progress', (req, res) => {
  const data = readProgress();
  res.json({ success: true, data: data });
});

app.post('/api/progress/vocab/toggle', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.term) {
      return res.status(400).json({ success: false, error: "Term is required" });
    }

    const progress = readProgress();
    if (!Array.isArray(progress.learnedVocab)) progress.learnedVocab = [];

    const existingIndex = progress.learnedVocab.findIndex(v => v.term.toLowerCase() === item.term.toLowerCase());
    let isLearned = false;

    if (existingIndex >= 0) {
      // Unmark as learned
      progress.learnedVocab.splice(existingIndex, 1);
      isLearned = false;
    } else {
      // Mark as learned
      progress.learnedVocab.unshift({
        term: item.term,
        category: item.category || 'DevOps',
        ipa: item.ipa || '',
        viMeaning: item.viMeaning || '',
        definition: item.definition || '',
        example: item.example || '',
        learnedAt: new Date().toISOString()
      });
      isLearned = true;
    }

    saveProgress(progress);
    res.json({ success: true, isLearned: isLearned, totalLearned: progress.learnedVocab.length, data: progress.learnedVocab });
  } catch (err) {
    console.error('Error toggling vocab progress:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/progress/vocab/:term', (req, res) => {
  try {
    const term = decodeURIComponent(req.params.term);
    const progress = readProgress();
    if (Array.isArray(progress.learnedVocab)) {
      progress.learnedVocab = progress.learnedVocab.filter(v => v.term.toLowerCase() !== term.toLowerCase());
      saveProgress(progress);
    }
    res.json({ success: true, data: progress.learnedVocab });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/progress/interview/:id', (req, res) => {
  try {
    const id = req.params.id;
    const progress = readProgress();
    if (Array.isArray(progress.interviewHistory)) {
      progress.interviewHistory = progress.interviewHistory.filter(h => h.id !== id);
      saveProgress(progress);
    }
    res.json({ success: true, data: progress.interviewHistory });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Interactive Mentor Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [] } = req.body;
    const systemPrompt = {
      role: "system",
      content: `You are 'Alex', an encouraging Senior DevOps & Cloud Mentor at an international tech company.
Your mentee is Nguyễn Trung Kiên (Kien), an ambitious Cloud & DevOps engineer preparing for an international internship.

KIEN'S BACKGROUND & CREDENTIALS:
- 5 AWS Certifications:
  1. AWS Certified DevOps Engineer – Professional (DOP-C02)
  2. AWS Certified Solutions Architect – Associate (SAA-C03)
  3. AWS Certified SysOps Administrator – Associate (SOA-C02)
  4. AWS Certified Developer – Associate (DVA-C02)
  5. AWS Certified Cloud Practitioner (CLF-C02)
- Pinned Architecture Projects:
  1. AWS EKS Secure Network Fabric (TGW route tables, GWLB with GENEVE for Suricata IDS/IPS, AWS Network Firewall egress)
  2. AWS Multi-Region Disaster Recovery ($0 idle compute cost, Route 53 DNS failover, S3/DynamoDB/RDS replication)
  3. Cloud-Native SRE Platform (Prometheus PromQL, Loki, Grafana Alertmanager, SLI/SLO)
  4. On-Premise K3s Homelab (Bare-metal K3s, HAProxy, Cloudflare Zero Trust Tunnels, External Secrets Operator)
  5. DevSecOps CI/CD Pipeline (GitHub Actions, Trivy container scanning, SonarQube quality gate, GHCR, Non-root containers)

YOUR MENTORING ROLE:
1. Help Kien practice articulating these exact projects and AWS certification concepts in fluent, professional English.
2. If he asks about an interview topic, quiz him or give him realistic speaking templates using the STAR method.
3. Always format responses cleanly with clear structure:
   - Use double line breaks between paragraphs.
   - Use bold (**keyword**) for key English phrases to remember.
   - Use code backticks (\`kubectl logs\`, \`docker build\`) for commands and technical terms.
   - Use bullet points (- or 1., 2.) for structured advice or multi-step templates.
   - Use blockquotes (> Quote) when giving a sentence template for Kien to practice speaking aloud.
4. If Kien makes grammatical mistakes, gently rephrase his sentence into a more natural, Senior-level version (e.g. "Senior way to say it in an interview: > ...").
5. Always ask an engaging, relevant follow-up question to keep the conversation flowing naturally.
6. Keep the tone warm, highly motivating, and technical.`
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

