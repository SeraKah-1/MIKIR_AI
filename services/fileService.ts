
/**
 * ==========================================
 * UNIVERSAL FILE SERVICE
 * Handles extraction of text from various file formats
 * ==========================================
 */

export const extractPdfText = async (file: File, onProgress?: (p: string) => void): Promise<string> => {
  try {
    // @ts-ignore
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) throw new Error("PDF Library (pdf.js) not found in window.");
    
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const textChunks: string[] = [];
    // We can increase this limit if needed, but 50 pages is a good balance for memory
    const maxPages = Math.min(pdf.numPages, 50); 

    for (let i = 1; i <= maxPages; i++) {
      if (onProgress) onProgress(`${file.name}: Membaca Halaman ${i}/${maxPages}...`);
      
      // Yield to main thread to prevent UI freezing
      await new Promise(resolve => setTimeout(resolve, 0));

      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      textChunks.push(pageText);
      
      // @ts-ignore
      if (page.cleanup) page.cleanup();
    }
    
    return textChunks.join("\n");
  } catch (error: any) {
    console.error("PDF Extraction Error:", error);
    throw new Error(`Gagal membaca PDF ${file.name}: ` + error.message);
  }
};

export const extractYouTubeTranscript = async (html: string): Promise<string> => {
  try {
    const captionsRegex = /"captionTracks":(\[.*?\])/;
    const match = html.match(captionsRegex);
    if (!match) {
      throw new Error("Tidak ada subtitle/caption yang ditemukan di video ini. Pastikan video memiliki CC/Subtitle.");
    }
    
    const captionTracks = JSON.parse(match[1]);
    let track = captionTracks.find((t: any) => t.languageCode === 'id') || 
                captionTracks.find((t: any) => t.languageCode === 'en') || 
                captionTracks[0];
                
    if (!track || !track.baseUrl) throw new Error("URL subtitle tidak ditemukan.");
    
    const transcriptUrl = track.baseUrl;
    const transcriptResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(transcriptUrl)}`);
    const transcriptData = await transcriptResponse.json();
    const transcriptXml = transcriptData.contents;
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(transcriptXml, "text/xml");
    const textNodes = xmlDoc.getElementsByTagName("text");
    
    let transcript = "";
    for (let i = 0; i < textNodes.length; i++) {
      const text = textNodes[i].textContent || "";
      const decodedText = text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      transcript += decodedText + " ";
    }
    
    if (!transcript || !transcript.trim()) throw new Error("Subtitle kosong.");
    return transcript;
  } catch (error: any) {
    console.error("YouTube Transcript Error:", error);
    throw new Error("Gagal mengambil transkrip YouTube: " + error.message);
  }
};

export const fetchUrlContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('Network response was not ok.');
    const data = await response.json();
    const html = data.contents;
    
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      return await extractYouTubeTranscript(html);
    }
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = doc.querySelectorAll('script, style, nav, footer, header, aside');
    scripts.forEach(s => s.remove());
    
    return doc.body.textContent || "";
  } catch (error: any) {
    console.error("Error fetching URL:", error);
    throw new Error(error.message || "Gagal mengambil konten dari URL.");
  }
};

export const extractTextFromFile = async (file: File, onProgress?: (p: string) => void): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    return await extractPdfText(file, onProgress);
  }

  // Default for .txt, .md, .json, etc.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(new Error("Gagal membaca file teks."));
    reader.readAsText(file);
  });
};

/**
 * Process multiple files and combine them into a single context string
 */
export const processFilesToContext = async (files: File[], onProgress: (status: string) => void): Promise<string> => {
  let combinedContext = "";
  
  for (const file of files) {
    onProgress(`Memproses ${file.name}...`);
    const text = await extractTextFromFile(file, onProgress);
    combinedContext += `\n--- START OF FILE: ${file.name} ---\n${text}\n--- END OF FILE: ${file.name} ---\n`;
  }
  
  return combinedContext;
};
