


# 📦 WhatsApp Holiday Bot

A smart and automated WhatsApp bot that sends personalized greeting messages for holidays, birthdays, and other scheduled events — so you don’t have to.

## ✨ Features

- 📅 Schedule messages to be sent automatically on specific dates
- 🤖 Use AI (OpenAI API) to generate personalized greeting texts
- 💬 Accept natural language commands like:
  > "Send mom a birthday greeting tomorrow"
- 📁 Manage contacts and templates easily
- 📊 Log message status, delivery time, and responses

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Dandona100/whatsapp-holiday-bot.git
cd whatsapp-holiday-bot

2. Install dependencies

npm install

Note: Make sure to exclude the node_modules folder from version control using .gitignore.

⸻

🔐 Environment Setup

Create a .env file in the root directory with the following keys:

OPENAI_API_KEY=your_openai_api_key
MONGODB_URI=your_mongo_connection_string
PORT=3000



⸻

🛠️ Requirements
	•	Node.js (v16+)
	•	npm
	•	MongoDB (local or cloud, e.g. MongoDB Atlas)
	•	OpenAI API key (https://platform.openai.com)

⸻

💡 How to Use

Run the bot locally:

npm start

Example natural command:

# Send a message to David on May 5th at 9:00 AM
"Remind David about the party on May 5 at 9 AM"

Manage through the web interface:

Visit http://localhost:3000 or your deployed domain.

⸻

🤖 Using OpenAI for Smart Replies

The bot uses OpenAI to generate creative and friendly greetings based on contact name, event type, and user tone.

⸻

📂 Project Structure

.
├── public/               # Frontend (HTML, JS, CSS)
├── services/             # WhatsApp & AI integration
├── models/               # MongoDB Schemas
├── routes/               # Express Routes
├── helpers/              # Utilities & logger
├── .env                  # Environment variables
├── app.js                # Main server file
└── README.md



⸻

📬 Coming Soon
	•	Voice message support
	•	Admin dashboard with analytics
	•	WhatsApp group greetings
	•	Message templates editor

⸻

🧑‍💻 Author

Created by Danny
Feel free to open issues or contribute 💙

---

