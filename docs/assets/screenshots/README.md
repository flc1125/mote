# Viewer reference screenshots

These captures illustrate the synthetic [Markdown specimens](../../markdown.md#publishable-specimens).
Keep screenshots here; logos, icons, favicons and the brand manifest remain in the parent directory.

## Capture baseline

- Captured on 2026-09-17 in Chrome 152.0.7977.83 on macOS, with a device scale factor of 1 and reduced motion enabled.
- Existing PNG names and pixel dimensions are preserved. These are viewport captures, without browser chrome, account details or local paths.
- The two light compatibility captures and the theme menu use the existing [public compatibility specimen](https://mote.pub/PBqEnukxpQrkamSi). These captures predate the image specimen publication below.
- All other captures use local previews of the linked sources with the renderer and its exact CSP headers from `a5eb179`. Local assets are collected by the CLI bundle builder. The image specimen includes the refreshed tabs desktop capture and the updated navigation description.
- Dark captures emulate `prefers-color-scheme: dark`. The theme-menu capture shows Auto selected while the system preference is dark.

## Inventory

| Capture                                                      | Pixels      | Source and visible state                                                                                                                 |
| ------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Compatibility desktop](markdown-compatibility-desktop.png)  | 1440 × 1000 | Public compatibility specimen, C07 mathematics and C08 flowchart; contents closed, back-to-top visible                                   |
| [Compatibility mobile](markdown-compatibility-mobile.png)    | 375 × 812   | Same public sections in a narrow viewport; back-to-top visible                                                                           |
| [Compatibility dark charts](markdown-compatibility-dark.png) | 1440 × 1000 | Local [supplementary diagrams](../../examples/markdown-diagrams.md), D02 bars/lines and D03 compact statements; contents closed          |
| [Tabs desktop](markdown-tabs-desktop.png)                    | 1280 × 720  | Local [tabs specimen](../../examples/markdown-tabs.md), first tab selected; also embedded in the image specimen                          |
| [Tabs mobile](markdown-tabs-mobile.png)                      | 390 × 844   | Same opening tab group in a narrow viewport                                                                                              |
| [Typography desktop](markdown-typography-desktop.png)        | 1932 × 1354 | Local [typography specimen](../../examples/markdown-typography.md), highlights and definitions                                           |
| [Typography dark](markdown-typography-dark.png)              | 1280 × 720  | Same opening content in dark mode                                                                                                        |
| [Typography mobile](markdown-typography-mobile.png)          | 390 × 844   | Same opening content in a narrow viewport                                                                                                |
| [Admonitions desktop](markdown-admonitions-desktop.png)      | 1646 × 1354 | Local [admonitions specimen](../../examples/markdown-admonitions.md), command disclosure open and neutral-gray example disclosure closed |
| [Admonitions dark](markdown-admonitions-dark.png)            | 1280 × 720  | Section 4, neutral-gray example disclosure open; nested important disclosure closed                                                      |
| [Reading desktop](markdown-reading-desktop.png)              | 1280 × 960  | Local [reading specimen](../../examples/markdown-reading.md), short footnote preview open                                                |
| [Reading dark](markdown-reading-dark.png)                    | 1280 × 960  | Same short footnote preview in dark mode                                                                                                 |
| [Reading mobile](markdown-reading-mobile.png)                | 390 × 844   | Rich footnote preview with an image and code, bounded by the viewport                                                                    |
| [Images desktop](markdown-images-desktop.png)                | 1932 × 1329 | Local [image specimen](../../examples/markdown-images.md), refreshed tabs image and caption                                              |
| [Images dark](markdown-images-dark.png)                      | 1280 × 720  | Same image and caption on the dark page; viewer closed                                                                                   |
| [Images mobile](markdown-images-mobile.png)                  | 390 × 844   | Image viewer open, navigation arrows and 1 / 3 counter visible                                                                           |
| [Theme menu dark](markdown-theme-menu-dark.png)              | 1440 × 1000 | Public compatibility specimen, Auto/Light/Dark menu open with Auto selected                                                              |

## Verification and limits

The public specimen was checked at 1440px and 375px widths: all three theme choices, persistence after reload, Auto following the system preference, heading-anchor hover visibility, and back-to-top visibility and activation. The local image viewer was checked for next-button navigation, the Left key, counter updates and Escape closing. Local footnote previews stayed inside their desktop/mobile viewports and closed with Escape. Captured pages had no horizontal page overflow; wide diagrams retain their own scrolling area.

The final local preview checks reported no page or console errors. The public specimen emitted CSP-blocked Cloudflare JavaScript Detections and Web Analytics beacon messages; these are recorded separately from the successful control checks. No CSP or deployment settings were changed.

These captures do not establish Firefox, Safari, touch-device, printing or JavaScript-disabled compatibility.

The updated [image specimen](https://mote.pub/qAMkdNwYPKfvy8Yi) was published on 2026-09-17 with CLI 0.7.0, including the refreshed tabs image. The earlier missing-credential result came from restricted execution; the normal system keyring worked and online OAuth authentication succeeded. No new login was needed. The image captures above remain local-preview captures, not captures of this new URL. Other specimens do not need republication solely for Viewer styling changes.

The published image specimen was checked in the same Chrome version at 1280 × 960 and 390 × 844: its three bundled assets matched the local files by SHA-256, and next-image navigation, the Left key, counter updates and Escape closing worked without horizontal page overflow. The caption links to the public Markdown guide. The two Cloudflare script injections remained CSP-blocked.

Refresh the tabs desktop capture before rendering the image specimen so that its bundled screenshot is current. Preserve a capture only while it illustrates a documented feature or serves as a referenced specimen asset.
