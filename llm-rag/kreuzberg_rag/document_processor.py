"""Document processing using Kreuzberg for markdown game guides."""

from pathlib import Path
from typing import Any, Dict, List

from kreuzberg import ChunkingConfig, ExtractionConfig, extract_file_sync


class DocumentChunk:
    def __init__(self, text: str, source: str, metadata: Dict[str, Any]):
        self.text = text
        self.source = source
        self.metadata = metadata

    def __repr__(self):
        return f"DocumentChunk(source={self.source}, text={self.text[:50]}...)"


class DocumentProcessor:
    def __init__(self, guides_dir: str = None):
        if guides_dir is None:
            # Default to data/game-guides relative to this file
            self.guides_dir = Path(__file__).parent.parent / "data" / "game-guides"
        else:
            self.guides_dir = Path(guides_dir)

    def process_all(self) -> List[DocumentChunk]:
        """Process all markdown files in the guides directory."""
        chunks = []
        for md_file in self.guides_dir.glob("*.md"):
            file_chunks = self.process_file(md_file)
            chunks.extend(file_chunks)
        return chunks

    def process_file(self, file_path: Path) -> List[DocumentChunk]:
        """Process a single markdown file using Kreuzberg."""
        try:
            result = extract_file_sync(
                str(file_path),
                config=ExtractionConfig(
                    chunking=ChunkingConfig(
                    max_chars=1000,
                    max_overlap=200,
                    chunker_type="markdown",
                    prepend_heading_context=True,
                    )
                ),
            )

            chunks = []
            raw_chunks = result.chunks or []
            if not raw_chunks and result.content.strip():
                raw_chunks = [result]

            for idx, chunk in enumerate(raw_chunks):
                metadata = getattr(chunk, "metadata", {}) or {}
                heading_context = metadata.get("heading_context") or {}
                headings = heading_context.get("headings") or []
                heading = " > ".join(
                    item.get("text", "").strip()
                    for item in headings
                    if item.get("text")
                )
                text = (getattr(chunk, "content", None) or "").strip()
                if not text:
                    continue

                chunks.append(
                    DocumentChunk(
                        text=text,
                        source=file_path.name,
                        metadata={
                            "file": file_path.name,
                            "heading": heading,
                            "position": metadata.get("chunk_index", idx),
                        },
                    )
                )
            return chunks
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return []

    def get_guide_names(self) -> List[str]:
        """Return list of available guide files."""
        return [f.name for f in self.guides_dir.glob("*.md")]
