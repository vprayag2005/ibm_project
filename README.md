# 🥗 NutriGenie — AI Nutrition Agent
### Powered by IBM Watsonx.ai · Granite-3-8B-Instruct · Flask

> A full-stack, AI-powered nutrition web application with chat interface, meal planning, calorie analysis, BMI calculator, and family diet profiles — all running on IBM Watsonx.ai with Granite models.

---

## 📋 Table of Contents
1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Quick Setup](#quick-setup)
5. [IBM Cloud Setup](#ibm-cloud-setup)
6. [Customising the Agent](#customising-the-agent)
7. [Running Locally](#running-locally)
8. [API Reference](#api-reference)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Conversational nutrition assistant with history |
| 🍽️ **7-Day Meal Planner** | Personalised AI-generated meal plans |
| 🔬 **Calorie Analyser** | Instant nutritional breakdown of any food |
| ⚖️ **BMI & TDEE Calculator** | Body metrics + daily calorie targets |
| 👨‍👩‍👧 **Family Profiles** | Individual + unified family meal plans |
| 📊 **Nutrition Dashboard** | Visual macros, stats, and quick insights |
| 🇮🇳 **Indian Food Support** | Specialised Indian cuisine recommendations |
| 🌙 **Dark Mode** | Full light/dark theme toggle |
| 📱 **Mobile Responsive** | Works on all screen sizes |
| 🔧 **AGENT_INSTRUCTIONS** | Fully customisable agent behaviour |

---

## 📁 Project Structure

```
nutrition_agent/
├── app.py                    # Main Flask app + Watsonx.ai integration
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
├── .env                      # Your secrets (DO NOT commit)
├── templates/
│   └── index.html            # Single-page HTML frontend
└── static/
    ├── css/
    │   └── style.css         # Custom styles + dark mode
    └── js/
        └── app.js            # Frontend logic & API calls
```

---

## ✅ Prerequisites

- Python **3.10+**
- pip
- IBM Cloud account (free tier works)
- IBM Watsonx.ai project

---

## ⚡ Quick Setup

### 1. Clone or download the project

```bash
cd nutrition_agent
```

### 2. Create a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
# Copy the template
cp .env.example .env
```

Then edit `.env` with your actual IBM credentials (see IBM Cloud Setup below).

---

## 🔐 IBM Cloud Setup

### Step 1 — Create an IBM Cloud API Key

1. Go to [https://cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys)
2. Click **Create an IBM Cloud API key**
3. Name it (e.g. `nutrigenie-key`) and copy the key
4. Paste it as `IBM_API_KEY` in your `.env` file

### Step 2 — Get your Watsonx.ai Project ID

1. Go to [https://dataplatform.cloud.ibm.com/](https://dataplatform.cloud.ibm.com/)
2. Create a new project (or use an existing one)
3. Go to **Manage → General** tab
4. Copy the **Project ID**
5. Paste it as `WATSONX_PROJECT_ID` in your `.env` file

### Step 3 — Verify your `.env` file

```env
IBM_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WATSONX_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=my-super-secret-key-change-this
FLASK_ENV=development
FLASK_DEBUG=True
PORT=5000
```

> ⚠️ **Never commit your `.env` file to Git.** Add it to `.gitignore`.

---

## 🎛️ Customising the Agent

All agent behaviour is controlled by the `AGENT_INSTRUCTIONS` block at the top of `app.py`. No code changes needed — just edit the dictionary:

```python
AGENT_INSTRUCTIONS = {
    # Change the agent's name & role
    "name": "NutriGenie",
    "role": "You are NutriGenie, an expert AI nutritionist...",

    # Adjust communication style
    "tone": "Be warm, encouraging, and motivating...",

    # Enable/disable Indian food preferences
    "indian_food_preferences": {
        "enabled": True,   # ← Set False to disable
        ...
    },

    # Add/remove safety rules
    "safety_rules": [
        "Always recommend consulting a doctor for serious conditions.",
        ...
    ],

    # Tune model response quality
    "model_params": {
        "temperature": 0.7,       # Lower = more factual, Higher = more creative
        "max_new_tokens": 1024,   # Max response length
        "top_p": 0.9,
    },
}
```

### Common customisations

| Want to... | Change |
|---|---|
| Make the agent more strict/clinical | Set `temperature` to `0.3–0.5` |
| Make responses more creative | Set `temperature` to `0.8–0.9` |
| Disable Indian food focus | Set `indian_food_preferences.enabled` to `False` |
| Add a new diet specialisation | Append to `diet_specializations` list |
| Change agent persona | Update `name`, `role`, and `tone` |
| Limit response length | Decrease `max_new_tokens` |

---

## 🚀 Running Locally

```bash
# Make sure your virtual environment is activated
python app.py
```

The app starts at: **http://localhost:5000**

For production (with Gunicorn):

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

---

## 📡 API Reference

All endpoints accept and return JSON.

### `POST /api/chat`
General nutrition chat.
```json
// Request
{ "message": "What should I eat for breakfast?", "history": [], "profile": {} }

// Response
{ "reply": "...", "timestamp": "...", "agent": "NutriGenie" }
```

### `POST /api/meal-plan`
Generate a 7-day meal plan.
```json
// Request
{ "profile": { "goal": "weight_loss", "diet_type": "vegetarian" }, "preferences": "include South Indian food" }

// Response
{ "meal_plan": "...", "timestamp": "..." }
```

### `POST /api/calorie-analysis`
Nutritional analysis of any food.
```json
// Request
{ "food": "2 roti with dal makhani and lassi" }

// Response
{ "analysis": "...", "food": "...", "timestamp": "..." }
```

### `POST /api/family-plan`
Family nutrition plan.
```json
// Request
{ "members": [{ "name": "Priya", "age": 35, "gender": "female", "goal": "weight loss" }] }

// Response
{ "family_plan": "...", "member_count": 1, "timestamp": "..." }
```

### `POST /api/bmi`
BMI + TDEE calculation.
```json
// Request
{ "weight": 70, "height": 165, "age": 28, "gender": "female", "activity": "moderate" }

// Response
{ "bmi": 25.7, "category": "Overweight", "tdee": 2145, "weight_loss": 1645, ... }
```

### `GET /api/quick-suggestions`
Pre-built suggestion prompts for the chat.

### `GET /api/health`
Health check endpoint.

---

## 🌐 Deployment

### Option A — IBM Code Engine (Recommended)

```bash
# Build container
docker build -t nutrigenie .

# Push to IBM Container Registry
ibmcloud cr login
ibmcloud cr image-push us.icr.io/<namespace>/nutrigenie:latest

# Deploy to Code Engine
ibmcloud ce application create \
  --name nutrigenie \
  --image us.icr.io/<namespace>/nutrigenie:latest \
  --env IBM_API_KEY=<key> \
  --env WATSONX_PROJECT_ID=<id> \
  --port 5000
```

### Option B — Render.com (Easy free deployment)

1. Push code to GitHub (ensure `.env` is in `.gitignore`)
2. Create new **Web Service** on Render
3. Connect your repository
4. Set **Build Command:** `pip install -r requirements.txt`
5. Set **Start Command:** `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`
6. Add environment variables in Render dashboard

### Option C — Docker

```bash
# Create Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t nutrigenie .
docker run -p 5000:5000 --env-file .env nutrigenie
```

### Option D — Heroku

```bash
heroku create nutrigenie-app
heroku config:set IBM_API_KEY=xxx WATSONX_PROJECT_ID=yyy FLASK_SECRET_KEY=zzz
git push heroku main
```

---

## 🐛 Troubleshooting

### `IBM_API_KEY and WATSONX_PROJECT_ID must be set`
→ Create `.env` file from `.env.example` and fill in your IBM credentials.

### `Model error: 401 Unauthorized`
→ Your IBM API key is invalid or expired. Create a new one at [cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys).

### `Model error: 403 Forbidden`
→ Your API key doesn't have access to the Watsonx.ai project. Ensure the key has **Editor** role on the project.

### `Model error: 404 Not Found`
→ Check `WATSONX_URL` — for Dallas use `https://us-south.ml.cloud.ibm.com`, for Frankfurt use `https://eu-de.ml.cloud.ibm.com`.

### Slow responses
→ Normal for first request (cold start). Subsequent requests are faster. Reduce `max_new_tokens` in `AGENT_INSTRUCTIONS` for faster responses.

### App runs but chat doesn't respond
→ Open browser DevTools → Network tab, check for 500 errors. Confirm your `.env` values are correct.

---

## 📄 License

MIT — free to use, modify, and deploy.

---

## 🙏 Credits

- **AI Model:** [IBM Granite-3-8B-Instruct](https://www.ibm.com/granite) via IBM Watsonx.ai
- **Framework:** Flask + Bootstrap 5
- **Icons:** Bootstrap Icons
