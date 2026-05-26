"""Hybrid retrieval: BM25 + semantic search."""

import numpy as np
from typing import List, Tuple
from rank_bm25 import BM25Okapi

from .document_processor import DocumentChunk
from .embedder import Embedder


class Retriever:
    def __init__(self, embedder: Embedder, bm25_weight: float = 0.4, semantic_weight: float = 0.6):
        self.embedder = embedder
        self.bm25_weight = bm25_weight
        self.semantic_weight = semantic_weight
        self.chunks: List[DocumentChunk] = []
        self.bm25: BM25Okapi = None
        self.embeddings: np.ndarray = None

    def index(self, chunks: List[DocumentChunk]):
        """Index chunks for retrieval."""
        self.chunks = [chunk for chunk in chunks if chunk.text.strip()]
        if not self.chunks:
            self.bm25 = None
            self.embeddings = np.empty((0, self.embedder.dimension), dtype=np.float32)
            return

        # BM25 index
        tokenized = [chunk.text.lower().split() for chunk in self.chunks]
        self.bm25 = BM25Okapi(tokenized)

        # Semantic embeddings
        texts = [chunk.text for chunk in self.chunks]
        self.embeddings = self.embedder.encode(texts)

    def search(self, query: str, top_k: int = 5) -> List[Tuple[DocumentChunk, float]]:
        """Hybrid search: combine BM25 and semantic scores."""
        if not self.chunks:
            return []

        # BM25 scores
        bm25_scores = self.bm25.get_scores(query.lower().split())
        bm25_max = bm25_scores.max() if bm25_scores.max() > 0 else 1
        bm25_normalized = bm25_scores / bm25_max

        # Semantic scores
        query_embedding = self.embedder.encode_query(query)
        semantic_scores = np.dot(self.embeddings, query_embedding)
        semantic_max = semantic_scores.max() if semantic_scores.max() > 0 else 1
        semantic_normalized = semantic_scores / semantic_max

        # Combine scores and apply source_type boost
        combined = (
            self.bm25_weight * bm25_normalized +
            self.semantic_weight * semantic_normalized
        )

        # Apply weight boost for factual data vs editorial opinions
        for i in range(len(self.chunks)):
            source_type = self.chunks[i].metadata.get("source_type", "editorial")
            if source_type == "auto-generated":
                combined[i] *= 1.5  # Heavy boost for exact engine formulas/stats
            elif source_type == "battle-data":
                combined[i] *= 1.3  # Moderate boost for empirical sim results

        # Get top-k
        top_indices = np.argsort(combined)[::-1][:top_k]
        results = []
        for idx in top_indices:
            results.append((self.chunks[idx], float(combined[idx])))

        return results
