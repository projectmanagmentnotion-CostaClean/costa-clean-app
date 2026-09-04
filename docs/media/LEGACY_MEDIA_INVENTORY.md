# Costa Clean Legacy Media Inventory

**Source:** read-only crawl of `https://costacleanbcn.com/`, its linked public
pages, and the public WordPress REST media collection.

**Audit date:** 2026-09-04 (Europe/Madrid)  
**Result:** `PASS` for discovery. Ownership is not legally certified by a
public crawl; every row therefore records confidence separately. No asset was
downloaded, edited, replaced or deleted.

## Decision rules

- `KEEP`: retain as a source candidate pending Stitch crop and brand review.
- `REPROCESS`: retain the original, then create optimized AVIF/WebP/fallback
  derivatives and accessible metadata.
- `REPLACE`: do not carry into the new experience unless a later review finds a
  justified use; this is not a deletion instruction.
- `ASSET_REQUIRED`: Stitch reference is needed before selecting or creating a
  replacement.

## Inventory

| Asset | Source URL/path | Type | Dimensions | File size | Current page/use | Subject | Brand value | Quality | Decision | Target section | Ownership confidence |
|---|---|---:|---:|---:|---|---|---|---|---|---|---|
| `5704697_Coll_wavebreak_People_1920x1080.mp4` | `/wp-content/uploads/2024/12/` | MP4 | 1920x1080 | 24.51 MB | Tourist-apartment page | Cleaning people | Low, stock filename | Technical good; alt absent | REPLACE | Only if Stitch explicitly requires video | Low |
| `6575232_Industry_Construction-Industry_1280x720.mp4` | `/wp-content/uploads/2024/09/` | MP4 | 1280x720 | 8.71 MB | Media library | Construction cleaning | Low, stock filename | Good; page use unconfirmed | REPLACE | Service media only with approval | Low |
| `4833996_Hands_Woman_1280x720.mp4` | `/wp-content/uploads/2024/09/` | MP4 | 1280x720 | 3.75 MB | Media library | Cleaning detail | Low, stock filename | Good; page use unconfirmed | REPLACE | Service media only with approval | Low |
| `6249960_Cleaning_Bucket_1280x720.mp4` | `/wp-content/uploads/2024/09/` | MP4 | 1280x720 | 3.11 MB | Media library | Cleaning supplies | Low, stock filename | Good; page use unconfirmed | REPLACE | Service media only with approval | Low |
| `1102986_1080p_Man_1280x720.mp4` | `/wp-content/uploads/2024/09/` | MP4 | 1280x720 | 6.37 MB | Media library | Cleaner | Low, stock filename | Good; page use unconfirmed | REPLACE | Service media only with approval | Low |
| Google reviews vertical | `/wp-content/uploads/2024/09/...vertical-movil-scaled.webp` | WebP | 1558x2560 | 176.6 KB | Home/reviews candidates | Review capture | Medium, Costa Clean branded | Good; alt present | KEEP | Reviews/mobile proof | Medium |
| Google reviews landscape | `/wp-content/uploads/2024/09/resenas-de-google-...scaled.webp` | WebP | 2560x1440 | 113.5 KB | Home/reviews candidates | Review capture | Medium, Costa Clean branded | Good; alt present | KEEP | Reviews/desktop proof | Medium |
| Google reviews vertical | `/wp-content/uploads/2024/09/...Costa-Clean...scaled.webp` | WebP | 1545x2560 | 279.5 KB | Home/reviews candidates | Review capture | Medium, Costa Clean branded | Good; alt present | KEEP | Reviews/mobile proof | Medium |
| `cropped-costa-clean-favicon.png` | `/wp-content/uploads/2024/09/` | PNG | 512x512 | 78.2 KB | Site icon | Favicon | High | Oversized for favicon | REPROCESS | Favicon/app icon | High |
| `costa-clean-favicon.png` | `/wp-content/uploads/2024/09/` | PNG | 2522x2560 | 619.1 KB | Media library | Favicon | High | Oversized duplicate | REPROCESS | Favicon/app icon | High |
| `cropped-costa-clean-logo.png` | `/wp-content/uploads/2024/09/` | PNG | 2555x2317 | 705.2 KB | Header/footer candidate | Logo | High | Large raster; transparent status unverified | REPROCESS | Brand/header | High |
| `costa-clean-logo.png` | `/wp-content/uploads/2024/09/` | PNG | 2558x2317 | 750.4 KB | Media library | Logo | High | Large raster duplicate | REPROCESS | Brand/header | High |
| `cropped-cropped-Costa-Clean-logo-scaled-1.webp` | `/wp-content/uploads/2024/09/` | WebP | 2555x2317 | 189.3 KB | Header/footer candidate | Logo | High | Efficient but duplicate | KEEP | Brand/header | High |
| `cropped-Costa-Clean-logo-scaled-1.webp` | `/wp-content/uploads/2024/09/` | WebP | 2558x2317 | 190.2 KB | Header/footer | Logo | High | Efficient; crop to Stitch | KEEP | Brand/header | High |
| `Costa-Clean-Servicios-...scaled.webp` | `/wp-content/uploads/2024/08/` | WebP | 2560x2560 | 73.3 KB | Commercial/contact hero | Branded service image | High | Good compression; square | KEEP | Hero/service proof | High |
| `boton-de-whatsapp.webp` | `/wp-content/uploads/2024/08/` | WebP | 1001x168 | 9.1 KB | Global CTA | WhatsApp button graphic | High | Good; likely replace with accessible control | REPROCESS | CTA/icon | High |
| `mail-icono-costa-clean.webp` | `/wp-content/uploads/2024/08/` | WebP | 1523x1524 | 69.7 KB | Contact | Mail icon | Medium | Oversized icon | REPROCESS | Contact details | High |
| `lugar-icono-costa-clean.webp` | `/wp-content/uploads/2024/08/` | WebP | 1087x1524 | 57.5 KB | Contact | Location icon | Medium | Oversized icon | REPROCESS | Contact details | High |
| `costa-clean-limpieza-profunda-vertical.webp` | `/wp-content/uploads/2024/08/` | WebP | 1081x1351 | 37.3 KB | Home/service | Deep cleaning | High | Good; verify subject/crop | KEEP | Service landing | High |
| `costa-clean-limpieza-profunda.webp` | `/wp-content/uploads/2024/08/` | WebP | 1921x1081 | 38.8 KB | Media library | Deep cleaning | High | Good; verify subject/crop | KEEP | Service landing | High |
| `Productos-de-limpieza-icono.webp` | `/wp-content/uploads/2024/08/` | WebP | 1429x1524 | 60.0 KB | Benefits/service | Cleaning products icon | Medium | Oversized icon | REPROCESS | Benefits | High |
| `Pago-facil-icono.webp` | `/wp-content/uploads/2024/08/` | WebP | 1524x1524 | 66.6 KB | Benefits/service | Easy payment icon | Medium | Oversized icon | REPROCESS | Benefits | High |
| `Calidad-logo.webp` | `/wp-content/uploads/2024/08/` | WebP | 1524x1382 | 48.5 KB | Benefits/service | Quality badge | Medium | Good; claim needs verification | VERIFY | Trust section | High |
| `limpieza-profesional-en-la-costa-brava-costa-clean.webp` | `/wp-content/uploads/2024/08/` | WebP | 1081x1351 | 37.9 KB | Home/service | Professional cleaning | High | Good; verify subject/crop | KEEP | Hero/service | High |
| `Costa-Clean-favion-scaled-1.webp` | `/wp-content/uploads/2024/08/` | WebP | 512x512 | 21.6 KB | Site icon | Favicon | High | Good derivative | KEEP | Favicon/app icon | High |
| `Costa-Clean-favion-scaled.webp` | `/wp-content/uploads/2024/08/` | WebP | 2522x2560 | 148.3 KB | Media library | Favicon | High | Oversized source derivative | REPROCESS | Favicon/app icon | High |
| `cropped-Costa-Clean-logo-scaled-1.webp` | `/wp-content/uploads/2024/08/` | WebP | 2558x2317 | 190.2 KB | Header/footer | Logo | High | Good duplicate | KEEP | Brand/header | High |
| `Costa-Clean-logo-scaled.webp` | `/wp-content/uploads/2024/08/` | WebP | 2560x2317 | 192.9 KB | Media library | Logo | High | Good duplicate | KEEP | Brand/header | High |
| `limpieza-profesional-costa-clean.webp` | `/wp-content/uploads/2024/08/` | WebP | 1921x1081 | 119.6 KB | Media library | Professional cleaning | High | Good; page use unconfirmed | KEEP | Service landing | High |
| `limpieza-de-cristales-profesional-costa-clean.webp` | `/wp-content/uploads/2024/08/` | WebP | 1921x1081 | 53.1 KB | Media library | Window cleaning | High | Good; page use unconfirmed | KEEP | Service landing | High |
| `Limpieza-residencial.webp` | `/wp-content/uploads/2024/08/` | WebP | 1599x1522 | 66.7 KB | Home/residential | Residential cleaning | High | Good; crop review needed | KEEP | Residential landing | High |
| `Limpieza-personalizada.webp` | `/wp-content/uploads/2024/08/` | WebP | 1401x1524 | 52.8 KB | Home/custom | Custom cleaning | High | Good; crop review needed | KEEP | Custom landing | High |
| `Limpieza-Comercial.webp` | `/wp-content/uploads/2024/08/` | WebP | 1447x1524 | 74.6 KB | Home/commercial | Commercial cleaning | High | Good; crop review needed | KEEP | Commercial landing | High |
| `logo-5.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 3.2 KB | Legacy media | Logo/mark | Unknown | Vector; inspect before reuse | ASSET_REQUIRED | Stitch-approved icon only | Low |
| `logo-4.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 6.2 KB | Legacy media | Logo/mark | Unknown | Vector; inspect before reuse | ASSET_REQUIRED | Stitch-approved icon only | Low |
| `logo-3.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 6.6 KB | Legacy media | Logo/mark | Unknown | Vector; inspect before reuse | ASSET_REQUIRED | Stitch-approved icon only | Low |
| `logo-2.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 8.3 KB | Legacy media | Logo/mark | Unknown | Vector; inspect before reuse | ASSET_REQUIRED | Stitch-approved icon only | Low |
| `logo-1.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 10.7 KB | Legacy media | Logo/mark | Unknown | Vector; inspect before reuse | ASSET_REQUIRED | Stitch-approved icon only | Low |
| `online-booking.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 3.1 KB | Legacy service template | Booking icon | Low | Legacy; context unclear | REPLACE | Only if Stitch requires equivalent | Low |
| `certificate-guarantee.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 1.3 KB | Legacy service template | Guarantee icon | Medium | Claim requires verification | VERIFY | Trust section | Low |
| `easy-payment.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 1.4 KB | Legacy service template | Payment icon | Low | Legacy; context unclear | REPLACE | Only if Stitch requires equivalent | Low |
| `bathroom.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 2.7 KB | Legacy service template | Bathroom icon | Low | Legacy template | REPLACE | Service taxonomy only | Low |
| `kitchen.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 1.1 KB | Legacy service template | Kitchen icon | Low | Legacy template | REPLACE | Service taxonomy only | Low |
| `sofa.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 1.9 KB | Legacy service template | Sofa icon | Low | Legacy template | REPLACE | Service taxonomy only | Low |
| `fireplace.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 2.7 KB | Legacy service template | Fireplace icon | Low | Legacy template | REPLACE | Service taxonomy only | Low |
| `customize-clean.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 2.7 KB | Legacy service template | Custom cleaning icon | Medium | Legacy; verify style | REPROCESS | Custom service | Low |
| `phoenix.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 6.8 KB | Legacy location/template | Location graphic | None | Unrelated/unclear | REPLACE | None | Low |
| `san-jose.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 4.3 KB | Legacy location/template | Location graphic | None | Unrelated/unclear | REPLACE | None | Low |
| `denver.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 6.9 KB | Legacy location/template | Location graphic | None | Unrelated/unclear | REPLACE | None | Low |
| `la.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 8.1 KB | Legacy location/template | Location graphic | None | Unrelated/unclear | REPLACE | None | Low |
| `commercial-clean.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 1.7 KB | Legacy service template | Commercial cleaning icon | Medium | Legacy; verify style | REPROCESS | Commercial service | Low |
| `mopping.svg` | `/wp-content/uploads/2021/03/` | SVG | n/a | 2.9 KB | Legacy service template | Mopping icon | Medium | Legacy; verify style | REPROCESS | Service landing | Low |
| `cleaning-agent.png` | `/wp-content/uploads/2021/03/` | PNG | 1920x800 | 1.998 MB | Legacy home | Cleaning worker | Low, old template | Heavy and old | REPLACE | ASSET_REQUIRED if Stitch needs scene | Low |
| `clean-office.png` | `/wp-content/uploads/2021/03/` | PNG | 400x311 | 178.3 KB | Commercial page | Clean office | Low, old template | Small/dated | REPLACE | Commercial service | Low |
| `home-essentials.png` | `/wp-content/uploads/2021/03/` | PNG | 1920x850 | 1.891 MB | Legacy home | Home cleaning | Low, old template | Heavy and old | REPLACE | ASSET_REQUIRED if Stitch needs scene | Low |
| `testimonial-1.png` | `/wp-content/uploads/2021/03/` | PNG | 250x250 | 99.1 KB | Legacy testimonials | Testimonial portrait | Low/unknown | Small; consent/ownership unverified | VERIFY | Testimonials only after proof | Low |
| `testimonial-2.png` | `/wp-content/uploads/2021/03/` | PNG | 250x250 | 70.5 KB | Legacy testimonials | Testimonial portrait | Low/unknown | Small; consent/ownership unverified | VERIFY | Testimonials only after proof | Low |
| `testimonial-3.png` | `/wp-content/uploads/2021/03/` | PNG | 250x250 | 93.8 KB | Legacy testimonials | Testimonial portrait | Low/unknown | Small; consent/ownership unverified | VERIFY | Testimonials only after proof | Low |
| `testimonial-4.png` | `/wp-content/uploads/2021/03/` | PNG | 250x250 | 142.7 KB | Legacy testimonials | Testimonial portrait | Low/unknown | Small; consent/ownership unverified | VERIFY | Testimonials only after proof | Low |
| `chairs.jpg` | `/wp-content/uploads/2021/03/` | JPEG | 400x311 | 38.7 KB | Legacy gallery | Interior | Low, old template | Small/dated | REPLACE | Service gallery only if Stitch requires | Low |
| `white-sofa.jpg` | `/wp-content/uploads/2021/03/` | JPEG | 400x311 | 22.5 KB | Legacy gallery | Interior | Low, old template | Small/dated | REPLACE | Service gallery only if Stitch requires | Low |
| `demo-screenshot.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 1200x630 | 93.9 KB | Legacy template | Demo UI screenshot | None | Wrong product/context likely | REPLACE | None | Low |
| `gallery-1.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 29.0 KB | Legacy gallery | Cleaning/interior | Low, old template | Small/dated | REPLACE | Service gallery only if Stitch requires | Low |
| `gallery-2.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 41.3 KB | Legacy gallery | Cleaning/interior | Low, old template | Small/dated | REPLACE | Service gallery only if Stitch requires | Low |
| `gallery-3.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 38.4 KB | Legacy gallery | Cleaning/interior | Low, old template | Small/dated | REPLACE | Service gallery only if Stitch requires | Low |
| `gallery-4.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 47.2 KB | Legacy gallery | Cleaning/interior | Low, old template | Small/dated | REPLACE | Service gallery only if Stitch requires | Low |
| `cleaning-team.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 1000x600 | 241.4 KB | Legacy about/team | Team | Potentially high if real | Ownership and identity unverified | VERIFY | About/team | Low |
| `commercial-clean1.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 24.6 KB | Commercial page | Commercial cleaning | Low, old template | Small/dated | REPLACE | Commercial landing | Low |
| `commercial-clean2.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 52.2 KB | Commercial page | Commercial cleaning | Low, old template | Small/dated | REPLACE | Commercial landing | Low |
| `commercial-clean3.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 44.9 KB | Commercial page | Commercial cleaning | Low, old template | Small/dated | REPLACE | Commercial landing | Low |
| `commercial-clean5.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 29.4 KB | Commercial page | Commercial cleaning | Low, old template | Small/dated | REPLACE | Commercial landing | Low |
| `commercial-clean6.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 400x311 | 40.0 KB | Commercial page | Commercial cleaning | Low, old template | Small/dated | REPLACE | Commercial landing | Low |
| `cleaning-logo.png` | `/wp-content/uploads/2019/12/` | PNG | 147x71 | 7.0 KB | Legacy template | Logo | Unknown | Low resolution | REPLACE | None | Low |
| `cleaning-logo@2x.png` | `/wp-content/uploads/2019/12/` | PNG | 294x142 | 5.0 KB | Legacy template | Logo | Unknown | Low resolution | REPLACE | None | Low |
| `cleaning-founder.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 480x520 | 31.0 KB | Legacy about | Founder | Potentially high if real | Identity/consent unverified | VERIFY | About/founder | Low |
| `homepage-hero.jpg` | `/wp-content/uploads/2020/05/` | JPEG | 1920x1080 | 145.6 KB | Legacy home hero | Cleaning scene | Low, old template | Good technical; dated/ownership unclear | REPROCESS | Home hero only if Stitch crop fits | Low |
| `Costa-Clean-logo.png` | `/wp-content/uploads/2024/08/` | PNG | 2287x1684 | 236.4 KB | Media library | Logo/favicon | High | Good source candidate; alt misleading | REPROCESS | Brand/header | High |

## Content and page observations

The current public crawl exposed Home, Conócenos, Limpieza Residencial,
Limpieza Comercial, a tourist-apartment page, and Contacto. Preserve as
candidate content: company name, phone `+34 698 911 517`, Costa Brava coverage,
residential/commercial/custom cleaning, tourist apartments, post-construction,
WhatsApp CTA and service locations. Rewrite or verify promotional claims,
reviews, opening hours, legal text, and any “10%” offer before migration.

No page should copy legacy content automatically. Classify each block as
`KEEP`, `REWRITE`, `MERGE`, `DELETE` or `VERIFY` during the Stitch handoff.

## Pipeline and unresolved items

1. Keep the WordPress originals as immutable source references.
2. For each `KEEP`/`REPROCESS` asset, generate a derivative manifest with AVIF,
   WebP and original fallback where supported.
3. Apply Stitch aspect ratio and crop only to derivatives.
4. Add alt text and source/ownership evidence before publication.
5. Mark any Stitch-specific visual without an equivalent as `ASSET_REQUIRED`.

The REST inventory is public evidence, not proof of copyright ownership or
consent. The team must verify those items before production migration.
