// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pages = [];
let sourcePdfs = []; 
let generatedUrl = null;
let draggedIndex = null;

const container = document.getElementById("pagesContainer");
const progressBar = document.getElementById("progressBar");
const downloadBtn = document.getElementById("downloadBtn");
const cropToggle = document.getElementById("enableCrop");

/* ---------------- IMAGE UPLOAD ---------------- */
document.getElementById("imageInput").addEventListener("change", async e => {
  const files = Array.from(e.target.files);
  for (let file of files) {
    let dataUrl = await readFileAsDataURL(file);
    if (cropToggle.checked) dataUrl = await smartCrop(dataUrl);
    pages.push({ type: "image", data: dataUrl });
  }
  renderPages();
  e.target.value = "";
});

function readFileAsDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

/* ---------------- PDF UPLOAD & THUMBNAILS ---------------- */
document.getElementById("existingPdf").addEventListener("change", async e => {
  const files = Array.from(e.target.files);
  for (let file of files) {
    const bytes = await file.arrayBuffer();
    const pdfId = sourcePdfs.length;
    sourcePdfs.push({ id: pdfId, bytes: bytes });

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      
      pages.push({ 
        type: "pdf", 
        pdfId: pdfId, 
        pageIndex: i - 1, 
        thumb: canvas.toDataURL("image/jpeg") 
      });
    }
  }
  renderPages();
  e.target.value = "";
});

/* ---------------- RENDER & DRAG ---------------- */
function renderPages() {
  container.innerHTML = "";
  pages.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "page-slot";
    div.draggable = true;
    div.dataset.index = index;

    const img = document.createElement("img");
    img.src = item.type === "image" ? item.data : item.thumb;
    div.appendChild(img);

    const badge = document.createElement("span");
    badge.className = "page-badge";
    badge.innerText = item.type === "image" ? `Img ${index+1}` : `PDF P.${item.pageIndex + 1}`;
    div.appendChild(badge);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = "✕";
    delBtn.onclick = () => { pages.splice(index, 1); renderPages(); };
    div.appendChild(delBtn);

    addDrag(div);
    container.appendChild(div);
  });
}

function addDrag(el) {
  el.addEventListener("dragstart", e => {
    draggedIndex = parseInt(el.dataset.index);
    setTimeout(() => el.style.opacity = "0.5", 0);
  });
  el.addEventListener("dragend", () => el.style.opacity = "1");
  el.addEventListener("dragover", e => {
    e.preventDefault();
    el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
  el.addEventListener("drop", e => {
    e.preventDefault();
    el.classList.remove("drag-over");
    const targetIndex = parseInt(el.dataset.index);
    if (draggedIndex === targetIndex) return;
    
    const movedItem = pages.splice(draggedIndex, 1)[0];
    pages.splice(targetIndex, 0, movedItem);
    renderPages();
  });
}

/* ---------------- GENERATE PDF (ORIGINAL) ---------------- */
async function generatePDF() {
  if (pages.length === 0) return;
  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";

  const pdfDoc = await PDFLib.PDFDocument.create();
  
  const loadedPdfDocs = {};
  for (let item of pages) {
    if (item.type === "pdf" && !loadedPdfDocs[item.pdfId]) {
      loadedPdfDocs[item.pdfId] = await PDFLib.PDFDocument.load(sourcePdfs[item.pdfId].bytes);
    }
  }

  for (let i = 0; i < pages.length; i++) {
    const item = pages[i];

    if (item.type === "image") {
      const imageBytes = await fetch(item.data).then(res => res.arrayBuffer());
      let img = item.data.includes("image/png") ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
      const { width, height } = img.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(img, { x: 0, y: 0, width, height });

    } else if (item.type === "pdf") {
      const sourceDoc = loadedPdfDocs[item.pdfId];
      const [copiedPage] = await pdfDoc.copyPages(sourceDoc, [item.pageIndex]);
      pdfDoc.addPage(copiedPage);
    }
    progressBar.style.width = ((i + 1) / pages.length) * 100 + "%";
  }

  const bytes = await pdfDoc.save();
  finalizeDownload(bytes);
}

/* ---------------- GENERATE PDF (FIXED A4 SIZE) ---------------- */
async function generateFixedPDF() {
  if (pages.length === 0) return;
  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";

  const pdfDoc = await PDFLib.PDFDocument.create();
  
  // Standard A4 dimensions in points
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  for (let i = 0; i < pages.length; i++) {
    const item = pages[i];
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    if (item.type === "image") {
      const imageBytes = await fetch(item.data).then(res => res.arrayBuffer());
      let img = item.data.includes("image/png") ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
      
      // Calculate scale to fit A4 while maintaining aspect ratio
      const imgDims = img.scale(1);
      const scale = Math.min(A4_WIDTH / imgDims.width, A4_HEIGHT / imgDims.height);
      const drawWidth = imgDims.width * scale;
      const drawHeight = imgDims.height * scale;
      
      // Center the image
      const x = (A4_WIDTH - drawWidth) / 2;
      const y = (A4_HEIGHT - drawHeight) / 2;
      
      page.drawImage(img, { x, y, width: drawWidth, height: drawHeight });

    } else if (item.type === "pdf") {
      // Embed the PDF page so we can draw it onto our A4 canvas
      const [embeddedPdfPage] = await pdfDoc.embedPdf(sourcePdfs[item.pdfId].bytes, [item.pageIndex]);
      
      const embDims = embeddedPdfPage.scale(1);
      const scale = Math.min(A4_WIDTH / embDims.width, A4_HEIGHT / embDims.height);
      const drawWidth = embDims.width * scale;
      const drawHeight = embDims.height * scale;
      
      const x = (A4_WIDTH - drawWidth) / 2;
      const y = (A4_HEIGHT - drawHeight) / 2;
      
      page.drawPage(embeddedPdfPage, { x, y, width: drawWidth, height: drawHeight });
    }
    
    progressBar.style.width = ((i + 1) / pages.length) * 100 + "%";
  }

  const bytes = await pdfDoc.save();
  finalizeDownload(bytes);
}

/* ---------------- HELPER TO FINALIZE DOWNLOAD ---------------- */
function finalizeDownload(bytes) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  if (generatedUrl) URL.revokeObjectURL(generatedUrl);
  generatedUrl = URL.createObjectURL(blob);
  downloadBtn.style.display = "inline-block";
}

function downloadPDF() {
  if (!generatedUrl) return;
  const link = document.createElement("a");
  link.href = generatedUrl;
  link.download = "Pro_Converted.pdf";
  link.click();
}

function clearAll() {
  pages = [];
  sourcePdfs = [];
  container.innerHTML = "";
  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";
}

/* ---------------- SMART CROP ---------------- */
function smartCrop(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let top = 0, bottom = canvas.height;

      const isDarkRow = y => {
        let dark = 0;
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if ((data[i] + data[i+1] + data[i+2]) / 3 < 65) dark++;
        }
        return dark > canvas.width * 0.70; 
      };

      while (top < bottom && isDarkRow(top)) top++;
      while (bottom > top && isDarkRow(bottom - 1)) bottom--;

      const newHeight = Math.max(1, bottom - top);
      const newCanvas = document.createElement("canvas");
      newCanvas.width = canvas.width; newCanvas.height = newHeight;
      newCanvas.getContext("2d").drawImage(canvas, 0, top, canvas.width, newHeight, 0, 0, canvas.width, newHeight);
      
      resolve(newCanvas.toDataURL("image/jpeg", 0.9));
    };
  });
}
