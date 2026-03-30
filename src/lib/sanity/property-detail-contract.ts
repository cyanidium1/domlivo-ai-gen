/**

 * Aligns frontend expectations with `sanity-real-estate-query-contract.md` §5–§6.

 * `PROPERTY_FULL_FRAGMENT` / `PROPERTY_BY_SLUG_QUERY` may omit `propertyOffers` and some scalars;

 * extend the fragment or use a dedicated extended query when the UI needs embedded offers.

 *

 * Recommended extension fields for detail parity with Studio:

 * - `propertyOffers[] { title, iconKey, customIcon }`

 * - `isPublished`, `lifecycleStatus`, `address`, analytics counters (as needed)

 */

export const PROPERTY_DETAIL_EXTENDED_FIELDS_NOTE =

  "See sanity-real-estate-query-contract.md §6.1 — compose PROPERTY_FULL_FRAGMENT with propertyOffers + intake fields.";


