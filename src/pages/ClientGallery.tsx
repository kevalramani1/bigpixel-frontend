import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Lock, ArrowRight, Download, Play, Pause, ChevronLeft, ChevronRight, X, Image as ImageIcon, Loader2 } from "lucide-react";
import JSZip from "jszip";

// Define Types
type Photo = {
  id: number;
  url: string;
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
  photos: Photo[];
};

export default function ClientGallery() {
  const { id } = useParams<{ id: string }>();
  
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  
  // Lightbox State
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGallery = React.useCallback(async (pinAttempt?: string) => {
    try {
      setLoading(true);
      setError("");
      
      let url = `http://localhost:8000/api/galleries/${id}/public`;
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
      void fetchGallery();
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
      <div className="min-h-screen bg-white flex flex-col">
        {gallery.cover_photo_url && (
          <div className="h-[40vh] w-full relative">
            <img 
              src={gallery.cover_photo_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-16 relative z-10">
          <div className="bg-white p-10 rounded-2xl shadow-xl border border-neutral-100 max-w-sm w-full text-center">
            <div className="w-12 h-12 mx-auto bg-neutral-100 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-5 h-5 text-neutral-700" />
            </div>
            <h1 className="text-xl font-bold mb-2">{gallery.name}</h1>
            <p className="text-sm text-neutral-500 mb-8">This gallery is PIN protected.</p>
            
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full text-center tracking-widest px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                required
              />
              <button
                type="submit"
                disabled={verifying}
                className="w-full bg-black hover:bg-neutral-800 text-white font-medium px-4 py-3 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Access Gallery"}
                {!verifying && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Full Gallery View
  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Hero Section */}
      <div className="relative w-full h-[60vh] bg-neutral-100 flex items-center justify-center overflow-hidden">
        {gallery.cover_photo_url ? (
          <>
            <img src={gallery.cover_photo_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30"></div>
          </>
        ) : (
          <ImageIcon className="w-16 h-16 text-neutral-300" />
        )}
        <div className="relative z-10 text-center text-white p-6 max-w-3xl">
          {gallery.cover_title && (
            <p className="uppercase tracking-[0.2em] text-sm font-semibold mb-4 opacity-90">{gallery.cover_title}</p>
          )}
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">{gallery.name}</h1>
          {gallery.description && (
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto font-light leading-relaxed">
              {gallery.description}
            </p>
          )}
        </div>
      </div>

      {/* Gallery Actions */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-100">
        <p className="text-neutral-500 font-medium">
          {gallery.photos.length} {gallery.photos.length === 1 ? "Photo" : "Photos"}
        </p>
        <button
          onClick={downloadGalleryZip}
          disabled={downloadingZip || gallery.photos.length === 0}
          className="bg-black hover:bg-neutral-800 text-white font-medium px-6 py-2.5 rounded-full transition-colors disabled:opacity-70 flex items-center gap-2"
        >
          {downloadingZip ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing Download...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download All
            </>
          )}
        </button>
      </div>

      {/* Photo Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {gallery.photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative group cursor-pointer break-inside-avoid rounded-lg overflow-hidden bg-neutral-100"
              onClick={() => setViewerIndex(index)}
            >
              <img
                src={photo.url}
                alt={`Photo ${index + 1}`}
                className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-500"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
              
              <button
                onClick={(e) => downloadPhoto(photo, e)}
                disabled={downloadingPhotoId === photo.id}
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-black p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 shadow-lg"
              >
                {downloadingPhotoId === photo.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
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
            <button
              onClick={(e) => downloadPhoto(gallery.photos[viewerIndex], e)}
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
              src={gallery.photos[viewerIndex].url}
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
    </div>
  );
}
