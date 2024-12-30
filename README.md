# Activity Tracker for VS Code

**Activity Tracker** is a Visual Studio Code extension designed to track file changes and log them in a GitHub repository. It helps developers maintain a chronological record of their development journey by committing changes only when a file is saved.

## Features

- Tracks file changes (add, modify, delete) and logs them with relevant details.
- Logs changes to a centralized GitHub repository.
- Configurable auto-commit interval (default: 30 minutes).
- Supports tracking changes only upon saving files.
- Prompts the user to set up GitHub credentials (repository URL and personal access token) on first activation.
- Appends changes to a single `logs.txt` file in the repository.

## Requirements

Before using this extension, ensure the following:

- A GitHub repository to store the logs.
- A GitHub Personal Access Token (PAT) with `repo` permissions.
- Visual Studio Code installed on your system.

## Installation

1. Clone this repository or download the source code.
2. Open the project folder in Visual Studio Code.
3. Run the `npm install` command in the terminal to install dependencies.
4. Package the extension using `vsce package` (requires the [VSCE CLI](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)).
5. Install the `.vsix` package in VS Code by navigating to:
   - `Extensions` > `Install from VSIX...`

## Configuration

1. On first activation, the extension will prompt you to provide:
   - GitHub Repository URL (e.g., `https://github.com/username/repository.git`)
   - GitHub Personal Access Token (PAT)
2. The provided credentials are saved in the VS Code global settings for future use.

## Usage

- **Track Changes:** The extension listens for file changes in the workspace.
  - Adds tracked changes to a buffer when files are saved.
  - Commits and pushes the changes to the GitHub repository at the configured interval.
- **Modify Commit Interval:** Update the commit interval by changing the `autoCommitInterval` setting in your VS Code configuration (value in minutes).

### Example Configuration

```json
{
	"commonGitHubRepo": "https://github.com/username/repository.git",
	"githubPersonalAccessToken": "your-personal-access-token",
	"autoCommitInterval": 30
}
```

## How It Works

1. **File Change Tracking:**

   - Tracks added, modified, and deleted files.
   - Logs only the lines modified during the save event.

2. **GitHub Integration:**

   - Appends changes to `logs.txt` in the remote repository.
   - Uses GitHub's API to fetch the file’s `sha` for updates.

3. **Commit and Push:**
   - At the end of each interval, pushes the accumulated changes to the GitHub repository.

## Developer Guide

### Important Files

- **`extension.ts`**: The core logic of the extension.
- **`package.json`**: Contains metadata and configurations for the extension.
- **`README.md`**: Documentation file.

### Commands for Development

- Run the extension in debug mode:
  ```bash
  npm run watch
  ```
- Test the extension in a new VS Code instance:
  ```bash
  F5 (Debug in VS Code)
  ```

## Contribution

Contributions are welcome! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch (`feature/your-feature`).
3. Commit your changes.
4. Push to the branch.
5. Open a pull request.

## Contact

If you encounter any issues or have suggestions for improvement, feel free to create an issue or reach out at burhanuddinchital25151@gmail.com.
