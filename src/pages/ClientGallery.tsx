import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Lock, ArrowRight, Download, Play, Pause, ChevronLeft, ChevronRight, X,  Loader2, Mail } from "lucide-react";
import JSZip from "jszip";

// Define Types
type Photo = {
  id: number;
  url: string;
  preview_url?: string;
  thumbnail_url?: string;
  order_index: number;
};

type Gallery = {
  id: number;
  name: string;
  cover_title?: string;
  description?: string;
  cover_photo_url?: string;
  is_locked: boolean;
  unlocked: boolean;
  event_date?: string;
  allow_download?: boolean;
  allow_bulk_download?: boolean;
  require_email?: boolean;
  photos: Photo[];
};


function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
  });
  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return windowSize;
}

export default function ClientGallery() {
  const { id } = useParams<{ id: string }>();
  useWindowSize(); // Trigger re-render on resize for masonry
  
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState("");
  
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  
  // Lightbox State
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [imageRatios, setImageRatios] = useState<Record<number, number>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
    const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(null);
  
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
      await fetch(( (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '') + ( (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.endsWith('/api')) ? '/api' : '' ) ) + "/galleries/" + id + "/track-download", {
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchGallery = React.useCallback(async (pinAttempt?: string) => {
    try {
      if (!pinAttempt) {
        setLoading(true);
      }
      setError("");
      setPinError("");
      
      let url = `${( (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '') + ( (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.endsWith('/api')) ? '/api' : '' ) )}/galleries/${id}/public`;
      if (pinAttempt) {
        url += `?pin=${encodeURIComponent(pinAttempt)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Gallery not found.");
        throw new Error("Failed to load gallery.");
      }
      
      const data: Gallery = await res.json();
      setGallery(data);

      if (data.is_locked) {
        if (pinAttempt) {
          if (data.unlocked) {
            localStorage.setItem(`gallery_pin_${id}`, pinAttempt);
          } else {
            setPinError("Incorrect PIN. Please try again.");
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred.");
      }
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      const savedPin = localStorage.getItem(`gallery_pin_${id}`);
      if (savedPin) {
        setPin(savedPin);
        void fetchGallery(savedPin);
      } else {
        void fetchGallery();
      }
    }
  }, [id, fetchGallery]);

  // Slideshow Effect
  useEffect(() => {
    if (isPlaying && viewerIndex !== null && gallery) {
      timerRef.current = setTimeout(() => {
        setViewerIndex((prev) => (prev! + 1) % gallery.photos.length);
      }, 3000); // 3 seconds per slide
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, viewerIndex, gallery]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setVerifying(true);
    fetchGallery(pin);
  };

  const downloadPhoto = async (photo: Photo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingPhotoId(photo.id);
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `photo_${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download photo", err);
      alert("Failed to download photo. Please try again.");
    } finally {
      setDownloadingPhotoId(null);
    }
  };

  const downloadGalleryZip = async () => {
    if (!gallery || gallery.photos.length === 0) return;
    try {
      setDownloadingZip(true);
      const zip = new JSZip();
      const folder = zip.folder(gallery.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || "gallery");
      
      const promises = gallery.photos.map(async (photo, index) => {
        const res = await fetch(photo.url);
        const blob = await res.blob();
        folder?.file(`photo_${index + 1}.jpg`, blob);
      });
      
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${gallery.name || 'gallery'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to create ZIP", err);
      alert("Failed to download gallery ZIP. Please try again.");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Lightbox Navigation
  const closeLightbox = () => {
    setViewerIndex(null);
    setIsPlaying(false);
  };
  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (gallery) {
      setViewerIndex((prev) => (prev! - 1 + gallery.photos.length) % gallery.photos.length);
    }
  };
  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (gallery) {
      setViewerIndex((prev) => (prev! + 1) % gallery.photos.length);
    }
  };
  
  // Handle Escape and Arrow Keys for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewerIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") {
        setViewerIndex((prev) => (prev! - 1 + gallery!.photos.length) % gallery!.photos.length);
      }
      if (e.key === "ArrowRight") {
        setViewerIndex((prev) => (prev! + 1) % gallery!.photos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerIndex, gallery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Oops!</h1>
          <p className="text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!gallery) return null;

  // PIN Entry View
  if (gallery.is_locked && !gallery.unlocked) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center relative p-6">
        {/* Full-screen Background with Heavy Blur */}
        {gallery.cover_photo_url ? (
          <>
            <div className="absolute inset-0 z-0">
              <img 
                src={gallery.cover_photo_url} 
                alt="Cover" 
                className="w-full h-full object-cover opacity-60"
              />
            </div>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-3xl z-0"></div>
            {/* Soft gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/80 z-0"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-neutral-900 z-0"></div>
        )}

        {/* Lock Card */}
        <div className="relative z-10 bg-white p-10 sm:p-12 rounded-[2rem] shadow-2xl max-w-md w-full text-center transform transition-all duration-500 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 mx-auto bg-neutral-100/80 rounded-full flex items-center justify-center mb-6 shadow-inner border border-neutral-200/50">
            <Lock className="w-7 h-7 text-neutral-800" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-black tracking-tight">{gallery.name}</h1>
          <p className="text-neutral-500 mb-8 font-medium">This gallery is PIN protected.</p>
          
          <form onSubmit={handlePinSubmit} className="space-y-5">
            <input
              type="text"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-black text-center tracking-[0.5em] text-2xl font-semibold px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all placeholder:text-neutral-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
              required
            />
            {pinError && (
              <p className="text-red-500 text-sm font-medium animate-in slide-in-from-top-2">{pinError}</p>
            )}
            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-black hover:bg-neutral-800 text-white font-medium text-lg px-4 py-4 rounded-2xl transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-2 shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5"
            >
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Gallery"}
              {!verifying && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Full Gallery View
  return (
    <div className="min-h-screen bg-white pb-24">
      
      {/* Hero Section */}
      <div className="relative w-full min-h-screen bg-neutral-900 flex flex-col items-center justify-center overflow-hidden">
        {gallery.cover_photo_url ? (
          <>
            <img src={gallery.cover_photo_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-neutral-900"></div>
        )}
        
        <div className="relative z-10 text-center text-white px-6 w-full flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold uppercase tracking-[0.15em] mb-4 drop-shadow-lg">
            {gallery.name}
          </h1>
          
          {(gallery.event_date || gallery.cover_title) && (
            <p className="uppercase tracking-[0.2em] text-xs md:text-sm font-medium mb-10 opacity-90 drop-shadow-md">
              {gallery.event_date || gallery.cover_title}
            </p>
          )}
          
          <button 
            onClick={scrollToGallery}
            className="border border-white hover:bg-white hover:text-black transition-colors duration-300 px-8 py-3 uppercase tracking-[0.2em] text-xs font-semibold"
          >
            View Gallery
          </button>
        </div>

        {/* Bottom Branding on Hero */}
        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center text-white opacity-80">
          <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-md flex items-center justify-center mb-3">
             <span className="font-serif italic text-lg">Bp</span>
          </div>
          <span className="uppercase text-[10px] tracking-[0.3em] font-medium">Big Pixel Photography</span>
        </div>
      </div>

      {/* Sticky White Bar */}
      <div ref={galleryRef} className="sticky top-0 z-40 bg-white px-6 md:px-10 py-5 flex flex-col sm:flex-row items-center justify-between border-b border-gray-200/60 shadow-sm">
        <div className="flex flex-col text-center sm:text-left">
          <span className="uppercase font-bold tracking-[0.15em] text-gray-900 text-lg md:text-xl">
            {gallery.name}
          </span>
          <span className="uppercase text-[9px] tracking-[0.2em] text-gray-400 mt-1">
            Big Pixel Photography
          </span>
        </div>
        
        <div className="flex items-center gap-6 text-gray-400 mt-4 sm:mt-0">
          {gallery.allow_bulk_download !== false && (
            <button 
              onClick={() => requireEmailCheck(downloadGalleryZip)}
              disabled={downloadingZip || gallery.photos.length === 0}
              title="Download All" 
              className="hover:text-black transition-colors duration-300 disabled:opacity-50"
            >
              {downloadingZip ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={() => {
              if (gallery.photos.length > 0) {
                setViewerIndex(0);
                setIsPlaying(true);
              }
            }} 
            title="Slideshow" 
            className="hover:text-black transition-colors duration-300"
          >
            <Play className="w-5 h-5" />
          </button>
        </div>
      </div>

            <style>{`
        .unique-grid {
          --grid-col-min: 130px;
          --grid-row-min: 130px;
        }
        @media (min-width: 640px) {
          .unique-grid {
            --grid-col-min: 180px;
            --grid-row-min: 180px;
          }
        }
        @media (min-width: 1024px) {
          .unique-grid {
            --grid-col-min: 240px;
            --grid-row-min: 240px;
          }
        }
      `}</style>
      
      {/* Photo Grid (Unique Dense Collage) */}
      <div className="w-full px-1 py-1">
        <div 
          className="grid gap-1.5 unique-grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(var(--grid-col-min, 120px), 1fr))",
            gridAutoRows: "var(--grid-row-min, 120px)",
            gridAutoFlow: "dense"
          }}
        >
          {gallery.photos.map((photo, index) => {
            const ratio = imageRatios[photo.id];
            let spanClass = "col-span-1 row-span-1";
            
            if (ratio) {
              if (ratio > 1.3) spanClass = "col-span-2 sm:col-span-2 row-span-1"; // Landscape
              else if (ratio < 0.8) spanClass = "col-span-1 row-span-2"; // Portrait
            }

            return (
            <div
              key={photo.id}
              className={`relative group cursor-pointer overflow-hidden bg-neutral-100 ${spanClass}`}
              onClick={() => setViewerIndex(index)}
            >
              <img
                src={photo.thumbnail_url || photo.preview_url || photo.url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover opacity-100 group-hover:opacity-90 transition-opacity duration-300"
                loading="lazy"
                onLoad={(e) => {
                  const target = e.target as HTMLImageElement;
                  setImageRatios(prev => ({
                    ...prev,
                    [photo.id]: target.naturalWidth / target.naturalHeight
                  }));
                }}
              />
              
              {gallery.allow_download !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  requireEmailCheck(() => downloadPhoto(photo, e));
                }}
                disabled={downloadingPhotoId === photo.id}
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-black p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg"
              >
                {downloadingPhotoId === photo.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox / Viewer */}
      {viewerIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Controls */}
          <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
            <button
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              className="text-white/70 hover:text-white transition-colors"
              title={isPlaying ? "Pause Slideshow" : "Play Slideshow"}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            {gallery.allow_download !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  requireEmailCheck(() => downloadPhoto(gallery.photos[viewerIndex], e));
                }}
                disabled={downloadingPhotoId === gallery.photos[viewerIndex].id}
                className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
                title="Download Photo"
              >
                {downloadingPhotoId === gallery.photos[viewerIndex].id ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Download className="w-6 h-6" />
                )}
              </button>
            )}
            <button
              onClick={closeLightbox}
              className="text-white/70 hover:text-white transition-colors ml-2"
              title="Close"
            >
              <X className="w-8 h-8" />
            </button>
          </div>

          <button
            onClick={prevPhoto}
            className="absolute left-6 text-white/50 hover:text-white p-2 transition-colors z-50"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button
            onClick={nextPhoto}
            className="absolute right-6 text-white/50 hover:text-white p-2 transition-colors z-50"
          >
            <ChevronRight className="w-10 h-10" />
          </button>

          {/* Current Photo */}
          <div className="w-full h-full flex items-center justify-center p-12" onClick={closeLightbox}>
            <img
              src={gallery.photos[viewerIndex].preview_url || gallery.photos[viewerIndex].url}
              alt="Viewer"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()} // Prevent close on image click
            />
          </div>
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm tracking-widest font-mono">
            {viewerIndex + 1} / {gallery.photos.length}
          </div>
        </div>
      )}

      {/* Email Collection Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowEmailModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-black transition-colors bg-neutral-50 hover:bg-neutral-100 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-neutral-100/80 rounded-full flex items-center justify-center mb-6 text-black mx-auto shadow-inner border border-neutral-200/50">
              <Mail className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-center mb-2 text-black tracking-tight">Download Photos</h3>
            <p className="text-sm font-medium text-center text-neutral-500 mb-8 leading-relaxed">
              Please enter your email address to download these high-resolution photos.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full text-center text-lg px-4 py-4 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10 rounded-2xl outline-none transition-all placeholder:text-neutral-400"
              />
              <button
                type="submit"
                className="w-full bg-black hover:bg-neutral-800 text-white font-medium text-lg py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5"
              >
                Continue Download
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
