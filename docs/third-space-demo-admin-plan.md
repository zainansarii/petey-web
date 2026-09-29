# Third Space demo admin

Route: https://joinpetey.com/third-space-demo-admin/

This is the agreed, focused MVP. It replaces the earlier five-view analytics proposal. The implementation is a standalone demonstration using fictional figures and trainer identities, with the existing Third Space club names. It does not connect to member conversations, enquiries, accounts, bookings or financial systems.

## Product scope

One dashboard, four headline metrics, three main areas and two global filters:

- Completed searches, enquiries generated, enquiry conversion and unmatched searches, each compared with the previous equivalent period.
- Member demand: five primary goals, volumes, share and share change. Click a goal to see club demand and conversion over time.
- Performance: a Clubs / Trainers table switch, descending volume/enquiry/conversion sorting, six-row pagination and detail panels.
- Opportunities: underserved goal/club combinations and three calculated findings with evidence and a relevant drill-down.
- Club and 7/28/90-day filters update the entire dashboard, including comparisons and opportunities.

The club table shows searches, enquiries, conversion and unmatched searches. The trainer table shows recommendation exposure, enquiries, recommendation-to-enquiry conversion and most common goal. Detail panels contain the scoped figures, conversion history and either member-demand or coverage breakdowns. Club drill-through applies the club filter to the main dashboard.

Revenue, booking outcomes, retention, response-time monitoring, capacity planning, exports, demographic analysis and AI chat are outside this MVP.

## Visual direction

An off-white workspace with a black Third Space header, DM Sans data typography, Cormorant Garamond headings and fine dividers. The compact trainer dashboard is the layout reference. Four restrained summary tiles lead into the demand chart, performance table and secondary insights column.

Motion is limited to the initial metric entrance, changing demand bars and sliding detail panels; reduced-motion preferences disable these effects. Native dialog semantics provide keyboard focus containment, Escape dismissal and return focus. On smaller screens, the performance table scrolls internally with its first column retained, and all data remains reachable.

## Sample data and definitions

The source is src/third-space-demo-admin/data.ts. A seeded generator creates 180 days of completed journeys ending 25 September 2026, covering 16 clubs and 32 fictional trainers. The date range is intentionally fixed for a repeatable demonstration. Each record has one primary goal, zero to two recommended trainers, and at most one submitted enquiry addressed to a recommended trainer.

- Search: one completed matching journey, not necessarily a unique person.
- Enquiry: a simulated submitted enquiry; not a profile click.
- Headline/club conversion: searches resulting in an enquiry divided by completed searches, including unmatched searches.
- Trainer conversion: enquiries to the trainer divided by journeys where that trainer was recommended. Recommendation totals are not additive to search totals because one search can show two trainers.
- Unmatched: a completed journey with no recommended trainer.
- Demand share: searches with the primary goal divided by all completed searches. These five mutually exclusive primary-goal shares total 100% before rounding.
- Demand change: difference in share from the previous equivalent period, in percentage points.
- Coverage gaps: goal/club groups with at least 20 searches and at least one unmatched result, ordered by unmatched share. Small groups do not become headline gaps.

All filters, totals, trends, tables and insight text derive from these records. Club search/enquiry totals and trainer enquiry totals reconcile to the overview. Each current period has a complete, disjoint prior comparison period.

The generator includes plausible variation such as rising strength demand, a City strength-coverage gap and an Islington confidence-coverage gap. These are illustrative scenarios, not statements about Third Space's real workforce or performance. The interface labels its sample status in the header and footer; trainer detail panels also identify sample trainers.

## Local preview and builds

From the petey-web repository:

    npm run dev

Open http://localhost:5173/third-space-demo-admin/ (or the port printed by Vite). The ordinary multi-page build includes this route in dist/third-space-demo-admin/.

The isolated entrypoint can also be run and built independently:

    npm run dev:third-space-admin
    npm run build:third-space-admin
    npm run preview:third-space-admin

The isolated build writes dist-third-space-admin/ and uses asset URLs under /third-space-demo-admin/. It has no environment-variable requirement, backend dependency or remote runtime font dependency. The matching-experience link opens the existing hosted matching demo in a new tab.

## Validation

    npm run verify
    npm run build:third-space-admin
    git diff --check

The new tests cover record attribution, current/prior period isolation, club/trainer/trend reconciliation, filter propagation, sort/pagination state, evidence drill-downs and modal focus restoration. The existing animation-heavy tests may need the established VITEST_MAX_WORKERS=1 environment setting for serial execution.

Browser acceptance covers 320–1440px widths including narrow tablet sizes, page and dialog overflow, table scrolling, filter changes, pagination/sorting, all detail types, club drill-through, Escape/focus restoration, reduced motion, loaded assets and browser errors.

## Publication

Implementation lives on the existing third-space-demo branch alongside the matching demonstration. Nothing in these changes publishes the page automatically.

For the pinned-demo publication workflow on main, build this source revision's isolated admin entrypoint and copy dist-third-space-admin/ into the combined Pages artifact at dist/third-space-demo-admin/, alongside the existing dist/third-space-demo/ matching entrypoint. Update the pinned source revision only after verification. The build on this branch also includes the route through the normal multi-page Vite configuration.

The production route should serve the directory index, including direct navigation and the normal trailing-slash redirect. Its HTML contains noindex, nofollow. Sample data may be public; replacing it with real client or operational data would require an authenticated, authorised implementation.
