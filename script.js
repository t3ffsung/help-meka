let selectedFiles = [];

document.getElementById("imageInput").addEventListener("change", function (e) {
    const newFiles = Array.from(e.target.files);
    selectedFiles = selectedFiles.concat(newFiles);
    updateImageCount();
    e.target.value = ""; // reset so same file can be added again
});


function updateImageCount() {
    document.getElementById("imageCount").innerText =
        "Total Images Selected: " + selectedFiles.length;
}


function clearImages() {
    selectedFiles = [];
    updateImageCount();
}


async function generatePDF() {
    const { jsPDF } = window.jspdf;

    if (selectedFiles.length === 0) {
        alert("Select images first.");
        return;
    }

    let pdf;
    let pageWidth;
    let pageHeight;

    for (let i = 0; i < selectedFiles.length; i++) {

        const imgData = await readFileAsDataURL(selectedFiles[i]);
        const croppedData = await smartCrop(imgData);
        const img = await loadImage(croppedData);

        if (i === 0) {
            pageWidth = img.width;
            pageHeight = img.height;

            pdf = new jsPDF({
                orientation: pageWidth > pageHeight ? "l" : "p",
                unit: "px",
                format: [pageWidth, pageHeight]
            });
        } else {
            pdf.addPage([pageWidth, pageHeight],
                pageWidth > pageHeight ? "l" : "p");
        }

        pdf.addImage(img, "JPEG", 0, 0, pageWidth, pageHeight);
    }

    pdf.save("converted.pdf");
}


function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}


function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
    });
}


/* ---------- SMART CROP ---------- */

function smartCrop(imageData) {
    return new Promise(resolve => {
        const img = new Image();
        img.src = imageData;

        img.onload = function () {

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(img, 0, 0);

            const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageDataObj.data;

            const width = canvas.width;
            const height = canvas.height;

            let top = 0;
            let bottom = height;

            function isMostlyDarkRow(y) {
                let darkPixels = 0;

                for (let x = 0; x < width; x++) {
                    const index = (y * width + x) * 4;

                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];

                    const brightness = (r + g + b) / 3;

                    if (brightness < 60) darkPixels++;
                }

                return darkPixels > width * 0.9;
            }

            while (top < bottom && isMostlyDarkRow(top)) top++;
            while (bottom > top && isMostlyDarkRow(bottom - 1)) bottom--;

            const newHeight = bottom - top;

            const croppedCanvas = document.createElement("canvas");
            const croppedCtx = croppedCanvas.getContext("2d");

            croppedCanvas.width = width;
            croppedCanvas.height = newHeight;

            croppedCtx.drawImage(
                canvas,
                0, top, width, newHeight,
                0, 0, width, newHeight
            );

            resolve(croppedCanvas.toDataURL("image/jpeg", 1.0));
        };
    });
}
