"""
╔══════════════════════════════════════════════════════════════════╗
║          IBM Watsonx.ai — AI Nutrition Agent  (app.py)          ║
║  Built with Flask + IBM Granite-3-8B-Instruct via Watsonx.ai   ║
╚══════════════════════════════════════════════════════════════════╝

Customise the agent entirely via the AGENT_INSTRUCTIONS block below.
"""

import os
import json
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────────────
# 1.  AGENT INSTRUCTIONS  ← Edit this block to customise the agent
# ─────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = {
    # ── Identity & Role ──────────────────────────────────────────
    "name": "NutriGenie",
    "role": (
        "You are NutriGenie, an expert AI nutritionist and diet planner. "
        "You specialise in personalised nutrition, calorie analysis, meal planning, "
        "and family diet recommendations."
    ),

    # ── Tone & Communication Style ────────────────────────────────
    "tone": (
        "Be warm, encouraging, and motivating. Use simple language that anyone can "
        "understand. Celebrate small wins. Never shame or judge food choices. "
        "Be concise but thorough — use bullet points and structured sections."
    ),

    # ── Diet Specialisations ─────────────────────────────────────
    "diet_specializations": [
        "Weight loss & management",
        "Muscle gain & sports nutrition",
        "Diabetes-friendly diets",
        "Heart-healthy diets",
        "PCOS / hormonal balance diets",
        "Thyroid-supportive nutrition",
        "Pregnancy & lactation nutrition",
        "Child & adolescent nutrition",
        "Senior / elderly nutrition",
        "Vegetarian & vegan diets",
        "Intermittent fasting guidance",
        "Gut health & microbiome diets",
    ],

    # ── Indian Food Preferences ───────────────────────────────────
    "indian_food_preferences": {
        "enabled": True,
        "description": (
            "Prioritise Indian cuisine in meal plans when the user's profile or "
            "query suggests an Indian background. Include staple Indian foods like "
            "dal, sabzi, roti, rice, idli, dosa, poha, upma, curd, lassi, "
            "seasonal fruits, and regional specialties. "
            "Respect regional variations: North Indian, South Indian, East Indian, "
            "West Indian, and street food. Suggest healthier versions of popular "
            "Indian dishes (e.g., baked samosa, oats idli, quinoa khichdi)."
        ),
        "staples": [
            "Dal (lentils)", "Roti / Chapati", "Rice", "Sabzi (vegetables)",
            "Curd / Yoghurt", "Idli / Dosa", "Poha", "Upma", "Khichdi",
            "Paneer", "Sprouts", "Buttermilk (Chaas)", "Lassi", "Raita",
        ],
    },

    # ── Safety & Medical Rules ────────────────────────────────────
    "safety_rules": [
        "Always recommend consulting a registered dietitian or doctor for "
        "serious medical conditions (diabetes, kidney disease, eating disorders).",
        "Never prescribe medications, supplements with exact medical dosages, "
        "or extreme calorie restrictions (< 1000 kcal/day) without medical guidance.",
        "Flag any query that shows signs of disordered eating with a compassionate "
        "message and suggest professional support.",
        "For pregnant or breastfeeding users, always add a note to consult their OB/GYN.",
        "Calorie suggestions are estimates; individual needs vary.",
    ],

    # ── Response Format Guidelines ────────────────────────────────
    "response_format": (
        "Structure responses clearly. Use:\n"
        "• Emojis sparingly for visual cues (🥗 🍎 💪 ✅)\n"
        "• Bold section headers using **Header:**\n"
        "• Bullet lists for meal items and tips\n"
        "• Calorie counts in parentheses e.g. (350 kcal)\n"
        "• A motivational closing line for meal plan responses"
    ),

    # ── Capabilities ─────────────────────────────────────────────
    "capabilities": [
        "Generate 7-day personalised meal plans",
        "Analyse calories and macronutrients of any food or meal",
        "Suggest healthy substitutions for unhealthy foods",
        "Build family nutrition plans with age-appropriate portions",
        "Answer questions about vitamins, minerals, and superfoods",
        "Explain nutritional science in simple terms",
        "Create grocery shopping lists from meal plans",
        "Provide pre/post workout nutrition guidance",
    ],

    # ── Model Parameters ─────────────────────────────────────────
    "model_params": {
        "max_new_tokens": 1024,
        "min_new_tokens": 50,
        "temperature": 0.7,
        "top_p": 0.9,
        "top_k": 50,
        "repetition_penalty": 1.1,
    },
}
# ─────────────────────────────────────────────────────────────────


# ── App Initialisation ────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
CORS(app)

# ── Watsonx.ai Client ─────────────────────────────────────────────
_watsonx_client: ModelInference | None = None


def get_watsonx_client() -> ModelInference:
    """Lazy-initialise the Watsonx.ai model client (singleton)."""
    global _watsonx_client
    if _watsonx_client is None:
        api_key = os.getenv("IBM_API_KEY")
        project_id = os.getenv("WATSONX_PROJECT_ID")
        url = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

        if not api_key or not project_id:
            raise ValueError(
                "IBM_API_KEY and WATSONX_PROJECT_ID must be set in the .env file."
            )

        credentials = Credentials(url=url, api_key=api_key)
        client = APIClient(credentials=credentials, project_id=project_id)

        _watsonx_client = ModelInference(
            model_id="ibm/granite-3-8b-instruct",
            api_client=client,
            params={
                GenParams.MAX_NEW_TOKENS: AGENT_INSTRUCTIONS["model_params"]["max_new_tokens"],
                GenParams.MIN_NEW_TOKENS: AGENT_INSTRUCTIONS["model_params"]["min_new_tokens"],
                GenParams.TEMPERATURE:    AGENT_INSTRUCTIONS["model_params"]["temperature"],
                GenParams.TOP_P:          AGENT_INSTRUCTIONS["model_params"]["top_p"],
                GenParams.TOP_K:          AGENT_INSTRUCTIONS["model_params"]["top_k"],
                GenParams.REPETITION_PENALTY: AGENT_INSTRUCTIONS["model_params"]["repetition_penalty"],
            },
        )
    return _watsonx_client


# ── Prompt Builder ────────────────────────────────────────────────
def build_system_prompt(user_profile: dict | None = None) -> str:
    """Assemble the system prompt from AGENT_INSTRUCTIONS + optional user profile."""
    ai = AGENT_INSTRUCTIONS
    indian = ai["indian_food_preferences"]

    profile_context = ""
    if user_profile:
        profile_context = (
            f"\n\n**Current User Profile:**\n"
            f"- Name: {user_profile.get('name', 'User')}\n"
            f"- Age: {user_profile.get('age', 'Unknown')}\n"
            f"- Gender: {user_profile.get('gender', 'Unknown')}\n"
            f"- Weight: {user_profile.get('weight', 'Unknown')} kg\n"
            f"- Height: {user_profile.get('height', 'Unknown')} cm\n"
            f"- Goal: {user_profile.get('goal', 'General wellness')}\n"
            f"- Activity Level: {user_profile.get('activity', 'Moderate')}\n"
            f"- Dietary Restrictions: {user_profile.get('restrictions', 'None')}\n"
            f"- Medical Conditions: {user_profile.get('conditions', 'None')}\n"
        )

    safety_text = "\n".join(f"  • {rule}" for rule in ai["safety_rules"])
    caps_text = "\n".join(f"  • {cap}" for cap in ai["capabilities"])
    indian_text = (
        f"\n\n**Indian Food Specialisation:** {indian['description']}\n"
        f"Key Indian staples to include: {', '.join(indian['staples'][:8])}."
        if indian["enabled"]
        else ""
    )

    return (
        f"{ai['role']}\n\n"
        f"**Tone & Style:** {ai['tone']}\n\n"
        f"**Your Capabilities:**\n{caps_text}\n\n"
        f"**Safety Rules (always follow):**\n{safety_text}"
        f"{indian_text}"
        f"{profile_context}\n\n"
        f"**Response Format:** {ai['response_format']}"
    )


def build_prompt(user_message: str, conversation_history: list, user_profile: dict | None = None) -> str:
    """Build the full chat prompt in Granite instruct format."""
    system_prompt = build_system_prompt(user_profile)

    prompt = f"<|system|>\n{system_prompt}\n"

    # Append conversation history (last 6 turns to stay within token budget)
    for turn in conversation_history[-6:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        prompt += f"<|{role}|>\n{content}\n"

    prompt += f"<|user|>\n{user_message}\n<|assistant|>\n"
    return prompt


# ── Nutrition Utility Functions ───────────────────────────────────
def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    """Calculate BMI and return category + advice."""
    if height_cm <= 0 or weight_kg <= 0:
        return {"error": "Invalid height or weight."}

    height_m = height_cm / 100
    bmi = round(weight_kg / (height_m ** 2), 1)

    if bmi < 18.5:
        category = "Underweight"
        color = "#3b82f6"
        advice = "Consider increasing calorie-dense nutritious foods. Consult a dietitian."
    elif bmi < 25:
        category = "Normal Weight"
        color = "#22c55e"
        advice = "Great! Maintain your healthy weight with balanced nutrition and exercise."
    elif bmi < 30:
        category = "Overweight"
        color = "#f59e0b"
        advice = "A modest calorie deficit with regular activity can help reach a healthy range."
    else:
        category = "Obese"
        color = "#ef4444"
        advice = "Please consult a healthcare provider for a personalised weight management plan."

    return {
        "bmi": bmi,
        "category": category,
        "color": color,
        "advice": advice,
    }


def calculate_tdee(weight_kg: float, height_cm: float, age: int, gender: str, activity: str) -> dict:
    """Calculate Total Daily Energy Expenditure using Mifflin-St Jeor equation."""
    if gender.lower() in ("male", "m"):
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    multiplier = multipliers.get(activity.lower(), 1.55)
    tdee = round(bmr * multiplier)

    return {
        "bmr": round(bmr),
        "tdee": tdee,
        "weight_loss": tdee - 500,
        "weight_gain": tdee + 300,
        "maintenance": tdee,
    }


# ── Flask Routes ──────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", agent_name=AGENT_INSTRUCTIONS["name"])


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint — forwards user message to Watsonx Granite model."""
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    conversation_history = data.get("history", [])
    user_profile = data.get("profile")

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    try:
        model = get_watsonx_client()
        prompt = build_prompt(user_message, conversation_history, user_profile)
        response = model.generate_text(prompt=prompt)
        reply = response.strip() if isinstance(response, str) else str(response)

        return jsonify({
            "reply": reply,
            "timestamp": datetime.now().isoformat(),
            "agent": AGENT_INSTRUCTIONS["name"],
        })

    except ValueError as e:
        return jsonify({"error": str(e), "type": "config_error"}), 500
    except Exception as e:
        return jsonify({"error": f"Model error: {str(e)}", "type": "model_error"}), 500


@app.route("/api/meal-plan", methods=["POST"])
def generate_meal_plan():
    """Generate a structured 7-day meal plan."""
    data = request.get_json(silent=True) or {}
    profile = data.get("profile", {})
    preferences = data.get("preferences", "")

    prompt_text = (
        f"Generate a detailed 7-day meal plan for:\n"
        f"- Goal: {profile.get('goal', 'balanced nutrition')}\n"
        f"- Dietary type: {profile.get('diet_type', 'vegetarian')}\n"
        f"- Calories target: {profile.get('calories', 'auto-calculate')}\n"
        f"- Restrictions: {profile.get('restrictions', 'none')}\n"
        f"- Preferences: {preferences or 'include Indian foods'}\n\n"
        "Format: For each day list Breakfast, Mid-Morning Snack, Lunch, "
        "Evening Snack, and Dinner with portion sizes and estimated calories. "
        "End with a weekly grocery list."
    )

    try:
        model = get_watsonx_client()
        prompt = build_prompt(prompt_text, [], profile)
        response = model.generate_text(prompt=prompt)
        return jsonify({
            "meal_plan": response.strip() if isinstance(response, str) else str(response),
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/calorie-analysis", methods=["POST"])
def calorie_analysis():
    """Analyse calories and macros for a described meal or food item."""
    data = request.get_json(silent=True) or {}
    food_description = data.get("food", "").strip()

    if not food_description:
        return jsonify({"error": "Food description required."}), 400

    prompt_text = (
        f"Perform a detailed nutritional analysis for: {food_description}\n\n"
        "Provide:\n"
        "1. Estimated calories (kcal)\n"
        "2. Macronutrients: Protein (g), Carbohydrates (g), Fats (g), Fibre (g)\n"
        "3. Key micronutrients\n"
        "4. Healthiness rating out of 10\n"
        "5. 2-3 healthier alternatives or improvements\n"
        "Be precise with numbers. Format as structured sections."
    )

    try:
        model = get_watsonx_client()
        prompt = build_prompt(prompt_text, [])
        response = model.generate_text(prompt=prompt)
        return jsonify({
            "analysis": response.strip() if isinstance(response, str) else str(response),
            "food": food_description,
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/family-plan", methods=["POST"])
def family_plan():
    """Generate nutrition recommendations for a family with multiple members."""
    data = request.get_json(silent=True) or {}
    members = data.get("members", [])

    if not members:
        return jsonify({"error": "Family members data required."}), 400

    member_text = "\n".join(
        f"- {m.get('name', 'Member')}, Age {m.get('age', '?')}, "
        f"{m.get('gender', 'Unknown')}, Goal: {m.get('goal', 'general health')}, "
        f"Restrictions: {m.get('restrictions', 'none')}"
        for m in members
    )

    prompt_text = (
        f"Create a comprehensive family nutrition plan for the following members:\n"
        f"{member_text}\n\n"
        "Provide:\n"
        "1. Individual calorie targets\n"
        "2. A unified family meal plan that accommodates all members\n"
        "3. Portion adjustment notes per member\n"
        "4. Family-friendly Indian recipes\n"
        "5. Tips for managing different dietary needs in one household"
    )

    try:
        model = get_watsonx_client()
        prompt = build_prompt(prompt_text, [])
        response = model.generate_text(prompt=prompt)
        return jsonify({
            "family_plan": response.strip() if isinstance(response, str) else str(response),
            "member_count": len(members),
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bmi", methods=["POST"])
def bmi_calculator():
    """Calculate BMI, TDEE, and return nutrition guidance."""
    data = request.get_json(silent=True) or {}
    try:
        weight = float(data.get("weight", 0))
        height = float(data.get("height", 0))
        age    = int(data.get("age", 25))
        gender = data.get("gender", "female")
        activity = data.get("activity", "moderate")
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numeric input."}), 400

    bmi_data = calculate_bmi(weight, height)
    if "error" in bmi_data:
        return jsonify(bmi_data), 400

    tdee_data = calculate_tdee(weight, height, age, gender, activity)

    return jsonify({**bmi_data, **tdee_data})


@app.route("/api/quick-suggestions", methods=["GET"])
def quick_suggestions():
    """Return pre-defined quick chat suggestion prompts."""
    suggestions = [
        "🥗 Create a 7-day vegetarian meal plan for weight loss",
        "🍛 Suggest healthy Indian breakfast options under 300 calories",
        "💪 What should I eat before and after my workout?",
        "🧒 Create a nutrition plan for my 8-year-old child",
        "🩺 I have diabetes — suggest a low-glycaemic meal plan",
        "🛒 Generate a weekly grocery list for a family of 4",
        "⚡ What are the best foods for boosting energy?",
        "🌙 What are healthy late-night snack options?",
    ]
    return jsonify({"suggestions": suggestions})


@app.route("/api/health")
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "agent": AGENT_INSTRUCTIONS["name"],
        "model": "ibm/granite-3-8b-instruct",
        "timestamp": datetime.now().isoformat(),
    })


# ── Entry Point ───────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    print(f"\n🚀  {AGENT_INSTRUCTIONS['name']} is running on http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
