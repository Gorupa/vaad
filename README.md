<div align="center">

<img src="https://vaad.pages.dev/icon-512.png" alt="Vaad Logo" width="100" height="100" />

# ⚖️ vaad

**Democratizing access to Indian judicial data through human-centric design.**
*Upholding Dharma through accessible justice.*

Powered by **eCourts India API** &nbsp;·&nbsp; Augmented by **Google Gemini AI** &nbsp;·&nbsp; Built for every Indian

---

[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)
[![Play Store](https://img.shields.io/badge/Google%20Play-Live%20Now-414141?style=for-the-badge&logo=google-play&logoColor=white)](https://play.google.com/store/apps/details?id=dev.pages.vaad.twa)
[![Live Demo](https://img.shields.io/badge/Web%20App-vaad.pages.dev-4f46e5?style=for-the-badge&logo=googlechrome&logoColor=white)](https://vaad.pages.dev)
[![Data Source](https://img.shields.io/badge/Data-eCourts.gov.in-16a34a?style=for-the-badge)](https://ecourts.gov.in)
[![Version](https://img.shields.io/badge/Version-v2.1%20Dharma%20Update-dc2626?style=for-the-badge)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-f97316?style=for-the-badge)](https://github.com/gorupa/vaad/pulls)

</div>

---

## ⚖️ About Vaad

The Indian judicial system carries **over 50 million pending cases**. Behind every case number is a litigant, a family, an advocate — someone who needs to know when their next hearing is scheduled, what the court last ordered, and what happens next.

The official eCourts portal, despite its ambition, fails them. A fragile mobile experience, mandatory CAPTCHAs, and information buried under confusing layouts place a daily burden on the people who can least afford it.

**Vaad is the answer the system never provided.**

Search any case by CNR number, party name, or advocate — and receive the next hearing date, clearly displayed, in **under 3 seconds**. No CAPTCHAs. No advertisements. No tracking. No accounts required. Just judicial information, made accessible to everyone.

This is not a commercial product. It is a **public good** — built in the open, licensed freely, and designed to serve the people the system was built for.

> *"Access to justice is not a privilege. It is a right. Vaad exists to make that right real."*

**What sets Vaad apart:**

* ⚡ **Speed** — Next hearing date surfaced in under 3 seconds via an optimized API proxy with server-side caching.
* 🔒 **Absolute Privacy** — Zero analytics. Zero advertisements. Zero data collection. A commitment, not a policy.
* 🌍 **Radically Open** — GPLv3 licensed. Every line of code is public, inspectable, and forkable.
* 🏛️ **Civic Infrastructure** — Not a startup. Not a SaaS platform. A piece of public digital infrastructure for India.
* 🤝 **Community-Governed** — The roadmap belongs to the contributors. Every voice shapes what Vaad becomes.

---

## 🚀 Live on the Google Play Store

<div align="center">

### Vaad v2.1 — *The Dharma Update*

[![Download on Google Play](https://img.shields.io/badge/⬇️%20Download%20on%20Google%20Play-Vaad%20Court%20Tracker-414141?style=for-the-badge&logo=google-play&logoColor=white)](https://play.google.com/store/apps/details?id=dev.pages.vaad.twa)
&nbsp;&nbsp;
[![Open Web App](https://img.shields.io/badge/🌐%20Open%20Web%20App-vaad.pages.dev-4f46e5?style=for-the-badge)](https://vaad.pages.dev)

</div>

Vaad is deployed as a **Trusted Web Activity (TWA)** — the modern standard for publishing a high-performance web application to the Google Play Store with full Android integration, offline capability, and zero native code overhead.

The Dharma Update is the most significant release in Vaad's history. It introduces AI-powered legal tooling directly into the hands of advocates, litigants, and law students — at no cost to the user and with no compromise on privacy.

---

## 🌟 Features

### 🆓 Core — Free, Forever

| Feature | Description |
|---|---|
| 🔍 **CNR Search** | Lookup any case nationwide using its unique Case Number Record. |
| 👤 **Party Name Search** | Find cases by litigant name, filtered by state and district court. |
| 👨‍⚖️ **Advocate Search** | Retrieve all active cases filed under a specific advocate, by district. |
| 📅 **Priority Hearing Display** | Next hearing date surfaced prominently — the first thing you see. |
| 📜 **Full Case Timeline** | Complete order and hearing history, rendered in a clean chronological view. |
| 🔒 **Zero Ads · Zero Tracking** | Non-negotiable. This will never change. |

---

### ✨ Dharma Update — v2.1

The Dharma Update transforms Vaad from a case tracker into a **complete legal productivity platform** — the first of its kind built entirely on open civic data.

#### 🧠 Ask Vaad AI

An integrated legal assistant powered by **Google Gemini Pro**, with curated context from Indian substantive and procedural law — including the **Bharatiya Nyaya Sanhita (BNS)**, Bharatiya Sakshya Adhiniyam (BSA), and Bharatiya Nagarik Suraksha Sanhita (BSSS).

* Plain-language legal Q&A in the context of Indian law.
* Jurisdiction-aware responses across criminal, civil, and family law.
* Understands the context of cases you are actively tracking.

#### 📄 AI Order Summaries

* Automatically fetches court-issued order PDFs via eCourts links.
* Extracts **Key Findings** and the **Next Hearing Date** using document AI.
* Designed for busy advocates managing large dockets across multiple courts.

#### 💼 Practice Ledger

* A purpose-built **fee and collections tracker** for legal professionals.
* Log fees per client, track outstanding dues, and monitor collection status.
* Integrated **Razorpay payment gateway** for direct in-app fee collection.

---

### 🎓 MLSU Legal Resources

A curated open library of study notes, past papers, and academic resources for LLB students at **Mohanlal Sukhadia University, Udaipur** — because access to legal education must be as open as access to legal information.

---

## 🛠️ Architecture

### Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla JS, HTML5, CSS3, Progressive Web App (Service Worker + Web Manifest) |
| **App Delivery** | Trusted Web Activity (TWA) via PWABuilder |
| **Backend / Proxy** | Node.js, Express |
| **Document Processing** | pdf-lib, Canvas API |
| **AI Layer** | Google Gemini Pro API |
| **Payments** | Razorpay |
| **Data Source** | eCourts India API (ecourts.gov.in) |
| **Caching** | Server-side, 1-hour TTL |
| **Rate Limiting** | Express rate-limit middleware |

### Project Structure

```
vaad/
├── index.html              # Frontend shell — PWA entry point
├── manifest.json           # Web App Manifest for TWA configuration
├── sw.js                   # Service Worker — offline support & caching
├── assets/
│   ├── css/
│   │   └── style.css       # Core styles
│   └── js/
│       ├── app.js          # Case search logic (CNR / Party / Advocate)
│       ├── ai.js           # Ask Vaad AI — Gemini integration
│       ├── ledger.js       # Practice Ledger module
│       └── pdf.js          # AI Order Summary — PDF extraction
└── server/
    └── server.js           # Node.js/Express proxy, caching, rate limiting
```

### API Reference

All endpoints are served through the Node.js proxy, which manages eCourts API authentication, response caching, and rate limiting.

| Endpoint | Method | Description |
|---|---|---|
| `/api/cnr` | `GET` | Retrieve case details by CNR number |
| `/api/party` | `GET` | Search cases by party or litigant name |
| `/api/advocate` | `GET` | Search cases by advocate name and district |
| `/api/summary` | `POST` | Submit a court PDF URL for AI order summarisation |
| `/api/ask` | `POST` | Query the Ask Vaad AI legal assistant |

---

## 🤝 Join the Mission — The Dharma Roadmap

Vaad is becoming the **Dharma Network for Legal Success** — a community-governed, open platform that makes the Indian judicial system understandable and accessible to every citizen.

**We are building this together.** The roadmap below is not a wishlist — it is an open invitation. Whether you are a developer, a legal professional, a researcher, a translator, or a student, there is a meaningful place for your contribution here.

Every pull request, every issue, every wiki edit moves the needle for millions of people who depend on this tool.

---

### 🗺️ Active Collaboration Tracks

#### 1. 🏛️ Collaborative Legal Directory
*Community · Research · Data*

A **decentralised, user-verified directory** of advocate chamber numbers, local court listings, and court-specific procedural information — starting with Udaipur District Court and expanding nationally.

* **Why it matters:** Litigants and junior advocates have no reliable open directory of legal contacts. We build that together.
* **Skills needed:** Research, local court knowledge, data curation.
* **How to contribute:** Open a GitHub Discussion or contribute to the project Wiki.

---

#### 2. 🤖 AI Training & Legal Curation
*Legal Researchers · NLP Engineers*

Ask Vaad AI is only as accurate as its context. We need legal researchers to identify authoritative source documents, annotate procedural workflows, and review AI outputs — particularly across BNS, BSA, and BSSS.

* **Why it matters:** Accurate AI legal guidance, grounded in real Indian law, can change outcomes for unrepresented litigants.
* **Skills needed:** Indian procedural law, legal research. Familiarity with RAG or vector databases is a bonus.
* **How to contribute:** Open an issue tagged `ai-training`.

---

#### 3. 🌏 Global Litigant & NRI Payment Flow
*Backend Developers*

Millions of NRIs track Indian court cases from abroad. Vaad currently supports domestic payments via Razorpay. We need developers to design and implement international payment routing — Stripe, PayPal, or equivalent — with appropriate currency and compliance handling.

* **Skills needed:** Node.js, Stripe or PayPal API, international payments compliance.
* **How to contribute:** Open an issue tagged `nri-flow` with your proposed architecture.

---

#### 4. 🏦 Multi-Forum Integration
*Developers · Legal Researchers*

District courts are the beginning. High Courts, Consumer Forums, and Tribunals handle millions of additional cases. Expanding Vaad's reach to these forums is the next major frontier.

* **Skills needed:** API research, web data extraction, Node.js backend development.
* **How to contribute:** Open an issue tagged `multi-forum` to discuss available data sources.

---

#### 5. 🗣️ Multilingual Interface
*Translators · Frontend Developers*

Justice should speak your language. Priority languages for localisation: **Hindi, Marathi, Tamil, Telugu, Gujarati, and Kannada.** Implementation uses a lightweight i18n layer in Vanilla JS.

* **Skills needed:** Native language fluency, basic JavaScript for i18n integration.
* **How to contribute:** Open an issue tagged `i18n` with your target language.

---

### Getting Started as a Contributor

1. **Fork** this repository and explore open Issues and Discussions.
2. Look for tasks labelled `good first issue` or `help wanted`.
3. For significant new features, open a **Discussion** before submitting a pull request.
4. For documentation, translations, and directory contributions — no local development environment is required.
5. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for code standards and pull request guidelines.

---

## 📄 License

Vaad is distributed under the **GNU General Public License v3.0 (GPLv3)**.

You are free to use, study, modify, and redistribute this software — provided any derivative work is licensed under the same terms. This ensures that Vaad, and everything the community builds upon it, remains **permanently free and publicly owned.**

See [`LICENSE`](LICENSE) for the complete license text.

---

## ⚠️ Legal Disclaimer

* Case data is retrieved in real-time from **ecourts.gov.in** via a server-side proxy.
* Vaad is **not affiliated with** the National Informatics Centre (NIC), the Ministry of Law and Justice, the Government of India, or the Supreme Court eCommittee.
* Data is cached server-side for a maximum of **1 hour** to reduce load on upstream government infrastructure and is never stored persistently.
* Vaad does not collect, store, or share any user queries, search terms, or case data.
* Responses from **Ask Vaad AI** are for **informational purposes only** and do not constitute legal advice. For legal counsel, consult a qualified and enrolled advocate.

---

<div align="center">

---

*A public good for India's 1.4 billion.*

**[Gaurav Kalal](https://gorupa.github.io)** &nbsp;·&nbsp; UN Volunteer &nbsp;·&nbsp; LLB Student, MLSU Udaipur
*Initiated in Udaipur, Rajasthan. Sustained by the community.*

⚖️ *Upholding Dharma through accessible justice.*

[![Portfolio](https://img.shields.io/badge/Portfolio-gorupa.github.io-4f46e5?style=flat-square)](https://gorupa.github.io)
[![dev.to](https://img.shields.io/badge/dev.to-gorupa-0a0a0a?style=flat-square&logo=devdotto)](https://dev.to/gorupa)
[![npm](https://img.shields.io/badge/npm-bullpenm-cb3837?style=flat-square&logo=npm)](https://www.npmjs.com/~bullpenm)

</div>
