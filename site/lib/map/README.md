# shared/map

The work map's classifier, drawing, rows and strings. These files are copied
from lot-map by Aleksei Volodin (https://github.com/alexeyw/lot-map at commit a616402, MIT, see
LICENSE here). Only the import path of the types was changed. `types.ts` is
lot-map's `types/index.d.ts` without its plugin-engine declaration.

lot-map's `register.tsx` (the Claude Code plugin glue) is not used. Helo builds
the same board from hook events in `src/main/workmap.ts`.

## This copy

`site/lib/map` is a copy of `app/src/shared/map`, for the landing page's work map section
(`site/app/sections/WorkMapSection.tsx`). Turbopack does not resolve files outside `site/`, so the site
cannot import the app's copy. When the app's files change, copy them here again.

One line differs: `hostOf` in `classify.ts` reads the rest of the address with `([\s\S]*)` and no `s` flag,
which means the same, because the site's TypeScript target (ES2017) does not allow the `s` flag.
