async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const input = document.getElementById("imageInput");
    const files = input.files;

    if (files.length === 0) {
        alert("Select images first.");
        return;
    }

    let pdf;

    for (let i = 0; i < files.length; i++) {

        const imgData = await readFileAsDataURL(files[i]);
        const croppedData = await cropBlackBorders(imgData);

        const img = new Image();
        img.src = croppedData;

        await new Promise(resolve => {
            img.onload = function () {

                const imgWidth = img.width;
                const imgHeight = img.height;

                if (i === 0) {
                    pdf = new jsPDF({
                        orientation: imgWidth > imgHeight ? "l" : "p",
                        unit: "px",
                        format: [imgWidth, imgHeight]
                    });
                } else {
                    pdf.addPage([imgWidth, imgHeight], imgWidth > imgHeight ? "l" : "p");
                }

                pdf.addImage(img, "JPEG", 0, 0, imgWidth, imgHeight);
                resolve();
            };
        });
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
                    if (data[index] > 20 || data[index + 1] > 20 || data[index + 2] > 20)
                        return false;
                }
                return true;
            }

            function isBlackColumn(x) {
                for (let y = 0; y < canvas.height; y++) {
                    const index = (y * canvas.width + x) * 4;
                    if (data[index] > 20 || data[index + 1] > 20 || data[index + 2] > 20)
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
