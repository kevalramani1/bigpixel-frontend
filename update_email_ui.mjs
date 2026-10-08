import fs from "fs";

let content = fs.readFileSync("src/pages/ClientGallery.tsx", "utf8");

const oldEmailModal = `{showEmailModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowEmailModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mb-6 text-black mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-black">Download Photos</h3>
            <p className="text-sm text-center text-neutral-500 mb-6">
              Please enter your email address to download these photos.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 focus:border-black rounded-xl outline-none"
              />
              <button
                type="submit"
                className="w-full bg-black text-white font-medium py-3 rounded-xl hover:bg-neutral-800 transition-colors"
              >
                Continue Download
              </button>
            </form>
          </div>
        </div>
      )}`;

const newEmailModal = `{showEmailModal && (
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
      )}`;

content = content.replace(oldEmailModal, newEmailModal);
fs.writeFileSync("src/pages/ClientGallery.tsx", content);
