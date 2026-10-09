import re

with open("src/pages/ClientGallery.tsx", "r") as f:
    content = f.read()

# Let's define the JS based masonry logic
# We will replace the <div className="w-full px-1 py-1"> block
old_grid = r"""      {/* Photo Grid \(No side margins\) */}
      <div className="w-full px-1 py-1">
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1">
          {gallery.photos.map\(\(photo, index\) => \(
            <div
              key={photo.id}
              className="relative group cursor-pointer break-inside-avoid inline-block w-full mb-1 overflow-hidden bg-neutral-100 align-top"
              onClick={\(\) => setViewerIndex\(index\)}
            >
              <img
                src={photo.thumbnail_url \|\| photo.preview_url \|\| photo.url}
                alt={`Photo \$\{index \+ 1\}`}
                className="w-full h-auto object-cover opacity-100 group-hover:opacity-90 transition-opacity duration-300"
                loading="lazy"
              />
              
              {gallery.allow_download !== false && \(
              <button
                onClick={\(e\) => {
                  e.stopPropagation\(\);
                  requireEmailCheck\(\(\) => downloadPhoto\(photo, e\)\);
                }}
                disabled={downloadingPhotoId === photo.id}
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-black p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg"
              >
                {downloadingPhotoId === photo.id \? \(
                  <Loader2 className="w-4 h-4 animate-spin" />
                \) : \(
                  <Download className="w-4 h-4" />
                \)}
              </button>
              \)}
            </div>
          \)\)}
        </div>
      </div>"""

# Note: We need a hook to track window size for the masonry columns
# But to keep it simpler and purely CSS, wait, can we use Flexbox with flex-col wrap?
# Yes, flex-col with a fixed height and wrap acts like masonry. But fixed height is bad.
# Let's inject a custom MasonryGrid component right before `export default function ClientGallery()`
# Wait, we can just do this inline in the render loop by mapping over [0,1,2,3,4] and using CSS hidden classes!
# This is a genius pure-CSS chunking trick:
# Render 5 column divs. 
# Col 1: block (always). Col 2: block. Col 3: hidden sm:block. Col 4: hidden md:block. Col 5: hidden lg:block.
# Inside each column, we map the photos and only render if (index % numCols === colIndex).
# Wait, how does the child know numCols if it's purely CSS? It doesn't! We need JS window resize listener.

import_code = "import React, { useEffect, useState, useRef } from \"react\";"
custom_hook = """
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
"""

if "function useWindowSize" not in content:
    content = content.replace("export default function ClientGallery() {", custom_hook + "\nexport default function ClientGallery() {")

new_grid = """      {/* JS Masonry Photo Grid */}
      <div className="w-full px-1 py-1">
        {(() => {
          const width = typeof window !== "undefined" ? window.innerWidth : 1200;
          let cols = 5;
          if (width < 640) cols = 2;
          else if (width < 768) cols = 3;
          else if (width < 1024) cols = 4;
          
          const columns = Array.from({ length: cols }, () => [] as typeof gallery.photos);
          gallery.photos.forEach((photo, i) => columns[i % cols].push(photo));

          return (
            <div className="flex gap-1">
              {columns.map((colPhotos, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-1 flex-1">
                  {colPhotos.map((photo) => {
                    const originalIndex = gallery.photos.findIndex(p => p.id === photo.id);
                    return (
                      <div
                        key={photo.id}
                        className="relative group cursor-pointer overflow-hidden bg-neutral-100"
                        onClick={() => setViewerIndex(originalIndex)}
                      >
                        <img
                          src={photo.thumbnail_url || photo.preview_url || photo.url}
                          alt={`Photo ${originalIndex + 1}`}
                          className="w-full h-auto object-cover opacity-100 group-hover:opacity-90 transition-opacity duration-300"
                          loading="lazy"
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
              ))}
            </div>
          );
        })()}
      </div>"""

content = re.sub(old_grid, new_grid, content, flags=re.DOTALL)

# Because we added a useWindowSize call, we need to call it inside the component to trigger re-renders on resize
if "const { width } = useWindowSize();" not in content:
    content = content.replace("  const { id } = useParams<{ id: string }>();", "  const { id } = useParams<{ id: string }>();\n  useWindowSize(); // Trigger re-render on resize for masonry")

with open("src/pages/ClientGallery.tsx", "w") as f:
    f.write(content)

