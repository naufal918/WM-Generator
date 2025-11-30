import React, { useEffect, useRef, useState } from "react";

const FONT_OPTIONS = [
  { label: "System (default)", value: "system-ui, -apple-system, 'Segoe UI', Roboto" },
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, -apple-system" },
  { label: "Poppins", value: "'Poppins', system-ui, -apple-system" },
  { label: "Roboto", value: "'Roboto', system-ui, -apple-system" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
];

export default function App() {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);

  const [wmImageFile, setWmImageFile] = useState(null);
  const [wmImageURL, setWmImageURL] = useState(null);

  const [wmText, setWmText] = useState("© 2025 MyBrand");
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.8);

  const [position, setPosition] = useState("southeast");
  const [downloadFormat, setDownloadFormat] = useState("jpeg");

  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject("Failed to load image");
      img.src = url;
    });
  }

  /** AUTO RESIZE FUNCTION **/
  function resizeCanvas(srcCanvas, maxW = 3000) {
    if (srcCanvas.width <= maxW) return srcCanvas;

    const scale = maxW / srcCanvas.width;
    const canvas = document.createElement("canvas");
    canvas.width = maxW;
    canvas.height = srcCanvas.height * scale;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  useEffect(() => {
    if (photoURL) URL.revokeObjectURL(photoURL);
    if (photoFile) setPhotoURL(URL.createObjectURL(photoFile));
  }, [photoFile]);

  useEffect(() => {
    if (wmImageURL) URL.revokeObjectURL(wmImageURL);
    if (wmImageFile) setWmImageURL(URL.createObjectURL(wmImageFile));
  }, [wmImageFile]);

  useEffect(() => {
    drawPreview();
  }, [photoURL, wmImageURL, wmText, fontFamily, fontSize, opacity, position]);

  function calcPosition(baseW, baseH, wmW, wmH, gravity) {
    const m = 20;
    const pos = {
      northwest: [m, m],
      north: [(baseW - wmW) / 2, m],
      northeast: [baseW - wmW - m, m],
      west: [m, (baseH - wmH) / 2],
      center: [(baseW - wmW) / 2, (baseH - wmH) / 2],
      east: [baseW - wmW - m, (baseH - wmH) / 2],
      southwest: [m, baseH - wmH - m],
      south: [(baseW - wmW) / 2, baseH - wmH - m],
      southeast: [baseW - wmW - m, baseH - wmH - m],
    };
    return { x: Math.round(pos[gravity][0]), y: Math.round(pos[gravity][1]) };
  }

  async function drawFull(photoURL, wmURL) {
    const img = await loadImage(photoURL);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    // Watermark image
    if (wmURL) {
      const wm = await loadImage(wmURL);
      const base = Math.min(canvas.width, canvas.height);
      const wmW = Math.min(300, Math.round(base * 0.25));
      const wmH = Math.round(wmW * (wm.height / wm.width));

      const pos = calcPosition(canvas.width, canvas.height, wmW, wmH, position);

      ctx.globalAlpha = opacity;
      ctx.drawImage(wm, pos.x, pos.y, wmW, wmH);
      return canvas;
    }

    // Watermark text
    if (wmText) {
      const temp = document.createElement("canvas");
      const t = temp.getContext("2d");

      t.font = `${fontSize}px ${fontFamily}`;
      const w = t.measureText(wmText).width;
      const h = fontSize * 1.2;

      temp.width = w;
      temp.height = h;

      t.font = `${fontSize}px ${fontFamily}`;
      t.fillStyle = `rgba(255,255,255,${opacity})`;
      t.textBaseline = "top";
      t.fillText(wmText, 0, 0);

      const pos = calcPosition(canvas.width, canvas.height, w, h, position);

      ctx.drawImage(temp, pos.x, pos.y);
    }

    return canvas;
  }

  async function drawPreview() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const containerWidth = canvas.parentElement.offsetWidth;
    const maxPreviewWidth = Math.min(containerWidth, 900);

    if (!photoURL) {
      canvas.width = maxPreviewWidth;
      canvas.height = maxPreviewWidth * 0.55;

      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ccc";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Upload an image to preview", canvas.width / 2, canvas.height / 2);
      return;
    }

    const full = await drawFull(photoURL, wmImageURL);

    const scale = maxPreviewWidth / full.width;
    const w = full.width * scale;
    const h = full.height * scale;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(full, 0, 0, w, h);
  }

  async function download() {
    setLoading(true);

    let full = await drawFull(photoURL, wmImageURL);

    // AUTO RESIZE (ke max 4500px)
    full = resizeCanvas(full, 4500);

    let dataURL;

    if (downloadFormat === "jpeg") {
      // Kompres aman anti-file-meleduk
      dataURL = full.toDataURL("image/jpeg", 0.55);
    } else {
      dataURL = full.toDataURL(`image/${downloadFormat}`);
    }

    if (downloadFormat === "png") {
      full = resizeCanvas(full, 2000); // PNG khusus dikecilkan
    } else {
      dataURL = full.toDataURL("image/png");
    }
    
    
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `watermarked.${downloadFormat}`;
    a.click();

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

      <div className="flex items-center justify-center gap-3 py-2">
  <img 
    src="img/logo1.png" 
    alt="Logo" 
    className="w-8 h-8 md:w-10 md:h-10 object-contain"
  />
  <h1 className="text-2xl md:text-3xl font-bold text-white">
    Watermark Generator
  </h1>
</div>

        <div className="w-full overflow-hidden rounded-xl shadow-xl">
          <canvas ref={canvasRef} className="w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-xl space-y-4">
            <div>
              <label className="text-sm font-medium">Upload Photo</label>
              <input type="file" accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files[0])}
                className="mt-2 block w-full text-sm" />
            </div>

            <div>
              <label className="text-sm font-medium">Watermark Image (optional)</label>
              <input type="file" accept="image/*"
                onChange={(e) => setWmImageFile(e.target.files[0])}
                className="mt-2 block w-full text-sm" />
            </div>

            <div>
              <label className="text-sm font-medium">Watermark Text</label>
              <input
                className="mt-2 w-full p-2 rounded bg-gray-800 border border-gray-700"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="mt-2 w-full p-2 bg-gray-800 rounded border border-gray-700"
              >
                {FONT_OPTIONS.map(f => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Font Size (Disarankan 80)</label>
              <input
                type="number"
                className="mt-2 w-full p-2 bg-gray-800 rounded border border-gray-700"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Opacity: {opacity}</label>
              <input type="range" min="0.05" max="1" step="0.01"
                className="mt-2 w-full"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))} />
            </div>
          </div>

          {/* RIGHT */}
          <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-xl space-y-5">

            <div>
              <label className="text-sm font-medium">Position</label>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  "northwest","north","northeast",
                  "west","center","east",
                  "southwest","south","southeast"
                ].map(p => (
                  <button
                    key={p}
                    onClick={() => setPosition(p)}
                    className={`py-2 rounded text-xs md:text-sm ${
                      position === p ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Download Format</label>
              <select
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value)}
                className="mt-2 w-full p-2 bg-gray-800 rounded border border-gray-700"
              >
                <option value="jpeg">JPEG (recommended)</option>
                <option value="png">PNG</option>
                <option value="webp">WEBP</option>
              </select>
            </div>

            <button
              onClick={download}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg shadow-md"
            >
              {loading ? "Processing..." : "Download"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
