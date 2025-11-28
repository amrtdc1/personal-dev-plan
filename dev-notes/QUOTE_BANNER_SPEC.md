# PDP App — Inspirational Quote Banner (Quotable API Integration)
**Feature Specification for VS Code Copilot**

## Overview

This document defines the requirements for adding a new **Inspirational Quote Banner** to the PDP App. This feature does **not currently exist** in any form. The banner should appear below the header/navigation area and display a motivational quote sourced from the **Quotable API**.

The goal is to provide users with a daily inspirational touchpoint as part of their PDP experience.

This document should be used by VS Code Copilot as the source of truth for implementing this feature.


---

# 1. Feature Summary

The app will gain a new UI component called the **Quote Banner**.

Key elements:

- Positioned directly **below the header/nav** area, above main view content.
- Shows an inspirational quotation:
  - Quote text  
  - Quote author  
- Source of quotes: **Quotable API**  
- Includes a **refresh button** that fetches a new random quote.
- Uses **localStorage caching** to avoid unnecessary API calls:
  - One quote per day is fetched and stored.
  - Subsequent loads use cached quote until the day changes.
- Fully supports **Light**, **Dark**, and **CWM** themes.

The banner must use the same background and have no border so it appears to be a part of the page. The quote font should be italicized.


---

# 2. UI Requirements

## 2.1 Placement
Add a new element in `index.html`, placed **just under the header and navigation**:

```html
<section class="quote-banner" id="quoteBanner"></section>
