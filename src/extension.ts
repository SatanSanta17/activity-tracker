import * as vscode from "vscode";
import axios from "axios";
import * as fs from "fs";

let changesBuffer: { filePath: string; content: string; action: string }[] = [];
let commitInterval: NodeJS.Timeout | null = null;

export async function activate(context: vscode.ExtensionContext) {
	console.log("Activating Activity Tracker extension...");

	const config = vscode.workspace.getConfiguration();
	let repoUrl = config.get<string>("commonGitHubRepo", "");
	let githubToken = config.get<string>("githubPersonalAccessToken", "");

	// Prompt the user for GitHub repo and PAT if not already set
	if (!repoUrl || !githubToken) {
		vscode.window.showInformationMessage(
			"Welcome! Let's set up your GitHub integration."
		);

		if (!repoUrl) {
			const inputRepoUrl = await vscode.window.showInputBox({
				prompt:
					"Enter the GitHub repository URL (e.g., https://github.com/user/repo.git):",
				placeHolder: "GitHub Repository URL",
				validateInput: (input) =>
					input ? undefined : "Repository URL cannot be empty.",
			});
			if (inputRepoUrl) {
				repoUrl = inputRepoUrl;
				console.log(`GitHub Repo URL set to: ${repoUrl}`);
			}
		}

		if (!githubToken) {
			const inputGithubToken = await vscode.window.showInputBox({
				prompt: "Enter your GitHub Personal Access Token (PAT):",
				placeHolder: "GitHub Personal Access Token",
				password: true,
				validateInput: (input) =>
					input ? undefined : "Access Token cannot be empty.",
			});
			if (inputGithubToken) {
				githubToken = inputGithubToken;
				console.log("GitHub Personal Access Token provided.");
			}
		}

		if (repoUrl && githubToken) {
			// Save the configuration for future use
			config.update(
				"commonGitHubRepo",
				repoUrl,
				vscode.ConfigurationTarget.Global
			);
			config.update(
				"githubPersonalAccessToken",
				githubToken,
				vscode.ConfigurationTarget.Global
			);
			vscode.window.showInformationMessage("GitHub setup complete!");
		} else {
			vscode.window.showErrorMessage(
				"GitHub setup is incomplete. Please provide both repo URL and PAT."
			);
			return;
		}
	}

	const interval = config.get<number>("autoCommitInterval", 30) * 60 * 1000; // Default to 30 minutes
	console.log(`Auto-commit interval set to: ${interval / 1000} seconds.`);

	// Start the commit interval
	commitInterval = setInterval(() => {
		if (changesBuffer.length > 0) {
			console.log("Initiating commit and push for buffered changes...");
			commitAndPushChanges(repoUrl, githubToken);
		}
	}, interval);
	// File system watcher to track changes only when the file is saved
	const fileWatcher = vscode.workspace.createFileSystemWatcher("/*");
	fileWatcher.onDidCreate((uri) => trackChange("added", uri.fsPath));
	fileWatcher.onDidDelete((uri) => trackChange("deleted", uri.fsPath));

	let previousContent: string | null = null;

	vscode.workspace.onDidSaveTextDocument((document) => {
		const filePath = document.uri.fsPath;
		const newContent = document.getText(); // Get the content of the file after saving

		// If there was no previous content stored (first time saving), initialize it
		if (previousContent === null) {
			previousContent = newContent;
			return; // Skip the comparison for the first save
		}

		// Compare old and new content line by line
		const oldLines = previousContent.split("\n");
		const newLines = newContent.split("\n");

		for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
			if (oldLines[i] !== newLines[i]) {
				const startLine = i + 1; // 1-based line index
				const changedText = newLines[i] || ""; // Text of the changed line (empty if deleted)
				trackChange(`Modified line ${startLine}`, filePath, changedText);
			}
		}

		// Store the new content as the previous content for the next save
		previousContent = newContent;
	});

	context.subscriptions.push(fileWatcher);
	console.log("Activity Tracker extension activated.");
}

function trackChange(action: string, filePath: string, content?: string) {
	console.log(`Tracking change - Action: ${action}, File: ${filePath}`);
	if (content) {
		changesBuffer.push({ filePath, content, action });
	} else {
		// If no content is provided, read the file content from disk (for deletes)
		const fileContent = fs.existsSync(filePath)
			? fs.readFileSync(filePath, "utf-8")
			: "";
		changesBuffer.push({ filePath, content: fileContent, action });
	}
}

async function commitAndPushChanges(repoUrl: string, githubToken: string) {
	const [owner, repo] = extractOwnerAndRepo(repoUrl);
	console.log(`Committing and pushing changes to ${owner}/${repo}...`);
	if (!owner || !repo) {
		vscode.window.showErrorMessage("Invalid GitHub repository URL.");
		return;
	}

	// Combine all buffered changes into a single log entry
	const logEntry = generateLogEntry(changesBuffer);

	try {
		// Fetch the current SHA of the `logs` file (if it exists)
		const filePath = "logs.txt"; // Always use the same file for logs
		const fileSha = await getFileSha(owner, repo, filePath, githubToken);
		const existingContent = fileSha
			? await fetchFileContent(owner, repo, filePath, githubToken)
			: ""; // Fetch current logs if the file exists

		// Append the new log entry to existing content
		const updatedContent = existingContent + "\n" + logEntry;

		// Push the updated content to GitHub
		uploadLogs(owner, repo, updatedContent, githubToken);
		console.log("Logs updated successfully.");
	} catch (error) {
		vscode.window.showErrorMessage("Error updating logs file.");
		console.error(error);
	} finally {
		changesBuffer = []; // Clear the buffer after successful commit
	}
}

function generateLogEntry(
	changes: { filePath: string; content: string; action: string }[]
): string {
	const timestamp = new Date().toISOString();
	let logEntry = `\n--- Log Entry at ${timestamp} ---\n`;
	for (const change of changes) {
		logEntry += `Action: ${change.action}, File: ${change.filePath}, Content: ${change.content}\n`;
	}
	return logEntry;
}

async function fetchFileContent(
	owner: string,
	repo: string,
	filePath: string,
	token: string
): Promise<string> {
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
	const headers = {
		Authorization: `Bearer ${token}`,
	};

	try {
		const response = await axios.get(url, { headers });
		const contentBase64 = response.data.content;
		return Buffer.from(contentBase64, "base64").toString("utf-8");
	} catch (error) {
		if (
			axios.isAxiosError(error) &&
			error.response &&
			error.response.status === 404
		) {
			return ""; // File does not exist
		}
		throw error;
	}
}

async function uploadLogs(
	owner: string,
	repo: string,
	content: string,
	token: string
) {
	const filePath = "logs.txt"; // Always use the same file for logs
	const fileSha = await getFileSha(owner, repo, filePath, token);

	const base64Content = Buffer.from(content).toString("base64");

	const data = {
		message: fileSha ? `Appending to logs` : `Creating logs file`,
		content: base64Content,
		...(fileSha ? { sha: fileSha } : {}),
	};

	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
	const headers = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};

	console.log(`Sending request to GitHub API: ${url}`);
	console.log(`Request data:`, data);

	try {
		const response = await axios.put(url, data, { headers });
		console.log(`Logs file updated successfully. Status: ${response.status}`);
	} catch (error) {
		console.error(
			`Failed to upload or append to logs file: ${filePath}`,
			axios.isAxiosError(error) && error.response
				? error.response.data
				: (error as Error).message
		);
		throw error;
	}
}

async function getFileSha(
	owner: string,
	repo: string,
	filePath: string,
	token: string
): Promise<string | null> {
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
	const headers = {
		Authorization: `Bearer ${token}`,
	};

	try {
		const response = await axios.get(url, { headers });
		console.log(`File exists: ${filePath}, SHA: ${response.data.sha}`);
		return response.data.sha;
	} catch (error) {
		if (
			axios.isAxiosError(error) &&
			error.response &&
			error.response.status === 404
		) {
			console.log(`File not found: ${filePath}`);
			return null; // File does not exist
		}
		console.error(`Error fetching file SHA for ${filePath}`, error);
		throw error;
	}
}

function extractOwnerAndRepo(repoUrl: string): [string, string] {
	const match = repoUrl.match(/github\.com[/:](.+?)\/(.+?)(\.git)?$/);
	return match ? [match[1], match[2]] : ["", ""];
}

export function deactivate() {
	if (commitInterval) {
		console.log("Clearing commit interval.");
		clearInterval(commitInterval);
	}
}
