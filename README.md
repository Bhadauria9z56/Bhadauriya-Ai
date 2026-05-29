# 🤖 Bhadauriya AI Chatbot

Professional AI Chatbot powered by Google Gemini — Railway par deployed.

---

## 🚀 Railway Par Deploy Kaise Karein (Step-by-Step)

### Step 1: GitHub Par Upload Karo

```bash
# Project folder mein jao
cd bhadauriya-ai

# Git initialize karo
git init
git add .
git commit -m "Initial commit - Bhadauriya AI"
```

**GitHub par:**
1. github.com par jao → New Repository banao
2. Name do: `bhadauriya-ai`
3. Public rakho
4. Create Repository click karo
5. Phir ye commands run karo:

```bash
git remote add origin https://github.com/YOUR_USERNAME/bhadauriya-ai.git
git branch -M main
git push -u origin main
```

---

### Step 2: Railway Account

1. **railway.app** par jao
2. GitHub se Login karo
3. **New Project** → **Deploy from GitHub repo**
4. Apna `bhadauriya-ai` repo select karo
5. Railway automatically deploy karna shuru kar dega ✅

---

### Step 3: Environment Variables Set Karo (ZAROORI!)

Railway dashboard mein:
1. Apna project open karo
2. **Variables** tab par jao
3. Ye variables add karo:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Apni Gemini API key (notepad se) |
| `BOT_NAME` | Bhadauriya AI |
| `SYSTEM_PROMPT` | You are Bhadauriya AI, a helpful assistant. Respond in the same language the user writes in. |

4. **Save** karo — Railway automatically redeploy karega

---

### Step 4: Live URL Lo

- Railway dashboard mein **Settings** → **Domains**
- Generate Domain click karo
- Aapko milega: `bhadauriya-ai-xyz.railway.app`
- Bas! Chatbot live hai 🎉

---

## 💻 Local Testing (Pehle Test Karo)

```bash
# Dependencies install karo
npm install

# .env file banao
cp .env.example .env
# .env mein apni GEMINI_API_KEY daalo

# Server start karo
npm start

# Browser mein kholo:
# http://localhost:3000
```

---

## 📁 Project Structure

```
bhadauriya-ai/
├── src/
│   └── server.js        # Main backend server
├── public/
│   └── index.html       # Frontend UI
├── .env.example         # Environment variables template
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies
├── railway.json         # Railway config
└── README.md            # Yeh file
```

---

## 🔑 Gemini API Key Kahan Se Milegi?

1. **aistudio.google.com** par jao
2. **Get API Key** → **Create API Key**
3. Copy karo aur `.env` mein daalo

---

## ❓ Troubleshooting

**"GEMINI_API_KEY set nahi hai" error?**
→ Railway Variables mein API key check karo

**Railway deploy fail ho raha hai?**
→ Logs tab mein error dekho

**Local mein kaam kar raha hai, Railway mein nahi?**
→ Environment variables dobara check karo

---

*Made with ❤️ — Bhadauriya AI*
