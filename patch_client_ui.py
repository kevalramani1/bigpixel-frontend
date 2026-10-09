import re

with open("src/pages/ClientGallery.tsx", "r") as f:
    content = f.read()

# First, add the ref and scroll function at the top of the component if missing
if "galleryRef" not in content:
    content = content.replace("const timerRef = useRef<NodeJS.Timeout | null>(null);", 
"""const timerRef = useRef<NodeJS.Timeout | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };""")

# Now replace the full gallery view rendering
old_render_start = """  // Full Gallery View
  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Top Business Branding Bar */}"""

old_render_end = """              {gallery.allow_download !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  requireEmailCheck(() => downloadPhoto(photo, e));
                }}
                disabled={downloadingPhotoId === photo.id}
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-black p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 shadow-lg"
              >
                {downloadingPhotoId === photo.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              )}
            </div>
          ))}
        </div>
      </div>
      </div>"""

# Extract the block to replace using regex
pattern = re.compile(re.escape(old_render_start) + r".*?" + re.escape(old_render_end), re.DOTALL)

new_render = """  // Full Gallery View
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

      {/* Photo Grid (No side margins) */}
      <div className="w-full px-1 py-1">
        <div className="columns-2 lg:columns-3 gap-1 space-y-1">
          {gallery.photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative group cursor-pointer break-inside-avoid overflow-hidden bg-neutral-100"
              onClick={() => setViewerIndex(index)}
            >
              <img
                src={photo.thumbnail_url || photo.preview_url || photo.url}
                alt={`Photo ${index + 1}`}
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
          ))}
        </div>
      </div>"""

if pattern.search(content):
    new_content = pattern.sub(new_render, content)
    with open("src/pages/ClientGallery.tsx", "w") as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("FAILED TO MATCH BLOCK")

