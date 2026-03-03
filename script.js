async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const input = document.getElementById("imageInput");
    const files = input.files;

    if (files.length === 0) {
        alert("Please select images first.");
        return;
    }

    for (let i = 0; i < files.length; i++) {

        const imgData = await readFileAsDataURL(files[i]);

        const img = new Image();
        img.src = imgData;

        await new Promise(resolve => {
            img.onload = function () {

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                let imgWidth = img.width;
                let imgHeight = img.height;

                const ratio = Math.min(
                    pageWidth / imgWidth,
                    pageHeight / imgHeight
                );

                imgWidth *= ratio;
                imgHeight *= ratio;

                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;

                if (i > 0) pdf.addPage();

                pdf.addImage(img, "JPEG", x, y, imgWidth, imgHeight);
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