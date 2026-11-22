# Vendored libraries

| File | Library | Version | Licence | Source |
| --- | --- | --- | --- | --- |
| `supabase.js` | @supabase/supabase-js (browser UMD build) | 2.119.2 | MIT | `node_modules/@supabase/supabase-js/dist/umd/supabase.js` from npm |

Why it is copied here instead of loaded from a CDN:

- the exact version is fixed and reviewed in our repository;
- the app does not depend on a third-party CDN being up or allowed by the network;
- the file can be audited and later checked with a hash.

To update: `npm pack @supabase/supabase-js@<version>`, copy `dist/umd/supabase.js` here,
update the version in the first comment line and in this table, then run the tests.
