# REV Recharts dashboard QA

November 12, 2026 · Local development

The public and admin charts passed rendering, tooltip, keyboard, and data checks. Print preview exposed two issues. The Business selector still prints, and the 30-day Daily sales card spans two pages in both views.

Tested the [public dashboard](http://localhost:5173/dashboard) in the in-app browser, the [admin dashboard](http://localhost:5173/admin/dashboard) in the existing admin session, and WAVE and print preview in Brave. The public dashboard was returned to Neighborhood bakery, Last 7 days, and dark mode after testing.

| Test # | What I did | Expected | What happened | Pass/Fail |
|---|---|---|---|---|
| 1.1 | Opened the public dashboard and selected Last 30 days | Daily sales line, category bars, and Average day of the week bars render | All three rendered. Last 7 days correctly changes the third card title to Sales by day of the week. | Pass |
| 1.2 | Read the line chart Y-axis for Corner coffee shop, Last 30 days | Rounded dollar increments | The axis showed $0, $1K, $2K, and $3K. The bakery seven-day view showed $0, $500, $1K, and $1.5K. | Pass |
| 1.3 | Moved the pointer onto the line chart with a plot click | Full date and a space after the colon in the Sales line | “Sat, Oct 10” and “Sales: $1,964.” The separator in the DOM was a colon followed by a space. | Pass |
| 1.4 | Pointed at the first category bar for Corner coffee shop, Last 30 days | Category, amount, and percent of total | “Espresso drinks,” “$19,720,” and “40% of the total.” | Pass |
| 1.5 | Visited each weekday bar for Corner coffee shop, Last 30 days | Above/below-average comparisons, with the extremes identified | Monday showed “Lowest. 13% below the average” at $1,406. Saturday showed “Highest. 24% above the average” at $2,012. | Pass |
| 1.6 | Switched among all three businesses and both ranges, then compared a plotted day and category with the tables | Charts update with selection and sampled values agree | Chart output changed across selections. For coffee shop / 30 days, Sat, Oct 10 matched $1,964 and Espresso drinks matched $19,720. The weekday table also matched Saturday at $2,012. | Pass |
| 1.7 | Used Show table and Show chart on each card | Table replaces chart and chart returns | Each card toggled both ways. The coffee shop / 30-day tables showed 30 daily rows, five category rows, and seven weekday rows. | Pass |
| 2.1 | Tabbed from each card’s Show table control to the chart | Visible focus on all three charts | Each chart’s SVG received focus with a 3px pink outline. | Pass |
| 2.2 | Pressed Left and Right on the line chart and both bar charts | Tooltip changes by one day or category | Line moved Sun, Sep 27 → Mon, Sep 28 → Sun, Sep 27. On the category chart, Left moved down the displayed list and Right moved back. The weekday chart behaved the same way. | Pass |
| 2.3 | Inspected the three chart SVGs | Each has a meaningful title and arrow-key description | Each SVG had its chart name and business in title, and a desc explaining Left/Right navigation. | Pass |
| 2.4 | Ran the installed WAVE extension on the public dashboard in dark mode | List errors and contrast errors | 0 errors and 0 contrast errors. Six alerts were reported, five “Possible heading” and one “Redundant link.” | Pass |
| 3.1 | Opened New posts per day using the existing admin session | Two series and a legend above the plot | Two line paths rendered, with Discussions and Reviews listed above the grid. | Pass |
| 3.2 | Focused the admin line chart and pressed Right | One tooltip lists both series | The Sep 27 tooltip showed “Discussions: 8” and “Reviews: 3.” | Pass |
| 3.3 | Used arrow navigation on Reviews by platform | Platform count and percent of total | PlayStation 5 showed 23 and “25% of the total.” | Pass |
| 4.1 | Measured public layouts at 1440px, 900px, 760px, and 390px in both themes | No sideways scrolling | Document scroll width equaled viewport width in all eight combinations. | Pass |
| 4.2 | Checked SVG label bounds at the same sizes in the coffee shop 30-day view | Axis labels and right-end amounts remain visible | Sampled labels were inside the SVG and browser bounds. The narrowest chart was 241px on the two-column 900px layout. | Pass |
| 4.3 | Activated one tooltip on each chart at each width and theme | Tooltips remain within the screen and readable | All 24 sampled tooltips appeared and their bounds fit the viewport. | Pass |
| 5.1 | Activated the Daily sales pointer tooltip and opened browser Print with Save as PDF selected | Preview opens with a hover state present before printing | Verified “Sat, Oct 10” / “Sales: $1,964” on screen immediately before opening preview. | Pass |
| 5.2 | Inspected the chart and table previews | No site header, site footer, filters, or tab bar | Site navigation, site footer, date-range radio controls, and mobile tab bar were absent. The Business label and dropdown still printed on page 1 in both views. The browser’s own date, URL, and page numbers also appeared with its current defaults. | Fail |
| 5.3 | Inspected the printed line chart on page 3 and confirmed both bar charts in the chart-mode preview | Charts render without tooltip, crosshair, or active dot | The line chart and both bar charts rendered, with axes and values. The printed line had no tooltip, hover line, or active dot despite the active pointer tooltip before printing. | Pass |
| 5.4 | Checked where Daily sales and its table landed in both previews | Cards stay on one page | Daily sales split across pages 3 and 4 in both cases. Chart mode showed six pages total, with 12 daily rows beneath the chart on page 3. All-table mode showed five pages, with 18 daily rows on page 3. Remaining rows continued on page 4. | Fail |
| 5.5 | Repeated preview with Show table active on all three cards | Tables print in place of the charts | All three tables were present in preview. Daily sales still split across pages. | Pass for table rendering |

## Bugs and reproduction steps

### Business dropdown appears in print

1. Open the public dashboard and select Corner coffee shop and Last 30 days.
2. Open browser Print with Save as PDF selected.
3. Inspect page 1. The “Business” label and dropdown are visible above What happened. The business and range also appear as plain text to its right.
4. Repeat with all three cards in table view. The Business selector remains visible.

The checklist calls for filters to be hidden in print. [Page 1 screenshot](REV-recharts-print-charts.jpg)

### The 30-day Daily sales card splits in chart and table modes

1. On the public dashboard, select Corner coffee shop and Last 30 days.
2. Leave the charts visible and open Save as PDF preview with the browser’s current portrait defaults.
3. Find Daily sales on page 3. The chart and the first 12 rows appear there. The remaining 18 rows continue on page 4.
4. Close the preview, click Show table on all three cards, and reopen it. Daily sales starts on page 3 and continues on page 4 again.

The card exceeds the usable page height with the current row spacing. The repeated table headings help carry the data across the break. [Chart preview](REV-recharts-print-charts-middle.jpg) · [Table preview](REV-recharts-print-tables-middle.jpg)

## Evidence

- [900px dark layout](REV-recharts-layout-900-dark.jpg) · [390px dark layout](REV-recharts-layout-390-dark.jpg) · [390px light layout](REV-recharts-layout-390-light.jpg)
- [Admin lines and legend](REV-recharts-admin-line.jpg) · [Admin platform tooltip](REV-recharts-admin-bar.jpg)
- [Cropped WAVE results](REV-recharts-wave-results.jpg)

## Limits

- **Not tested** — actual VoiceOver speech. Focus, arrow navigation, SVG title/description, and WAVE were checked.
- **Not tested** — physical mobile devices or every hover position. Responsive checks used desktop browser viewport overrides and sampled one tooltip per chart per width and theme.
- **Not tested** — print output on paper, other print engines, or other print scales. The evidence comes from Brave’s Save as PDF preview using the existing portrait settings. No PDF file was saved.
- **Not tested** — WAVE in light mode or on the admin route. The requested WAVE run was on the public dashboard in dark mode.
