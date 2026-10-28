# Kreuzberg RAG - Player Support Chatbot Service

Phân hệ trợ lý ảo thông minh hỗ trợ người chơi trong **Creature Chess** sử dụng kiến trúc **RAG (Retrieval-Augmented Generation)** với cơ chế tìm kiếm lai **Hybrid Search**.

---

## Tính năng nổi bật

- **Hybrid Search (Dense + Sparse)**:
  - **Dense Retrieval**: Sử dụng mô hình `sentence-transformers` tạo vector embedding nắm bắt ngữ nghĩa sâu sắc.
  - **Sparse Keyword Search**: Thuật toán `rank-bm25` truy xuất chính xác tên tướng, chỉ số sát thương, hệ tộc và cơ chế kích hoạt skill.
  - **Fusion & Context Synthesis**: Kết hợp kết quả từ cả hai phương pháp để trích xuất những đoạn tài liệu (chunks) liên quan nhất.
- **FastAPI Core**: Microservice REST API hiệu năng cao, hỗ trợ bất đồng bộ (async/await).
- **Đa dạng LLM Provider**: Tích hợp linh hoạt với OpenAI (`gpt-4o`, `gpt-3.5-turbo`), DeepSeek (`deepseek-chat`) và OpenRouter.
- **Knowledge Base Động**: Tự động đánh chỉ mục từ các tài liệu markdown về gameplay, tướng, trang bị và cẩm nang chiến thuật trong thư mục `data/`.

---

## Cấu trúc thư mục

```text
llm-rag/
├── data/                         # Kho tri thức luật chơi, tướng, chiến thuật (Markdown)
├── kreuzberg_rag/                # Pipeline RAG cốt lõi
│   ├── api.py                    # FastAPI endpoints (/api/chat, /health, /docs)
│   ├── embeddings.py             # Sentence-Transformers vector embeddings
│   ├── retriever.py              # BM25 + Vector hybrid retrieval logic
│   └── llm.py                    # LLM Adapter (OpenAI / DeepSeek / OpenRouter)
├── generate_knowledge_base.py    # Script trích xuất và xây dựng dữ liệu tri thức
├── requirements.txt              # Danh sách thư viện Python
├── .env.example                  # Mẫu biến môi trường
└── README.md                     # Tài liệu hướng dẫn phân hệ
```

---

## Cài đặt & Khởi chạy

### 1. Tạo môi trường ảo Python
Yêu cầu Python `>= 3.10`:

```bash
# Linux / macOS
python3 -m venv venv
source venv/bin/activate

# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Cài đặt thư viện dependencies
```bash
pip install -r requirements.txt
```

### 3. Cấu hình biến môi trường
Sao chép file cấu hình mẫu và điền API Key:
```bash
cp .env.example .env
```

Nội dung `.env`:
```ini
# LLM Provider Configuration
OPENAI_API_KEY=your_openai_api_key_here
# hoặc DeepSeek:
# DEEPSEEK_API_KEY=your_deepseek_api_key_here
# hoặc OpenRouter:
# OPENROUTER_API_KEY=your_openrouter_api_key_here

# Model settings
LLM_MODEL=deepseek-chat
EMBEDDING_MODEL=all-MiniLM-L6-v2
RAG_PORT=8000
```

### 4. Khởi chạy FastAPI Server
```bash
uvicorn kreuzberg_rag.api:app --host 0.0.0.0 --port 8000 --reload
```

---

## API Endpoints

Sau khi khởi chạy, truy cập Swagger UI tài liệu tương tác tại:
👉 `http://localhost:8000/docs`

### `POST /api/chat`
Gửi câu hỏi và nhận câu trả lời kèm nguồn tài liệu tham khảo:

**Request Body:**
```json
{
  "query": "Làm thế nào để kích hoạt synergy Rồng và tướng nào gây sát thương phép mạnh nhất?",
  "top_k": 3
}
```

**Response:**
```json
{
  "answer": "Để kích hoạt tộc Rồng, bạn cần có ít nhất 2 tướng tộc Rồng trên bàn cờ...",
  "sources": [
    "data/synergies.md",
    "data/creatures.md"
  ]
}
```

### `GET /health`
Kiểm tra trạng thái sẵn sàng của service và mô hình embedding.
