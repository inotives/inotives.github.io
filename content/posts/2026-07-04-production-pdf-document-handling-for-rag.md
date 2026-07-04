---
title: "Production PDF Handling for RAG: Why Text Extraction Fails and What to Do Instead"
date: 2026-07-04
tags: [pdf, rag, document-parsing, multimodal, chunking, ocr, layout-analysis, table-extraction]
series: building-ai-systems
summary: "PDFs are the #1 source of RAG quality problems. Tables collapse into word soup, charts vanish, reading order scrambles across columns. The fix is a multi-stage pipeline: layout detection, element-type-aware extraction, semantic chunking, and dual-layer storage. Here's the production pipeline from ingestion to retrieval, including tool benchmarks and document-type-specific strategies."
---

# Production PDF Handling for RAG: Why Text Extraction Fails and What to Do Instead

PDF documents are the number one source of RAG quality problems. Text-only extraction silently drops the information users actually ask about: tables collapse into word soup, reading order scrambles across columns, charts vanish entirely, and forms lose their field-value relationships. The result is disconnected token fragments that produce hallucinated or incomplete answers.

In production, PDF parsing requires a multi-stage pipeline that treats documents as typed elements (headings, paragraphs, tables, figures, forms) rather than flat text. The cardinal rule: keep tables whole, attach captions to figures, never split label-value pairs in forms.

## Why simple text extraction fails

A PDF is not a text file. It is a visual format with positioned text boxes, vector graphics, and embedded images.

| Element | What Happens | Impact on RAG |
|---------|-------------|---------------|
| Tables | Cells collapse into linear text, rows/columns lost | Numeric queries fail, comparisons impossible |
| Charts/Figures | Entirely dropped | Visual insights invisible to agent |
| Multi-column layout | Text from different columns interleaved | Reading order scrambled, context corrupted |
| Forms | Label-value pairs broken | Field-specific queries fail silently |
| Headers/Footers | Mixed into body text | Pollutes content with page numbers, dates |
| Page breaks | Sentences split across pages | Semantic fragmentation |

The analogy: imagine someone scattered index cards across a floor, one card per word, then took a photo. Your job is to reconstruct the original document from that photo. For a clean single-column page, it is straightforward. For a two-column academic paper with figures, footnotes, and embedded tables, it is genuinely hard.

## The production pipeline

```
Stage 1: Ingestion
  Load PDF → Page rendering

Stage 2: Layout Detection
  Identify regions → Classify elements → Determine reading order

Stage 3: Element Extraction
  Text paragraphs → OCR / VLM extraction
  Tables → Structure recognition
  Figures/Charts → Image cropping + captioning
  Forms → Field-value parsing

Stage 4: Metadata Extraction
  Source file + page → Region type + bbox → Section heading → Document type + date

Stage 5: Chunking
  Semantic unit chunking
  Table-aware: keep whole or split by rows
  Figure + caption pairing
  Form field grouping

Stage 6: Embedding & Indexing
  Text chunks → text embeddings
  Image crops → vision embeddings
  Index in vector store with metadata

Stage 7: Storage
  RAG store (vector DB)
  OFS (original PDF + intermediate)
  OKF (curated concepts + docs)
```

## Layout detection

Layout detection identifies what each region on a page is: headline, body paragraph, figure caption, table, footnote, header/footer. Without it, all extracted text is treated as equal prose and reading order is guessed by y-coordinate alone.

**State of the art (2026):**

| Tool | Layout Model | Table Accuracy | Speed |
|------|-------------|----------------|-------|
| Docling (IBM) | Heron (RT-DETRv2) | 97.9% | 28ms/page on A100 |
| Unstructured.io | detectron2 (hi-res) | 93.4% | 4.8 pages/sec |
| Marker | Custom CV model | 91.7% | 6.1 pages/sec |
| LlamaParse | LLM-based | 90%+ | Slower |

Docling's Heron model achieves 23.5% mAP improvement over previous baselines by using RT-DETRv2 architecture. It classifies every bounding box before text extraction begins, enabling correct reading order for multi-column layouts.

What layout detection produces:

```
Page 12:
├── Region 1: [0, 0, 800, 50] → HEADER (skip)
├── Region 2: [0, 60, 400, 120] → TITLE "Q4 Financial Summary"
├── Region 3: [0, 130, 400, 400] → PARAGRAPH (body text)
├── Region 4: [420, 130, 800, 400] → TABLE (financial data)
├── Region 5: [0, 410, 800, 600] → FIGURE (chart image)
├── Region 6: [0, 610, 800, 640] → CAPTION "Figure 3: Revenue trends"
└── Region 7: [0, 750, 800, 800] → FOOTER (skip)
```

## Element-type-aware extraction

Each element type requires different extraction logic.

**Tables (the hardest problem):** A PDF table has no semantic encoding. It is just a grid of text boxes positioned near each other. Reconstructing rows and columns requires detecting cell boundaries from visual evidence.

| Strategy | How It Works | Accuracy | Best For |
|----------|-------------|----------|----------|
| Visual CV | Detect borders, lines, cell boundaries | High | Tables with clear borders |
| VLM-based | Vision LLM reads table as image | Highest | Complex/merged cells |
| Rule-based | Whitespace heuristics, font analysis | Medium | Simple tables |
| Hybrid | CV detection + LLM structure | Highest | Production |

Serialize tables to GitHub-Flavored Markdown. Chunking rule: tables under ~1,500 tokens stay as a single chunk. Tables over ~1,500 tokens split by row ranges with header row repeated in each split. Never cut a table at an arbitrary newline.

**Figures and charts:** Text extraction drops figures entirely. Two approaches: parse-to-markdown (VLM captions the figure, stores caption as text) for simple charts, and embed-image (crop region, embed with vision model, store pixels) for complex visuals. Best practice: crop the region, caption it with a VLM, embed the caption or the crop, and store the crop for the generation model when retrieved.

**Forms:** Forms require field-level parsing (label-value pairs), not paragraph understanding. If you chunk a form by tokens, you break it. If you miss one label-value pairing, retrieval fails quietly.

```
BAD (text extraction):
"Name: John Smith Date of Birth: 15/03/1985 Policy Number: POL-2026-001"

GOOD (field-value parsing):
{
  "name": "John Smith",
  "date_of_birth": "15/03/1985",
  "policy_number": "POL-2026-001"
}
```

## Element-aware chunking

The cardinal rule: never chunk by raw character count.

| Chunking Strategy | When to Use | What Happens |
|------------------|-------------|-------------|
| By page | Simple documents, user cites pages | Simplest, but may split sections |
| By layout region | Most production use | Heading + body, whole table, figure + caption |
| By semantic section | Long documents with clear headings | Best coherence, requires heading detection |
| By token count | NEVER for production | Splits tables, breaks forms, destroys structure |

What good chunks look like:

```
Chunk 1 (text):
  "The company reported strong Q4 results, with revenue growing 12%
   year-over-year to $4.8 billion."

Chunk 2 (table — kept whole):
  | Quarter | Revenue | Profit | Margin |
  |---------|---------|--------|--------|
  | Q1 2026 | $4.2B   | $1.1B  | 26.2%  |
  | Q2 2026 | $4.8B   | $1.4B  | 29.2%  |

Chunk 3 (figure + caption):
  [IMAGE: Chart showing revenue growth from 2023-2026]
  Caption: "Figure 3: Quarterly revenue trend showing consistent
           growth trajectory with Q4 acceleration"
```

## Metadata extraction

Metadata is not optional. It is what makes retrieved chunks verifiable, filterable, and citable. Every chunk must carry provenance information.

| Metadata Field | Why It Matters | Example |
|---------------|---------------|---------|
| Source file | Provenance, deduplication | `reports/q4-2026-financial.pdf` |
| Page number | User citation | `12` |
| Region type | Filtering (text vs table vs figure) | `table` |
| Position (bbox) | Highlighting in source | `[x1, y1, x2, y2]` |
| Section heading | Context, hierarchical filtering | `Q4 Financial Summary` |
| Document type | Routing, strategy selection | `financial-report` |
| Extraction confidence | Quality filtering | `0.94` |

Without metadata: "The revenue was $4.8B" (which document? which page?). With metadata: "In Q4 2026 Financial Report, p.12, Table 2: Revenue was $4.8B."

## Multimodal embedding

For documents with significant visual content, text embeddings alone are insufficient. Two production approaches:

**Parse-to-text RAG (recommended starting point):** PDF → Layout detection → OCR/VLM → Clean markdown → Text chunks → Text embeddings → Vector store. Cheaper, debuggable, standard RAG tools work. Best for most documents.

**Vision embedding RAG (for dense visuals):** PDF → Page rendering → Crop regions → Vision embeddings → Vector store (also store original image crop). Preserves visual information, handles charts/diagrams. More expensive, larger indexes.

**Hybrid (production recommended):** Parse-then-text for the whole corpus, plus image embeddings only for pages flagged as visually dense.

## Tool comparison

| Tool | Table Accuracy | Multi-Column | Scanned OCR | Speed | License | Best For |
|------|---------------|-------------|-------------|-------|---------|----------|
| Docling | 97.9% | 94.2% | 89.1% | 3.2 pg/s | MIT | Highest accuracy |
| Unstructured | 93.4% | 91.8% | 86.7% | 4.8 pg/s | Apache 2.0 | Broad format support |
| Marker | 91.7% | 96.1% | 84.3% | 6.1 pg/s | GPL-3.0 | Speed + multi-column |
| LlamaParse | 90%+ | 90%+ | 85%+ | 2-3 pg/s | Commercial | LLM integration |

Recommendation: Docling for accuracy-critical pipelines (finance, legal). Unstructured for diverse document types. Marker for high-throughput processing.

## Document type-specific strategies

| Document Type | Key Challenge | Strategy |
|--------------|--------------|----------|
| Financial reports | Tables with numbers, charts | Table-aware extraction, VLM chart captioning |
| Legal contracts | Dense text, cross-references | Semantic section chunking, definition preservation |
| Forms (insurance, medical) | Field-value pairs, checkboxes | Field-level parsing, never split label-value |
| Research papers | Multi-column, figures, equations | Layout-aware OCR, figure+caption pairing |
| Scanned documents | No text layer, handwriting | OCR pipeline (Tesseract, Docling OCR, VLM) |
| Slide decks | Horizontal layout, mixed content | Slide-level representation, not page-level |

## Storage: RAG vs OKF vs OFS

Once PDFs are parsed, where do you store the extracted knowledge?

| Dimension | RAG | OKF | OFS |
|-----------|-----|-----|-----|
| Core approach | Search & retrieve on demand | Maintain a persistent curated wiki | Archive original files |
| Knowledge format | Unstructured chunks / vectors | Structured markdown + YAML | Original binary files |
| Best for | Large unstructured document corpora | Curated organizational knowledge | Source of truth, re-parseable |
| Cost | $0.10-0.50/GB/month | ~$0 (Git storage) | $0.023/GB/month |
| Latency | <100ms | <10ms | 100-500ms |

The production pattern: RAG for search, OKF for curated stable knowledge (schemas, definitions, runbooks), OFS for originals. Agent first checks OKF (fast, structured, always current). If not in OKF, falls back to RAG (semantic search). If needs source, fetches from OFS.

OKF is nearly free — it is just files in a Git repo. The value is in curation, not storage.

## Anti-patterns

| Anti-Pattern | Why It Fails | Better Approach |
|-------------|-------------|-----------------|
| PDFplumber/pdfminer text dump | No layout awareness, tables destroyed | Use Docling/Unstructured with layout detection |
| Fixed token chunking | Splits tables, breaks forms | Element-aware chunking by layout region |
| No table handling | Numeric data lost | Table-specific extraction + GFM serialization |
| No figure handling | Charts invisible | VLM captioning + image embedding |
| OCR on born-digital PDFs | Slow, introduces errors | Detect digital vs scanned, use text extraction for digital |
| Single chunking strategy | Inappropriate for all document types | Route by document type, apply type-specific chunking |
| No source metadata | Cannot cite sources | Tag every chunk with page, region, element type |

## Open questions

- How do you handle PDFs with encrypted or permission-restricted content in production?
- What is the cost-performance tradeoff between VLM-based extraction and traditional OCR at scale?
- How do you detect and handle PDFs that are actually scanned images (no text layer)?
- What is the optimal chunk size for table-heavy documents vs text-heavy documents?

---

## References

1. Omdena — "Multimodal Document Parsing for RAG (2026 Guide)" (May 2026): https://omdena.com/blog/multimodal-document-parsing-for-rag/
2. MultiDocFusion — "Hierarchical and Multimodal Chunking Pipeline for Enhanced RAG" (arxiv, April 2026): https://arxiv.org/abs/2604.12352
3. MM-BizRAG — "Rethinking Multimodal RAG for Enterprise Q&A" (ACL Industry, 2026): https://arxiv.org/abs/2606.04231
4. MOCR — "Multimodal OCR: Parse Anything from Documents" (arxiv, 2026): https://arxiv.org/abs/2603.13032
5. GeekyRiolu — "MultiModal-RAG" GitHub (January 2026): https://github.com/GeekyRiolu/MultiModal-RAG
6. Unstructured — "PDF Parsing Strategies for RAG" documentation: https://docs.unstructured.io/
7. Docling — IBM Document Parsing: https://github.com/DS4SD/docling
