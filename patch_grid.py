import re

with open("src/pages/ClientGallery.tsx", "r") as f:
    content = f.read()

# We need to add state for image dimensions
if "const [imageRatios, setImageRatios] = useState<Record<number, number>>({});" not in content:
    content = content.replace("const [viewerIndex, setViewerIndex] = useState<number | null>(null);",
                              "const [viewerIndex, setViewerIndex] = useState<number | null>(null);\n  const [imageRatios, setImageRatios] = useState<Record<number, number>>({});")

# Replace the photo grid section
old_grid = """      {/* Photo Grid (No side margins) */}
      <div className="w-full px-1 py-1">
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1">
          {gallery.photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative group cursor-pointer break-inside-avoid inline-block w-full mb-1 overflow-hidden bg-neutral-100 align-top"
              onClick={() => setViewerIndex(index)}
            >
              <img
                src={photo.thumbnail_url || photo.preview_url || photo.url}
                alt={`Photo ${index + 1}`}
                className="w-full h-auto object-cover opacity-100 group-hover:opacity-90 transition-opacity duration-300"
                loading="lazy"
              />"""

new_grid = """      {/* Photo Grid (Unique Dense Collage) */}
      <div className="w-full px-1 py-1">
        <div 
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gridAutoRows: "220px",
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
              />"""

if old_grid in content:
    content = content.replace(old_grid, new_grid)
    # Ensure closing tags are correct since we added a block for map
    content = content.replace("""              </button>
              )}
            </div>
          ))}""", """              </button>
              )}
            </div>
            );
          })}""")
    with open("src/pages/ClientGallery.tsx", "w") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("FAILED TO MATCH")
