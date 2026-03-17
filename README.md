# vaad

[![AGPL-3.0 License](https://img.shields.io/badge/License-AGPL--3.0-red?style=for-the-badge)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-vaad.pages.dev-brightgreen?style=for-the-badge)](https://vaad.pages.dev)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-6d28d9?style=for-the-badge&logo=github)](https://github.com/Gorupa/vaad)
[![Data](https://img.shields.io/badge/Data-eCourts%20India-blue?style=for-the-badge)](https://ecourts.gov.in)

> Track Indian court cases instantly. Search by CNR number, party name or advocate name. Clean results, next hearing date front and centre. Free, no ads, open source.

---

## The Problem

The official eCourts portal works — but it's painful on mobile, full of CAPTCHA, hard to navigate and shows information in a confusing order.

A litigant waiting for their next hearing date has to click through 5 screens to find it.

vaad.in shows it in 3 seconds.

---

## Features

- **CNR search** — paste your 16-digit case number, get full details instantly
- **Party name search** — find cases by petitioner or respondent name
- **Advocate search** — see all cases for an advocate by district
- **Next hearing date** — shown immediately, front and centre
- **Case history timeline** — all hearings in order
- **Zero ads · Zero tracking · Open source**

---

## Architecture

```
frontend/          ← Static HTML/CSS/JS (Cloudflare Pages)
  index.html

backend/           ← Node.js + Express (Render free tier)
  server.js        ← API server
  package.json
```

The backend proxies requests to the eCourts API, adds caching and rate limiting, and returns clean JSON to the frontend.


## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server status |
| GET | `/api/states` | All states |
| GET | `/api/districts?state_code=24` | Districts for a state |
| POST | `/api/cnr` | Case details by CNR |
| POST | `/api/party` | Cases by party name |
| POST | `/api/advocate` | Cases by advocate name |

---

## Roadmap

- [ ] Save cases locally (localStorage)
- [ ] Hearing date reminder (PWA notifications)
- [ ] High Court support
- [ ] Consumer Forum support
- [ ] Download case history as PDF
- [ ] PWA — installable on phone

---

## Legal Note

vaad.in fetches publicly available data from eCourts India (ecourts.gov.in). It does not store case data beyond a 1-hour cache. It is not affiliated with NIC or the eCommittee of the Supreme Court of India.

---

## License 

[AGPL-3.0](LICENSE) © 2026 [gorupa](https://github.com/gorupa) / Gaurav Kalal

This means: anyone who runs a modified version of vaad.in as a public service must also release their source code. Free forever for individuals, lawyers, students and NGOs.
