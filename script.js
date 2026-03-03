let selectedFiles = [];
let existingPdfBytes = null;
let generatedPdfUrl = null;

const preview = document.getElementById("preview");
const progressBar = document.getElementById("progressBar");
const downloadBtn = document.getElementById("downloadBtn");

document.getElementById("imageInput").addEventListener("change", e => {
  const files = Array.from(e.target.files);
  selectedFiles.push(...files);
  renderPreview();
  e.target.value = "";
});

document.getElementById("existingPdf").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (file) {
    existingPdfBytes = await file.arrayBuffer();
    alert("Existing PDF loaded. New images will be appended.");
  }
});

function clearImages() {
  selectedFiles = [];
  preview.innerHTML = "";
  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";
  generatedPdfUrl = null;
}

function renderPreview() {
  preview.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = e => {
      const div = document.createElement("div");
      div.className = "preview-item";
      div.draggable = true;
      div.dataset.index = index;

      div.innerHTML = `
        <button class="remove-btn" onclick="removeImage(${index})">×</button>
        <img src="${e.target.result}">
      `;

      addDragEvents(div);
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

function removeImage(index) {
  selectedFiles.splice(index, 1);
  renderPreview();
}

function addDragEvents(element) {
  element.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", element.dataset.index);
  });

  element.addEventListener("dragover", e => e.preventDefault());

  element.addEventListener("drop", e => {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain");
    const to = element.dataset.index;

    const moved = selectedFiles.splice(from, 1)[0];
    selectedFiles.splice(to, 0, moved);
    renderPreview();
  });
}

async function generatePDF() {
  if (selectedFiles.length === 0) {
    alert("Add images first.");
    return;
  }

  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";

  const { PDFDocument } = PDFLib;
  let pdfDoc;

  if (existingPdfBytes) {
    pdfDoc = await PDFDocument.load(existingPdfBytes);
  } else {
    pdfDoc = await PDFDocument.create();
  }

  for (let i = 0; i < selectedFiles.length; i++) {

    const file = selectedFiles[i];
    const bytes = await file.arrayBuffer();

    let image;
    if (file.type.includes("png")) {
      image = await pdfDoc.embedPng(bytes);
    } else {
      image = await pdfDoc.embedJpg(bytes);
    }

    const { width, height } = image.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    progressBar.style.width = ((i + 1) / selectedFiles.length) * 100 + "%";
  }

  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  generatedPdfUrl = URL.createObjectURL(blob);

  downloadBtn.style.display = "inline-block";
  progressBar.style.width = "100%";
}

function downloadPDF() {
  if (!generatedPdfUrl) return;

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isSafari) {
    window.open(generatedPdfUrl, "_blank");
  } else {
    const link = document.createElement("a");
    link.href = generatedPdfUrl;
    link.download = "converted.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
