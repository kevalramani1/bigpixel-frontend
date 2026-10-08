import fs from "fs";
let content = fs.readFileSync("src/pages/ClientGallery.tsx", "utf8");
content = content.replace(
    '<img\n                src={photo.preview_url || photo.url}',
    '<img\n                src={photo.thumbnail_url || photo.preview_url || photo.url}'
);
fs.writeFileSync("src/pages/ClientGallery.tsx", content);
