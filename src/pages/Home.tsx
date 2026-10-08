import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Lock, Loader2, ArrowRight } from "lucide-react";

import { AnimatedBackground } from "../components/AnimatedBackground";
import { SplitText } from "../components/SplitText";

type ProfileGallery = {
  id: number;
  name: string;
  cover_title?: string;
  cover_photo_url?: string;
  is_locked: boolean;
};


export default function Home() {
  const [galleries, setGalleries] = useState<ProfileGallery[]>([]);
  const [settings, setSettings] = useState({ name: "Bigpixel Photography", tagline: "Capturing timeless moments with elegance.", logo_url: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [settingsRes, galleriesRes] = await Promise.all([
          fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000/api') + "/settings/"),
          fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000/api') + "/galleries/public/profile")
        ]);
        
        if (!galleriesRes.ok) throw new Error("Failed to load profile.");
        
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings({
            name: s.name || "Bigpixel Photography",
            tagline: s.tagline || "Capturing timeless moments with elegance.",
            logo_url: s.logo_url || ""
          });
        }
        
        const data = await galleriesRes.json();
        setGalleries(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };
    
    void fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-center p-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Unavailable</h1>
          <p className="text-neutral-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative">
      <AnimatedBackground />
      {/* Header Profile Section */}
      <header className="pt-32 pb-24 px-6 text-center max-w-3xl mx-auto relative z-10">
        <div className="w-24 h-24 mx-auto bg-black rounded-full flex items-center justify-center mb-8 shadow-xl shadow-black/10 overflow-hidden">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-12 h-12 text-white" />
          )}
        </div>
        {settings?.name && (
          <SplitText 
            text={settings.name} 
            className="text-5xl sm:text-7xl font-bold tracking-tight text-black mb-6" 
          />
        )}
        <p className="text-lg sm:text-xl text-neutral-600 font-light leading-relaxed max-w-2xl mx-auto">
          {settings?.tagline}
        </p>
      </header>

      {/* Galleries Grid */}
      <main className="max-w-7xl mx-auto px-6 pb-24">
        {galleries.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 rounded-3xl border border-neutral-100">
            <h3 className="text-lg font-medium text-neutral-600">No public galleries yet.</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {galleries.map((gallery) => (
              <Link 
                to={`/gallery/${gallery.id}`} 
                key={gallery.id}
                className="group block"
              >
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 mb-4">
                  {gallery.cover_photo_url ? (
                    <img 
                      src={gallery.cover_photo_url} 
                      alt={gallery.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-300" />
                  
                  {gallery.is_locked && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold shadow-sm">
                      <Lock className="w-3.5 h-3.5" />
                      PIN Required
                    </div>
                  )}
                </div>
                
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {gallery.cover_title && (
                      <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
                        {gallery.cover_title}
                      </p>
                    )}
                    <h2 className="text-xl font-semibold text-black group-hover:text-neutral-600 transition-colors">
                      {gallery.name}
                    </h2>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center group-hover:bg-black group-hover:border-black group-hover:text-white transition-all text-neutral-400 shrink-0 mt-1">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
