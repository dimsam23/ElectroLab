# ElectroLab
ElectroLab — a web-based electronics learning platform built with Flask and vanilla JavaScript. Includes an interactive DC circuit simulator with wiring, component simulation (resistor, capacitor, LED, diode, BJT transistor), a multimeter, and a suite of electronics calculators (Ohm's law, RC, power, color code, and more).

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Frontend | Vanilla JavaScript (ES modules), SVG |
| Styling | CSS custom properties, no framework |
| Testing | pytest |
| Database | Neon (Serverless PostgreSQL) |
| Deploy | Vercel |

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/electrolab.git
cd electrolab

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Salin file .env dan isi DATABASE_URL dari Neon Console
cp .env.example .env

# Run the development server
python run.py
```

Open `http://127.0.0.1:5000` in your browser.

## Environment Variables

Buat file `.env` di root project (jangan di-commit ke GitHub):

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
FLASK_SECRET_KEY=your-secret-key-here
```

Di Vercel, variabel ini diisi lewat **Settings → Environment Variables**.

## Running Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Project Status

| Phase | Description | Status |
|---|---|---|
| 1 | Planning & architecture | ✅ Done |
| 2 | Flask setup | ✅ Done |
| 3 | Base template & dashboard | ✅ Done |
| 4 | All calculators | ✅ Done |
| 5 | Circuit editor (drag, wire, grid) | ✅ Done |
| 6 | DC simulation & validation | ✅ Done |
| 7 | Neon + Projects & History | 🔄 In progress |
| 8 | Testing (pytest) | 🔄 Partial |
| 9 | Git & GitHub | 🔄 In progress |
| 10 | Deploy to Vercel | ⏳ Planned |

## Deployment

ElectroLab di-deploy ke **Vercel** dengan database **Neon (Serverless PostgreSQL)**.

- Production: `https://electrolab.vercel.app` *(coming soon)*
- Database: Neon, region AWS US East 2 (Ohio)

## License

MIT
