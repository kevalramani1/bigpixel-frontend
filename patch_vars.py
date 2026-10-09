import re

with open("src/pages/ClientGallery.tsx", "r") as f:
    content = f.read()

style_block = """      <style>{`
        .unique-grid {
          --grid-col-min: 130px;
          --grid-row-min: 130px;
        }
        @media (min-width: 640px) {
          .unique-grid {
            --grid-col-min: 180px;
            --grid-row-min: 180px;
          }
        }
        @media (min-width: 1024px) {
          .unique-grid {
            --grid-col-min: 240px;
            --grid-row-min: 240px;
          }
        }
      `}</style>
      
      {/* Photo Grid (Unique Dense Collage) */}"""

if "{/* Photo Grid (Unique Dense Collage) */}" in content:
    content = content.replace("{/* Photo Grid (Unique Dense Collage) */}", style_block)
    content = content.replace('className="grid gap-1.5"', 'className="grid gap-1.5 unique-grid"')
    with open("src/pages/ClientGallery.tsx", "w") as f:
        f.write(content)
    print("SUCCESS")
