[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex CLI is required."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required by the Ponytail lifecycle hooks."
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required by the Codex Skill Installer."
}

$codexHome = if ($env:CODEX_HOME) {
    $env:CODEX_HOME
} else {
    Join-Path $HOME ".codex"
}

$skillInstaller = Join-Path $codexHome "skills\.system\skill-installer\scripts\install-skill-from-github.py"
if (-not (Test-Path -LiteralPath $skillInstaller)) {
    throw "Codex Skill Installer not found: $skillInstaller"
}

$plugins = @(
    @{
        Source = "Squirbie/im-not-ai-codex"
        Ref = "028957ddbfe51c70b573d1fa37f8ab5c28e34866"
        Id = "im-not-ai-codex@im-not-ai-codex-marketplace"
    },
    @{
        Source = "yibie/caveman-codex"
        Ref = "542c12f47697c621473bbd5c33c0f7c2c2baa29f"
        Id = "caveman@caveman-repo"
    },
    @{
        Source = "DietrichGebert/ponytail"
        Ref = "2ed6c52c9d7e5e56942508591085fd45dea277d3"
        Id = "ponytail@ponytail"
    }
)

$skills = @(
    @{
        Repo = "vercel-labs/agent-skills"
        Ref = "063bee94c3f4df8453406c830b0a7df0f2860278"
        Path = "skills/react-best-practices"
        Name = "react-best-practices"
    },
    @{
        Repo = "vercel-labs/agent-skills"
        Ref = "063bee94c3f4df8453406c830b0a7df0f2860278"
        Path = "skills/web-design-guidelines"
        Name = "web-design-guidelines"
    },
    @{
        Repo = "microsoft/playwright-cli"
        Ref = "397ee39c83a651e1314cfb010b94e8a3aac11261"
        Path = "skills/playwright-cli"
        Name = "playwright-cli"
    }
)

$curatedPlugins = @(
    "superpowers@openai-curated",
    "codex-security@openai-curated"
)

foreach ($plugin in $plugins) {
    Write-Host "Adding marketplace: $($plugin.Source)"
    & codex plugin marketplace add $plugin.Source --ref $plugin.Ref --json
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to add marketplace: $($plugin.Source)"
    }

    Write-Host "Installing plugin: $($plugin.Id)"
    & codex plugin add $plugin.Id --json
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install plugin: $($plugin.Id)"
    }
}

foreach ($pluginId in $curatedPlugins) {
    Write-Host "Installing plugin: $pluginId"
    & codex plugin add $pluginId --json
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install plugin: $pluginId"
    }
}

foreach ($skill in $skills) {
    $destination = Join-Path $codexHome "skills\$($skill.Name)"
    if (Test-Path -LiteralPath $destination) {
        Write-Host "Skill already installed: $($skill.Name)"
        continue
    }

    Write-Host "Installing skill: $($skill.Name)"
    & python $skillInstaller --repo $skill.Repo --ref $skill.Ref --path $skill.Path
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install skill: $($skill.Name)"
    }
}

if (-not (Get-Command playwright-cli -ErrorAction SilentlyContinue)) {
    Write-Host "Installing command: @playwright/cli@0.1.19"
    & npm install -g "@playwright/cli@0.1.19"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install command: @playwright/cli@0.1.19"
    }
}

Write-Host "Harness installed. Restart Codex, review Ponytail hooks with /hooks, then start a new thread."
