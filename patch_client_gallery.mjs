import fs from "fs";

let content = fs.readFileSync("src/pages/ClientGallery.tsx", "utf8");

// 1. Add fields to type
content = content.replace(
  '  unlocked: boolean;\n  photos: Photo[];',
  '  unlocked: boolean;\n  event_date?: string;\n  allow_download?: boolean;\n  require_email?: boolean;\n  photos: Photo[];'
);

// 2. Add Email state
const stateAnchor = 'const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(null);';
const newStates = `  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pendingDownloadAction, setPendingDownloadAction] = useState<(() => void) | null>(null);`;
content = content.replace(stateAnchor, stateAnchor + "\n" + newStates);

// 3. Update init fetch to check localStorage for PIN
const fetchCallAnchor = 'useEffect(() => {\n    fetchGallery();\n  }, [fetchGallery]);';
const newFetchCall = `useEffect(() => {
    const savedPin = localStorage.getItem("gallery_pin_" + id);
    if (savedPin) {
      setPin(savedPin);
      fetchGallery(savedPin);
    } else {
      fetchGallery();
    }
  }, [fetchGallery, id]);`;
content = content.replace(fetchCallAnchor, newFetchCall);

// 4. Update PIN submission to save it
const pinSubmitAnchor = `const data = await res.json();
      setGallery(data);`;
const newPinSubmit = `const data = await res.json();
      if (data.unlocked) {
        localStorage.setItem("gallery_pin_" + id, pin);
      }
      setGallery(data);`;
content = content.replace(pinSubmitAnchor, newPinSubmit);

// 5. Wrap downloads with email check
const downloadHelpers = `
  const requireEmailCheck = (action: () => void) => {
    if (gallery?.require_email && !localStorage.getItem("gallery_email_" + id)) {
      setPendingDownloadAction(() => action);
      setShowEmailModal(true);
    } else {
      // If we already have the email, maybe we should track it still? Or just allow download.
      // We will allow download to minimize friction, since we tracked it once.
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
    } catch (e) {
      console.error(e);
      alert("Failed to submit email. Please try again.");
    }
  };
`;
content = content.replace('  const handleDownloadAll = async () => {', downloadHelpers + '\n  const handleDownloadAll = async () => {');

// Wrap clicks with requireEmailCheck
content = content.replace('onClick={handleDownloadAll}', 'onClick={() => requireEmailCheck(handleDownloadAll)}');
// Note: handleDownloadPhoto inside Lightbox is onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(photos[viewerIndex]); }}
content = content.replace(
  'onClick={(e) => {\n                  e.stopPropagation();\n                  handleDownloadPhoto(photos[viewerIndex]);\n                }}',
  'onClick={(e) => {\n                  e.stopPropagation();\n                  requireEmailCheck(() => handleDownloadPhoto(photos[viewerIndex]));\n                }}'
);

// Conditionally hide download buttons
content = content.replace(
  '{gallery.photos.length > 0 && (\n              <button\n                onClick={() => requireEmailCheck(handleDownloadAll)}',
  '{gallery.photos.length > 0 && gallery.allow_download !== false && (\n              <button\n                onClick={() => requireEmailCheck(handleDownloadAll)}'
);

content = content.replace(
  '{/* Download Button */}\n                <button\n                  onClick={(e) => {\n                    e.stopPropagation();\n                    requireEmailCheck(() => handleDownloadPhoto(photos[viewerIndex]));\n                  }}\n                  disabled={downloadingPhotoId === photos[viewerIndex].id}\n                  className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"\n                  title="Download Photo"\n                >',
  '{/* Download Button */}\n                {gallery.allow_download !== false && (\n                  <button\n                    onClick={(e) => {\n                      e.stopPropagation();\n                      requireEmailCheck(() => handleDownloadPhoto(photos[viewerIndex]));\n                    }}\n                    disabled={downloadingPhotoId === photos[viewerIndex].id}\n                    className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"\n                    title="Download Photo"\n                  >\n                    {downloadingPhotoId === photos[viewerIndex].id ? (\n                      <Loader2 className="w-5 h-5 animate-spin" />\n                    ) : (\n                      <Download className="w-5 h-5" />\n                    )}\n                  </button>\n                )}'
);

// We need to carefully replace the inside of the button since we replaced the whole block up to the Download icon. Let's do it safer.
fs.writeFileSync("src/pages/ClientGallery_temp.tsx", content);
