import fs from "fs";

let content = fs.readFileSync("src/pages/ClientGallery.tsx", "utf8");

const oldLockView = `  // PIN Entry View
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
  }`;

const newLockView = `  // PIN Entry View
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
              className="w-full text-center tracking-[0.5em] text-2xl font-semibold px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all placeholder:text-neutral-400 placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
              required
            />
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
  }`;

content = content.replace(oldLockView, newLockView);
fs.writeFileSync("src/pages/ClientGallery.tsx", content);
