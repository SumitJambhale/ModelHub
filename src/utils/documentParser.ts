import mammoth from 'mammoth';

export interface ExtractedDoc {
  name: string;
  size: number;
  text: string;
  truncated: boolean;
  rawLength: number;
}

const MAX_DOC_CHARS = 60000;

export async function parseDocumentFile(file: File): Promise<ExtractedDoc> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let extractedText = '';

  if (extension === 'txt' || extension === 'md') {
    extractedText = await file.text();
  } else if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    extractedText = result.value || '';
  } else if (extension === 'pdf') {
    extractedText = await extractPdfText(file);
  } else {
    throw new Error(`Unsupported file type: .${extension}. Please upload a .pdf, .docx, .txt, or .md file.`);
  }

  const rawLength = extractedText.trim().length;
  if (rawLength === 0) {
    throw new Error(`"${file.name}" appears to be empty`);
  }

  let truncated = false;
  let finalText = extractedText;
  if (extractedText.length > MAX_DOC_CHARS) {
    truncated = true;
    finalText = extractedText.slice(0, MAX_DOC_CHARS);
  }

  return {
    name: file.name,
    size: file.size,
    text: finalText,
    truncated,
    rawLength,
  };
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    // Dynamically import pdfjs-dist to optimize loading
    const pdfjsLib = await import('pdfjs-dist');
    // Configure worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n\n';
      
      // Stop early if text is already exceedingly large
      if (fullText.length > MAX_DOC_CHARS * 2) {
        break;
      }
    }

    return fullText.trim();
  } catch (err: any) {
    // If worker fails, fallback to simple string extraction from streams
    const fallbackText = extractTextFromRawPdfBuffer(arrayBuffer);
    if (fallbackText && fallbackText.length > 50) {
      return fallbackText;
    }
    throw new Error(err.message || 'Corrupted, encrypted, or unsupported PDF');
  }
}

function extractTextFromRawPdfBuffer(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(buffer);
    const matches = raw.match(/\(([^()]{2,})\)\s*T[jJ]/g) || [];
    const textPieces = matches.map((m) => {
      const inner = m.replace(/\)\s*T[jJ]/, '').replace(/^\(/, '');
      return inner.replace(/\\([()\\])/g, '$1');
    });
    return textPieces.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}
