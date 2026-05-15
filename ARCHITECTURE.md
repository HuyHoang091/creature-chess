# Kiến trúc hệ thống

## Phân tách trách nhiệm

### 1. Core Research Components (Đóng góp chính)

#### RL Bot Training System
```
/rl-training/
├── agents/          # RL agents implementation
├── environments/    # Game environment wrappers
├── policies/        # Policy networks
├── rewards/         # Reward shaping
└── training/        # Training loops
```

**Công nghệ:**
- Framework: [PyTorch/TensorFlow/Ray]
- Algorithms: [PPO/DQN/A3C/etc.]
- Metrics: Win rate, average reward, convergence

#### RAG Chatbot System
```
/chatbot/
├── retrieval/       # Document retrieval
├── generation/      # LLM integration
├── knowledge/       # Knowledge base
└── api/            # REST/WebSocket API
```

**Công nghệ:**
- RAG Framework: [LangChain/LlamaIndex]
- Vector DB: [Pinecone/Weaviate/Chroma]
- LLM: [OpenAI/Anthropic/Local]

#### RL-based Orchestrator
```
/orchestrator/
├── rl-controller/   # RL-based resource controller
├── scheduler/       # Task scheduling
├── scaler/         # Auto-scaling logic
└── monitor/        # Metrics collection
```

**Công nghệ:**
- RL for resource allocation
- Container orchestration
- Load balancing algorithms

#### CI/CD Pipeline
```
/cicd/
├── webhooks/       # GitHub webhook handlers
├── pipeline/       # Deployment pipeline
├── rollback/       # Rollback strategies
└── monitoring/     # Deployment monitoring
```

**Công nghệ:**
- GitHub Actions
- Docker
- Automated testing

---

### 2. Base Game Platform (Open Source Foundation)

```
/apps/              # Game applications
/modules/           # Shared modules
  ├── @creature-chess/  # Game logic
  ├── @shoki/          # Game engine
  └── @cc-server/      # Server utilities
```

**Vai trò:** Test bed cho các thuật toán AI và infrastructure

---

## Data Flow

### RL Bot Training
```
Game State → Environment Wrapper → RL Agent → Action → Game Engine → Reward
     ↑                                                                    │
     └────────────────────────────────────────────────────────────────────┘
```

### RAG Chatbot
```
User Query → Retrieval → Context + Query → LLM → Response → User
                ↓
          Knowledge Base
```

### Orchestrator
```
Metrics → RL Controller → Scaling Decision → Container Manager → Deployment
   ↑                                                                  │
   └──────────────────────────────────────────────────────────────────┘
```

### CI/CD
```
GitHub Push → Webhook → Pipeline → Tests → Build → Deploy → Monitor
                                      ↓
                                   Rollback (if failed)
```

---

## Đóng góp nghiên cứu

1. **Novel RL approach** cho game AI training
2. **RAG integration** cho player support
3. **RL-based orchestration** thay vì rule-based
4. **Automated CI/CD** với intelligent rollback

## Metrics & Evaluation

### RL Bot Performance
- Win rate vs baseline
- Training convergence time
- Action quality metrics

### RAG Chatbot Quality
- Response accuracy
- Retrieval precision/recall
- User satisfaction

### Orchestrator Efficiency
- Resource utilization
- Response time
- Cost optimization

### CI/CD Reliability
- Deployment success rate
- Rollback frequency
- Mean time to deploy
