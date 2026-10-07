import fs from "fs";

let content = fs.readFileSync("src/pages/Home.tsx", "utf8");

const typesAndState = `type ProfileGallery = {
  id: number;
  name: string;
  cover_title?: string;
  cover_photo_url?: string;
  is_locked: boolean;
};

type StudioSettings = {
  name: string;
  tagline: string;
  logo_url: string | null;
};

export default function Home() {
  const [galleries, setGalleries] = useState<ProfileGallery[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);`;

content = content.replace(
  /type ProfileGallery = {[\s\S]*?export default function Home\(\) {\n  const \[galleries, setGalleries\] = useState<ProfileGallery\[\]>\(\[\]\);/,
  typesAndState
);

const fetchLogic = `  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profRes, setRes] = await Promise.all([
          fetch("http://localhost:8000/api/galleries/public/profile"),
          fetch("http://localhost:8000/api/settings/public")
        ]);
        if (!profRes.ok || !setRes.ok) throw new Error("Failed to load profile.");
        
        const [profData, setData] = await Promise.all([
          profRes.json(),
          setRes.json()
        ]);
        setGalleries(profData);
        setSettings(setData);
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
    
    void fetchData();
  }, []);`;

content = content.replace(
  /  useEffect\(\(\) => {[\s\S]*?\}, \[\]\);/,
  fetchLogic
);

const headerUI = `      {/* Header Profile Section */}
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
      </header>`;

content = content.replace(
  /      \{\/\* Header Profile Section \*\/\}[\s\S]*?<\/header>/,
  headerUI
);

fs.writeFileSync("src/pages/Home.tsx", content);
