# 🚀 DevOps & Cloud English Learning Hub

Ứng dụng luyện tiếng Anh giao tiếp và phỏng vấn kỹ thuật dành riêng cho ứng viên thực tập **DevOps / Cloud / SRE Intern**.

Tích hợp trực tiếp với **9Router AI Gateway** (`gpt-5.6-sol`), tự động phát âm chuẩn bản xứ (Web Speech TTS) và nhận diện giọng nói luyện nói (Speech-to-Text).

---

## 🌟 Tính Năng Nổi Bật

1. **Daily Vocabulary (Từ vựng chuyên ngành & giao tiếp)**:
   - Kho từ vựng chuyên ngành: *Kubernetes, Docker, CI/CD, AWS Architecture, Linux & Networking, SRE*.
   - Mẫu câu ví dụ thực tế trong công việc kèm phát âm chuẩn IPA.
   - Nút **AI Gen Từ Mới** sử dụng 9Router để bổ sung từ mới mỗi ngày.
2. **Workplace Communication (Mẫu câu giao tiếp thực chiến)**:
   - Các kịch bản: *Daily Standup, Incident Troubleshooting, Pull Request Review, Báo cáo Blocker*.
   - Hỗ trợ nghe phát âm và copy câu vào clipboard.
3. **AI Mock Interview (Luyện phỏng vấn thử)**:
   - AI đóng vai Tech Lead đặt câu hỏi kỹ thuật theo từng chủ đề.
   - Thu âm câu trả lời trực tiếp bằng Microphone (Web Speech Recognition) hoặc gõ text.
   - AI chấm điểm (thang điểm 10), nhận xét ngữ pháp, sửa phát âm và cung cấp **Câu trả lời mẫu chuẩn Senior**.
4. **DevOps Mentor Chat (Trò chuyện cùng AI)**:
   - Mentor Alex hỗ trợ luyện phản xạ, giải thích kiến thức kỹ thuật bằng tiếng Anh kèm gợi ý tiếng Việt.

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture)

```text
User Browser (HTTPS)
       │
       ▼
Cloudflare Edge / Tunnel
       │ (anhvan.onprem.site -> 127.0.0.1:80)
       ▼
server-tang3 (HAProxy Load Balancer :80)
       │
       ▼
server-tang4 (K3s Traefik Ingress Controller :80)
       │
       ▼
K3s Cluster Service (anhvan-service :80 -> :3000)
       │
       ▼
anhvan-app Pods (Express + Node.js 22 Alpine)
       │
       ▼
9Router AI Gateway (https://9router.onprem.site/v1) -> gpt-5.6-sol
```

---

## 💻 Chạy Local (Development)

```bash
# Cài đặt dependencies
npm install

# Chạy server development
npm run dev

# Mở trình duyệt tại: http://localhost:3000
```

---

## 🐳 Triển khai lên Kubernetes (K3s)

```bash
kubectl apply -f k8s/namespace.yml
kubectl apply -f k8s/deployment.yml
kubectl apply -f k8s/service.yml
kubectl apply -f k8s/ingress.yml
```

