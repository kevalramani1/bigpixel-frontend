import fs from "fs";

let content = fs.readFileSync("src/pages/ClientGallery.tsx", "utf8");

// Add Mail icon
content = content.replace(
  'import { Lock, Download, Camera, Loader2, Play, Pause, ChevronLeft, ChevronRight, X } from "lucide-react";',
  'import { Lock, Download, Camera, Loader2, Play, Pause, ChevronLeft, ChevronRight, X, Mail } from "lucide-react";'
);

// Add fields to type Gallery
content = content.replace(
  '  unlocked: boolean;\n  photos: Photo[];',
  '  unlocked: boolean;\n  event_date?: string;\n  allow_download?: boolean;\n  require_email?: boolean;\n  photos: Photo[];'
);

// Add email tracking state
const stateAnchor = 'const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(null);';
const stateNew = `  const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(null);
  
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pendingDownloadAction, setPendingDownloadAction] = useState<(() => void) | null>(null);

  const requireEmailCheck = (action: () => void) => {
    if (gallery?.require_email && !localStorage.getItem("gallery_email_" + id)) {
      setPendingDownloadAction(() => action);
      setShowEmailModal(true);
    } else {
      action();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) return;
    try {
      await fetch("http://localhost:8000/api/galleries/" + id + "/track-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput })
      });
      localStorage.setItem("gallery_email_" + id, emailInput);
      setShowEmailModal(false);
      if (pendingDownloadAction) pendingDownloadAction();
    } catch (err) {
      console.error(err);
      alert("Failed to submit email. Please try again.");
    }
  };
`;
content = content.replace(stateAnchor, stateNew);

// Replace fetchCall
content = content.replace(
  'useEffect(() => {\n    fetchGallery();\n  }, [fetchGallery]);',
  `useEffect(() => {
    const savedPin = localStorage.getItem("gallery_pin_" + id);
    if (savedPin) {
      setPin(savedPin);
      fetchGallery(savedPin);
    } else {
      fetchGallery();
    }
  }, [fetchGallery, id]);`
);

// Replace PIN unlock success
content = content.replace(
  'const data = await res.json();\n      setGallery(data);',
  `const data = await res.json();\n      if (data.unlocked) {\n        localStorage.setItem("gallery_pin_" + id, pin);\n      }\n      setGallery(data);`
);

// Replace downloadGalleryZip onClick
content = content.replace(
  'onClick={downloadGalleryZip}',
  'onClick={() => requireEmailCheck(downloadGalleryZip)}'
);

// Replace downloadPhoto in grid onClick
content = content.replace(
  'onClick={(e) => downloadPhoto(photo, e)}',
  'onClick={(e) => {\n                  e.stopPropagation();\n                  requireEmailCheck(() => downloadPhoto(photo, e));\n                }}'
);

// Replace downloadPhoto in lightbox onClick
content = content.replace(
  'onClick={(e) => downloadPhoto(gallery.photos[viewerIndex], e)}',
  'onClick={(e) => {\n                e.stopPropagation();\n                requireEmailCheck(() => downloadPhoto(gallery.photos[viewerIndex], e));\n              }}'
);

// Conditionally render download button for Download All
content = content.replace(
  '        <button\n          onClick={() => requireEmailCheck(downloadGalleryZip)}',
  '        {gallery.allow_download !== false && (\n        <button\n          onClick={() => requireEmailCheck(downloadGalleryZip)}'
);
content = content.replace(
  'Download All\n            </>\n          )}\n        </button>',
  'Download All\n            </>\n          )}\n        </button>\n        )}'
);

// Conditionally render grid download button
content = content.replace(
  '              <button\n                onClick={(e) => {',
  '              {gallery.allow_download !== false && (\n              <button\n                onClick={(e) => {'
);
content = content.replace(
  '                  <Download className="w-4 h-4" />\n                )}\n              </button>',
  '                  <Download className="w-4 h-4" />\n                )}\n              </button>\n              )}'
);

// Conditionally render lightbox download button
content = content.replace(
  '            <button\n              onClick={(e) => {',
  '            {gallery.allow_download !== false && (\n            <button\n              onClick={(e) => {'
);
content = content.replace(
  '              title="Download Photo"\n            >\n              {downloadingPhotoId === gallery.photos[viewerIndex].id ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}\n            </button>',
  '              title="Download Photo"\n            >\n              {downloadingPhotoId === gallery.photos[viewerIndex].id ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}\n            </button>\n            )}'
);


// Add email modal at the end before closing div
const modalUI = `
      {/* Email Collection Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowEmailModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mb-6 text-black mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-black">Download Photos</h3>
            <p className="text-sm text-center text-neutral-500 mb-6">
              Please enter your email address to download these photos.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 focus:border-black rounded-xl outline-none"
              />
              <button
                type="submit"
                className="w-full bg-black text-white font-medium py-3 rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Continue Download
              </button>
            </form>
          </div>
        </div>
      )}
`;
content = content.replace(
  '    </div>\n  );\n}\n',
  modalUI + '    </div>\n  );\n}\n'
);

fs.writeFileSync("src/pages/ClientGallery.tsx", content);
