"""Embedding generation using sentence-transformers."""

import numpy as np
from typing import List
from sentence_transformers import SentenceTransformer


class Embedder:
    def __init__(self, model_name: str = "intfloat/e5-base-v2"):
        self.model = SentenceTransformer(model_name)
        if hasattr(self.model, "get_embedding_dimension"):
            self.dimension = self.model.get_embedding_dimension()
        else:
            self.dimension = self.model.get_sentence_embedding_dimension()

    def encode(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts."""
        # E5 models work best with "passage: " prefix for documents
        prefixed = [f"passage: {text}" for text in texts]
        embeddings = self.model.encode(prefixed, normalize_embeddings=True)
        return embeddings

    def encode_query(self, query: str) -> np.ndarray:
        """Generate embedding for a query."""
        prefixed = f"query: {query}"
        embedding = self.model.encode([prefixed], normalize_embeddings=True)
        return embedding[0]
