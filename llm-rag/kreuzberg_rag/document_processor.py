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
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            # Default to data directory relative to this file
            self.data_dir = Path(__file__).parent.parent / "data"
        else:
            self.data_dir = Path(data_dir)
            
        self.source_dirs = {
            "game-guides": "editorial",
            "auto-generated": "auto-generated",
            "battle-data": "battle-data"
        }

    def process_all(self) -> List[DocumentChunk]:
        """Process all markdown files in the configured data directories."""
        chunks = []
        for dir_name, source_type in self.source_dirs.items():
            target_dir = self.data_dir / dir_name
            if not target_dir.exists():
                continue
            for md_file in target_dir.glob("*.md"):
                file_chunks = self.process_file(md_file, source_type)
                chunks.extend(file_chunks)
        return chunks

    def process_file(self, file_path: Path, source_type: str = "editorial") -> List[DocumentChunk]:
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
                            "source_type": source_type,
                        },
                    )
                )
            return chunks
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return []

    def get_guide_names(self) -> List[str]:
        """Return list of available guide files across all directories."""
        names = []
        for dir_name in self.source_dirs.keys():
            target_dir = self.data_dir / dir_name
            if target_dir.exists():
                names.extend([f.name for f in target_dir.glob("*.md")])
        return names
