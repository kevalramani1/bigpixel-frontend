import fs from "fs";

let content = fs.readFileSync("src/pages/Home.tsx", "utf8");

// Fetch settings in Home.tsx
const hookContent = `  const [galleries, setGalleries] = useState<ProfileGallery[]>([]);
  const [settings, setSettings] = useState({ name: "Bigpixel Studio", tagline: "Capturing timeless moments with elegance.", logo_url: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [settingsRes, galleriesRes] = await Promise.all([
          fetch("http://localhost:8000/api/settings/"),
          fetch("http://localhost:8000/api/galleries/public/profile")
        ]);
        
        if (!galleriesRes.ok) throw new Error("Failed to load profile.");
        
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings({
            name: s.name || "Bigpixel Studio",
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
  }, []);`;

content = content.replace(/  const \[galleries, setGalleries\].*?\}, \[\]\);/s, hookContent);

const oldHeader = `        <div className="w-24 h-24 mx-auto bg-black rounded-full flex items-center justify-center mb-8 shadow-xl shadow-black/10">\n          <Camera className="w-12 h-12 text-white" />\n        </div>\n        <SplitText \n          text="Bigpixel Studio" \n          className="text-5xl sm:text-7xl font-bold tracking-tight text-black mb-6" \n        />\n        <p className="text-lg sm:text-xl text-neutral-600 font-light leading-relaxed max-w-2xl mx-auto">\n          Capturing timeless moments with elegance. \n          Browse our selected public collections below.\n        </p>`;

const newHeader = `        {settings.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="w-24 h-24 mx-auto rounded-full object-cover mb-8 shadow-xl shadow-black/10" />
        ) : (
          <div className="w-24 h-24 mx-auto bg-black rounded-full flex items-center justify-center mb-8 shadow-xl shadow-black/10">
            <Camera className="w-12 h-12 text-white" />
          </div>
        )}
        <SplitText 
          text={settings.name} 
          className="text-5xl sm:text-7xl font-bold tracking-tight text-black mb-6" 
        />
        <p className="text-lg sm:text-xl text-neutral-600 font-light leading-relaxed max-w-2xl mx-auto">
          {settings.tagline}
        </p>`;

content = content.replace(oldHeader, newHeader);

fs.writeFileSync("src/pages/Home.tsx", content);
