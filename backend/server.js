const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 60 * 1024 * 1024 }
});

// Escape XML for SVG
function escapeXml(unsafe) {
    return unsafe.replace(/[&<>"']/g, function(c) {
        switch (c) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&apos;";
        }
    });
}

// Create SVG for text watermark
function createTextSVG(text, fontSize, color, fontFamily) {
    const height = Math.ceil(fontSize * 1.2);
    const y = Math.round(fontSize * 0.9);

    return Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="2000" height="${height}">
            <style>
                .t {
                    fill: ${color};
                    font-size: ${fontSize}px;
                    font-family: ${fontFamily};
                }
            </style>
            <text x="0" y="${y}" class="t">${escapeXml(text)}</text>
        </svg>
    `);
}

app.post(
    "/api/watermark",
    upload.fields([
        { name: "photo", maxCount: 1 },
        { name: "watermarkImage", maxCount: 1 }
    ]),
    async(req, res) => {
        try {
            if (!req.files || !req.files.photo || !req.files.photo[0]) {
                return res.status(400).json({ error: "photo required" });
            }

            const photoBuffer = req.files.photo[0].buffer;

            // Watermark image file
            let watermarkImageBuffer = null;
            if (
                req.files &&
                req.files.watermarkImage &&
                Array.isArray(req.files.watermarkImage) &&
                req.files.watermarkImage.length > 0 &&
                req.files.watermarkImage[0].buffer
            ) {
                watermarkImageBuffer = req.files.watermarkImage[0].buffer;
            }

            const metaBase = await sharp(photoBuffer).metadata();

            // Inputs
            const watermarkText = req.body.watermarkText || null;
            const opacity = req.body.opacity ? parseFloat(req.body.opacity) : 1;

            const fontSize = req.body.fontSize ? parseInt(req.body.fontSize) : 48;
            const fontFamily = req.body.fontFamily || "Arial, sans-serif";
            const fontColor = req.body.fontColor || "#ffffff";

            const posX = req.body.posX ? parseInt(req.body.posX) : 0;
            const posY = req.body.posY ? parseInt(req.body.posY) : 0;
            const wmWidth = req.body.wmWidth ? parseInt(req.body.wmWidth) : null;
            const wmHeight = req.body.wmHeight ? parseInt(req.body.wmHeight) : null;

            const outFormat = (req.body.format || "").toLowerCase();

            let wmBuffer = null;

            // 1. Watermark image
            if (watermarkImageBuffer) {
                let wmSharp = sharp(watermarkImageBuffer).rotate();

                if (wmWidth || wmHeight) {
                    wmSharp = wmSharp.resize({
                        width: wmWidth || null,
                        height: wmHeight || null,
                        fit: "inside"
                    });
                } else {
                    const targetW = Math.round(metaBase.width * 0.25);
                    wmSharp = wmSharp.resize({ width: targetW });
                }

                wmBuffer = await wmSharp.png().toBuffer();
            }

            // 2. Watermark text
            if (!wmBuffer && watermarkText) {
                const svg = createTextSVG(
                    watermarkText,
                    fontSize,
                    fontColor,
                    fontFamily
                );

                let textPng = sharp(svg).png();

                if (wmWidth || wmHeight) {
                    textPng = textPng.resize({
                        width: wmWidth || null,
                        height: wmHeight || null,
                        fit: "inside"
                    });
                }

                wmBuffer = await textPng.toBuffer();
            }

            if (!wmBuffer) {
                return res.status(400).json({ error: "Provide watermarkText or watermarkImage" });
            }

            // Opacity
            if (opacity < 1) {
                const meta = await sharp(wmBuffer).metadata();
                const opacitySvg = Buffer.from(`
                    <svg width="${meta.width}" height="${meta.height}">
                        <rect width="100%" height="100%" fill="white" opacity="${opacity}"/>
                    </svg>
                `);

                wmBuffer = await sharp(wmBuffer)
                    .ensureAlpha()
                    .composite([{ input: opacitySvg, blend: "dest-in" }])
                    .png()
                    .toBuffer();
            }

            // FINAL COMPOSITE
            const compositeOptions = {
                input: wmBuffer,
                left: posX,
                top: posY,
                blend: "over"
            };

            let out = sharp(photoBuffer).composite([compositeOptions]);

            if (outFormat === "png") out = out.png({ quality: 100 });
            else if (outFormat === "webp") out = out.webp({ quality: 95 });
            else out = out.jpeg({ quality: 95 });

            const outputBuffer = await out.toBuffer();

            res.set("Content-Type", "image/" + (outFormat || "jpeg"));
            res.send(outputBuffer);

        } catch (err) {
            console.error("ERR:", err);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

app.listen(4000, () => console.log("Server listening on :4000"));