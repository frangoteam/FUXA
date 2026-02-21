# Contributing to FUXA

Thank you for your interest in contributing to FUXA!

We welcome improvements to both the codebase and the documentation.

---

# 💻 Contributing to the Code

## Requirements

- Node.js 18 LTS (recommended)
- npm

## Setup Development Environment

```bash
git clone https://github.com/<your-username>/FUXA.git
cd FUXA
```

### Backend
```bash
cd server
npm install
npm start
```

### Frontend
```bash
cd client
npm install
npm start
```

### Coding standards
Please ensure you follow the coding standards used through-out the existing code base. Some basic rules include:
- Indent with 4-spaces, no tabs.
- Opening brace on same line as if/for/function and so on, closing brace on its own line.

## 🚫 Do NOT Commit Build Artifacts

Please do NOT include generated or compiled files in Pull Requests.

Specifically:

- Do NOT commit frontend production builds (`/client/dist`)
- Do NOT commit generated Angular build output
- Do NOT commit compiled or temporary files
- Do NOT commit node_modules

Pull Requests must contain only source code and relevant changes.

---

# 📚 Contributing to the Documentation

Documentation source files are located in:

```markdown
/docs
```
The documentation site is built using MkDocs with the Material theme.

## Run Documentation Locally

Install dependencies:

```bash
pip install "mkdocs<2.0"
pip install mkdocs-material
```

Start the local server:

```bash
mkdocs serve
```

Open:
```markdown
http://127.0.0.1:8000/FUXA/
```

# 🔁 Pull Request Workflow
1. Fork the repository
2. Create a branch (git checkout -b feature/my-feature)
3. Make your changes
4. Commit clearly (git commit -m "Improve documentation for X")
5. Push your branch
6. Open a Pull Request

For major changes, please open an issue first to discuss the proposal.

---

# ✍ Writing Guidelines (Documentation)
- Use clear and technical language
- Keep sections well structured
- Use relative paths for images (e.g. images/example.png)
- Avoid linking to old Wiki pages

After approval, documentation changes are automatically deployed via GitHub Actions.