<div align="center">
  <img src="static/icons/logo.png" width="120" style="border-radius: 20px;" alt="LocalCare Finder Logo">
  <h1>🏥 LocalCare Finder</h1>
  <p><strong>Find Vital Healthcare. Exactly When You Need It.</strong></p>

  <p>
    <a href="https://github.com/arupdas0825/localcare-finder/actions"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/arupdas0825/localcare-finder/python-ci.yml?branch=main&style=flat-square" /></a>
    <a href="https://github.com/arupdas0825/localcare-finder/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
    <img alt="Python Version" src="https://img.shields.io/badge/python-3.8%2B-blue.svg?style=flat-square" />
    <img alt="Flask Framework" src="https://img.shields.io/badge/flask-latest-green.svg?style=flat-square" />
    <img alt="OpenStreetMap" src="https://img.shields.io/badge/Mapping-OSM_&_Leaflet-orange.svg?style=flat-square" />
  </p>
</div>

<br>

**LocalCare Finder** is a rapid, robust public utility web application engineered to help users instantly locate nearby healthcare infrastructure—hospitals, pharmacies, and blood banks. 

By leveraging real-time OpenStreetMap APIs and intelligent location-based searching, LocalCare Finder ensures that critical medical services are always accessible when time matters most.

---

## 🚀 Features

- **🔍 Smart Search:** Instantly locate healthcare services by inputting a city name.
- **📍 Auto-Location Detection:** One-click GPS mapping finds services precisely around your current coordinates.
- **🗺️ Interactive Glassmorphism Map:** Explore dynamic markers and clusters via a premium Leaflet.js interface.
- **🏥 Comprehensive Coverage:** Pinpoint nearby Hospitals, Pharmacies, Clinics, and Blood Banks.
- **🚑 Live Emergency Mode:** One-tap access to critical regional dispatch contacts (Ambulance, Police, Fire).
- **⭐ Persistent Favorites:** Save preferred locations directly to browser `localStorage` for quick access.
- **🤖 AI Symptom Assistant:** Integrated NLP routing suggests the right facility based on typed symptoms.
- **📊 Admin Analytics:** Monitor live search trends and application health via an integrated dashboard.
- **🌓 Deep Dark Mode:** Beautiful, high-contrast dark theme optimized for low-light environments.

---

## 🧰 Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Python, Flask, Requests | Lightweight, scalable WSGI web server handling API routing and proxying. |
| **Frontend** | HTML5, Vanilla JavaScript, CSS3 | Pure native browser code featuring glassmorphism design and deep custom CSS variables. |
| **Mapping Engine** | Leaflet.js | High-performance open-source JavaScript library for mobile-friendly interactive maps. |
| **Data APIs** | Nominatim & Overpass API | Live integration with OpenStreetMap nodes for geocoding and facility retrieval. |
| **Storage** | Browser `localStorage` & JSON | Zero-database architecture; utilizes local flat JSON files and browser state for persistence. |

---

## 📁 Project Structure

```text
localcare-finder/
├── app.py                      # Main Flask application and route definitions
├── config.py                   # Environment configuration (Dev/Prod settings)
├── requirements.txt            # Python dependencies
├── README.md                   # Project documentation
│
├── services/                   
│   └── location_service.py     # Core business logic: Geocoding, OSM queries, Distance calculations 
│
├── utils/
│   └── api_helper.py           # Robust HTTP request wrappers and error handling
│
├── templates/
│   ├── index.html              # Landing page & Search Hero
│   ├── results.html            # Main map interface and clustered list
│   └── dashboard.html          # Administrator analytics interface
│
├── static/
│   ├── css/style.css           # Global V2 UI stylesheet (Dark mode, animations, grid)
│   └── js/script.js            # Client-side map initialization, API fetching, and UI logic
│
└── data/
    └── emergency_contacts.json # Localized database of critical dispatch numbers
```

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/arupdas0825/localcare-finder.git
   cd localcare-finder
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the environment:**
   - **Windows:**
     ```bash
     venv\Scripts\activate
     ```
   - **Mac/Linux:**
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

## ▶️ Running the Application

Start the local Flask development server:
```bash
python app.py
```

Open your browser and navigate to:
[**http://127.0.0.1:5000**](http://127.0.0.1:5000)

---

## 📡 API Endpoints

The application exposes a lightweight internal API for the frontend:

| Endpoint | Method | Function |
| :--- | :---: | :--- |
| `/` | `GET` | Render the dynamic homepage and AI Search. |
| `/search` | `POST` | Process HTML form fallbacks and redirect to results layout. |
| `/api/nearby` | `GET` | Main OSM proxy. Fetches and sorts nearby facilities `(?lat=X&lon=Y&type=hospital)`. |
| `/api/emergency` | `GET` | Retrieves region-specific emergency dispatch contacts. |
| `/api/stats` | `GET` | Returns aggregated search analytics for the admin dashboard. |
| `/dashboard`| `GET` | Render the Admin Analytics UI. |

---

## 📸 Screenshots

*(Placeholders - Add your images to a `/docs` or `/screenshot` folder inside your repo and link them here)*
<div align="center">
  
  | Homepage UI | Map Results Page |
  |:---:|:---:|
  | `<img src="https://via.placeholder.com/400x250.png?text=Homepage" width="400">` | `<img src="https://via.placeholder.com/400x250.png?text=Interactive+Map" width="400">` |

  | Emergency Mode | Admin Dashboard |
  |:---:|:---:|
  | `<img src="https://via.placeholder.com/400x250.png?text=Emergency+UI" width="400">` | `<img src="https://via.placeholder.com/400x250.png?text=Analytics" width="400">` |

</div>

---

## 🛣️ Future Roadmap

- [ ] **Mobile App Version:** Port the frontend to React Native/Flutter for native iOS and Android deployment.
- [ ] **Real-time Metrics:** Add queue tracking and live ambulance positional tracking.
- [ ] **Community Ratings:** Implement a hospital rating and verified review system.
- [ ] **i18n Localization:** Add multi-language support for diverse demographic regions.
- [ ] **Advanced AI routing:** Upgrade the symptom checker to a fine-tuned Medical LLM.

---

## 🤝 Contributing

We welcome and encourage community contributions! To make the process as easy as possible:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes following Conventional Commits (`git commit -m 'feat: Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests to us.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Support

Building open-source healthcare infrastructure takes time and coffee. If you find **LocalCare Finder** useful in your educational projects or daily life, please consider giving the repository a **Star** on GitHub!

<div align="center">
Made with ❤️ by the open-source community.
</div>
