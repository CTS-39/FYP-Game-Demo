# Code Kingdoms Demo

A browser-based educational 4X strategy game demo built with React and TypeScript.

## Features

- 12x12 colorful strategy map with fog of war and territory ownership
- Human player plus Explorer, Scientist, and Conqueror AI civilizations
- Worker and Explorer robots with visual programming blocks
- MOVE, COLLECT, BUILD, WAIT, REPEAT, and unlockable IF / ELSE logic
- Resources, research, buildings, scoring, and multiple victory paths
- Main menu, tutorial mode, round feedback, AI reasoning, and results screen
- Multiplayer-ready local architecture via a local network manager abstraction

## Prerequisites

Before running the game, make sure your machine has:

- Node.js LTS installed
- npm available from your terminal
- A local terminal such as PowerShell, Command Prompt, or VS Code terminal

### Install Node.js (Windows)

If Node is not already installed, install the LTS version:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

Then close and reopen your terminal so the PATH updates are applied.

If `node` or `npm` is still not recognized after installation, add Node to your PATH manually:

```powershell
$env:Path += ';C:\Program Files\nodejs'
```

You can verify the installation with:

```powershell
node -v
npm -v
```

## Run the game locally

1. Open a terminal in the project folder.
2. Install dependencies:

```powershell
cd "C:\path\to\FYP-Game-Demo"
npm install
```

3. Start the local development server:

```powershell
npm run dev -- --host 0.0.0.0 --port 4173
```

4. Open the game in your browser:

```text
http://localhost:4173/
```

The Vite dev server will keep running until you stop it. Press `Ctrl + C` in the terminal to stop the game.

## Production build

To create a production build for deployment or validation:

```powershell
npm run build
```

This compiles the TypeScript app and bundles the project for production output in the `dist/` folder.

## Validation checks

Run the project checks:

```powershell
npm test
npm run lint
npm run build
```

## Troubleshooting

### `node` is not recognized

This usually means Node is not installed or its install folder is not on your PATH.

Check whether Node exists here:

```powershell
Get-ChildItem "C:\Program Files\nodejs"
```

If it exists, add it to PATH for the current terminal:

```powershell
$env:Path += ';C:\Program Files\nodejs'
```

Then retry the commands above.

### Dependencies not installing

Delete the installed dependency folder and reinstall:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### Port already in use

If port `4173` is already occupied, run Vite on another port:

```powershell
npm run dev -- --host 0.0.0.0 --port 4174
```

Then open the new URL shown in the terminal.

## Project scripts

The main scripts in this project are:

```powershell
npm install
npm run dev
npm run build
npm test
npm run lint
```

These commands are defined in the project package and are the recommended workflow for local development and verification.
