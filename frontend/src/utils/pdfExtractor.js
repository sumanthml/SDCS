import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker using standard legacy build or inline worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Ignore if worker URL cannot be constructed statically
}

export async function extractTextFromPdfFile(file) {
  if (!file) return '';

  // Handle plain text files
  if (file.name.endsWith('.txt')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  }

  const arrayBuffer = await file.arrayBuffer();

  // Primary Method: pdfjs-dist
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    let extractedText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      extractedText += pageText + '\n';
    }

    const trimmed = extractedText.trim();
    if (trimmed.length > 30) {
      console.log(`[pdfExtractor] pdfjs extracted ${trimmed.length} chars`);
      return trimmed;
    }
  } catch (err) {
    console.warn('[pdfExtractor] pdfjs failed, using fallback stream parser:', err);
  }

  // Secondary Fallback Method: Raw PDF Stream Parser
  // Extract text from PDF stream objects: (text) Tj, [(text)] TJ, /BT.../ET
  try {
    const bytes = new Uint8Array(arrayBuffer);
    let rawStr = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      // Printable ASCII or newline/tab
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
        rawStr += String.fromCharCode(b);
      } else {
        rawStr += ' ';
      }
    }

    const textParts = [];
    // Match text inside parenthesis (String) Tj or TJ
    const matches = rawStr.match(/\(([^()]{2,100})\)\s*(?:Tj|TJ|'|")/g) || [];
    for (const m of matches) {
      const inner = m.replace(/^\(/, '').replace(/\)\s*(?:Tj|TJ|'|")$/, '').trim();
      if (inner.length > 1 && !/^[0-9\s.\-/]+$/.test(inner)) {
        textParts.push(inner);
      }
    }

    // If string matches were found
    if (textParts.length > 5) {
      const result = textParts.join(' ');
      console.log(`[pdfExtractor] Fallback stream parser extracted ${result.length} chars`);
      return result;
    }

    // Ultimate fallback: extract readable word sequences (4+ alpha chars)
    const words = rawStr.match(/[A-Za-z0-9#+.\-]{2,30}/g) || [];
    const keywords = words.filter(w => 
      /^(python|javascript|typescript|react|node|java|cpp|c\+\+|sql|html|css|docker|aws|git|api|ml|ai|data|engineer|developer|student|project|experience|skills|education|university|college|btech|mtech|bsc|msc)/i.test(w)
      || w.length > 3
    );
    const fallbackResult = keywords.join(' ');
    console.log(`[pdfExtractor] Ultimate fallback extracted ${fallbackResult.length} chars`);
    return fallbackResult;
  } catch (fallbackErr) {
    console.error('[pdfExtractor] Fallback failed:', fallbackErr);
    return file.name.replace(/\.[^/.]+$/, ''); // use filename as baseline
  }
}
