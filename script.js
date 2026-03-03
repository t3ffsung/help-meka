let pages = []; 
let generatedUrl = null;
const container = document.getElementById("pagesContainer");
const progressBar = document.getElementById("progressBar");
const downloadBtn = document.getElementById("downloadBtn");

document.getElementById("imageInput").addEventListener("change", async e => {
  const files = Array.from(e.target.files);

  for (let file of files) {
    const cropped = await smartCropFile(file);
    pages.push({ type: "image", data: cropped });
  }

  renderPages();
  e.target.value = "";
});

document.getElementById("existingPdf").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFLib.PDFDocument.load(bytes);

  const copied = await PDFLib.PDFDocument.create();
  const copiedPages = await copied.copyPages(pdfDoc, pdfDoc.getPageIndices());

  for (let p of copiedPages) {
    pages.push({ type: "pdfPage", data: p });
  }

  renderPages();
});

function renderPages() {
  container.innerHTML = "";

  pages.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "page-slot";
    div.draggable = true;
    div.dataset.index = index;

    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.data;
      div.appendChild(img);
    } else {
      div.innerHTML = "<span>Existing PDF Page</span>";
    }

    addDrag(div);
    container.appendChild(div);
  });
}

function addDrag(el) {
  el.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text", el.dataset.index);
  });

  el.addEventListener("dragover", e => e.preventDefault());

  el.addEventListener("drop", e => {
    e.preventDefault();
    const from = e.dataTransfer.getData("text");
    const to = el.dataset.index;

    const moved = pages.splice(from, 1)[0];
    pages.splice(to, 0, moved);
    renderPages();
  });
}

async function generatePDF() {
  if (pages.length === 0) return;

  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";

  const pdfDoc = await PDFLib.PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {
    const item = pages[i];

    if (item.type === "image") {
      const imageBytes = await fetch(item.data).then(res => res.arrayBuffer());
      const img = await pdfDoc.embedJpg(imageBytes);
      const { width, height } = img.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(img, { x: 0, y: 0, width, height });
    } else {
      pdfDoc.addPage(item.data);
    }

    progressBar.style.width = ((i + 1) / pages.length) * 100 + "%";
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  generatedUrl = URL.createObjectURL(blob);

  downloadBtn.style.display = "inline-block";
}

function downloadPDF() {
  if (!generatedUrl) return;

  const link = document.createElement("a");
  link.href = generatedUrl;
  link.download = "converted.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function clearAll() {
  pages = [];
  container.innerHTML = "";
  progressBar.style.width = "0%";
  downloadBtn.style.display = "none";
}

/* -------- SMART CROP -------- */

function smartCropFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => smartCrop(e.target.result).then(resolve);
    reader.readAsDataURL(file);
  });
}

function smartCrop(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.src = dataUrl;

    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let top = 0;
      let bottom = canvas.height;

      function isDarkRow(y) {
        let dark = 0;
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
          if (brightness < 65) dark++;
        }
        return dark > canvas.width * 0.92;
      }

      while (top < bottom && isDarkRow(top)) top++;
      while (bottom > top && isDarkRow(bottom-1)) bottom--;

      const newHeight = bottom - top;

      const newCanvas = document.createElement("canvas");
      const newCtx = newCanvas.getContext("2d");

      newCanvas.width = canvas.width;
      newCanvas.height = newHeight;

      newCtx.drawImage(canvas, 0, top, canvas.width, newHeight, 0, 0, canvas.width, newHeight);

      resolve(newCanvas.toDataURL("image/jpeg", 1));
    };
  });
}
