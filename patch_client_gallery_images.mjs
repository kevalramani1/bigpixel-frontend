import fs from "fs";

let content = fs.readFileSync("src/pages/ClientGallery.tsx", "utf8");

// 1. Update Photo Type
content = content.replace(
  'type Photo = {\n  id: number;\n  url: string;\n  order_index: number;\n};',
  'type Photo = {\n  id: number;\n  url: string;\n  preview_url?: string;\n  thumbnail_url?: string;\n  order_index: number;\n};'
);

// 2. Update Image tags
// Grid Image (uses thumbnail)
content = content.replace(
  '<img\n                src={photo.url}',
  '<img\n                src={photo.preview_url || photo.url}'
);

// Lightbox Image (uses preview)
content = content.replace(
  '<img\n              src={gallery.photos[viewerIndex].url}',
  '<img\n              src={gallery.photos[viewerIndex].preview_url || gallery.photos[viewerIndex].url}'
);

fs.writeFileSync("src/pages/ClientGallery.tsx", content);
