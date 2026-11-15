# shared/map

The work map's classifier, drawing, rows and strings. These files are copied
from lot-map by Aleksei Volodin (https://github.com/alexeyw/lot-map at commit a616402, MIT, see
LICENSE here). Only the import path of the types was changed. `types.ts` is
lot-map's `types/index.d.ts` without its plugin-engine declaration.

lot-map's `register.tsx` (the Claude Code plugin glue) is not used. Helo builds
the same board from hook events in `src/main/workmap.ts`.
