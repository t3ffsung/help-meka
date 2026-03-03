async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const input = document.getElementById("imageInput");
    const files = Array.from(input.files);

    if (files.length === 0) {
        alert("Select images first.");
        return;
    }

    // Keep original selection order
    files.sort((a, b) => a.lastModified - b.lastModified);

    let pdf;
    let pageWidth;
    let pageHeight;

    for (let i = 0; i < files.length; i++) {

        const imgData = await readFileAsDataURL(files[i]);
        const croppedData = await cropBlackBorders(imgData);

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

        // Scale image to fit SAME page size
        const ratio = Math.min(
            pageWidth / img.width,
            pageHeight / img.height
        );

        const imgWidth = img.width * ratio;
        const imgHeight = img.height * ratio;

        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        pdf.addImage(img, "JPEG", x, y, imgWidth, imgHeight);
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


function cropBlackBorders(imageData) {
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

            let top = 0, bottom = canvas.height, left = 0, right = canvas.width;

            function isBlackRow(y) {
                for (let x = 0; x < canvas.width; x++) {
                    const index = (y * canvas.width + x) * 4;
                    if (data[index] > 25 || data[index + 1] > 25 || data[index + 2] > 25)
                        return false;
                }
                return true;
            }

            function isBlackColumn(x) {
                for (let y = 0; y < canvas.height; y++) {
                    const index = (y * canvas.width + x) * 4;
                    if (data[index] > 25 || data[index + 1] > 25 || data[index + 2] > 25)
                        return false;
                }
                return true;
            }

            while (top < bottom && isBlackRow(top)) top++;
            while (bottom > top && isBlackRow(bottom - 1)) bottom--;
            while (left < right && isBlackColumn(left)) left++;
            while (right > left && isBlackColumn(right - 1)) right--;

            const newWidth = right - left;
            const newHeight = bottom - top;

            const croppedCanvas = document.createElement("canvas");
            const croppedCtx = croppedCanvas.getContext("2d");

            croppedCanvas.width = newWidth;
            croppedCanvas.height = newHeight;

            croppedCtx.drawImage(
                canvas,
                left, top, newWidth, newHeight,
                0, 0, newWidth, newHeight
            );

            resolve(croppedCanvas.toDataURL("image/jpeg", 1.0));
        };
    });
}
