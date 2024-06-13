const { Octokit } = require("@octokit/rest");
const axios = require('axios');
require('dotenv').config()

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const octokit = new Octokit({
    auth: GITHUB_TOKEN,
});

const mainRepoOwner = 'spiks';
const mainRepoName = 'selfschool-generations-dialogue-front';

async function getLatestRelease() {
    const releases = await octokit.repos.listReleases({
        owner: mainRepoOwner,
        repo: mainRepoName,
        per_page: 1,
        page: 1,
    });
    return releases.data[0].tag_name;
}

function incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1]++;
    return parts.join('.');
}

async function createRelease(tagName, releaseName, releaseDescription) {
    const release = await octokit.repos.createRelease({
        owner: mainRepoOwner,
        repo: mainRepoName,
        tag_name: tagName,
        name: releaseName,
        body: releaseDescription,
    });
    return release.data;
}

async function waitForActionCompletion(repoOwner, repoName, workflowRunId) {
    const checkInterval = 10000; // Check every 10 seconds
    let status = '';
    while (status !== 'completed') {
        const response = await octokit.actions.getWorkflowRun({
            owner: repoOwner,
            repo: repoName,
            run_id: workflowRunId,
        });
        status = response.data.status;
        if (status === 'completed') {
            if (response.data.conclusion === 'success') {
                console.log('success');
            } else {
                console.log('Action failed:', response.data.conclusion);
            }
            break;
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
}

async function run() {
    try {
        const latestReleaseTag = await getLatestRelease();
        const newReleaseTag = incrementVersion(latestReleaseTag);
        const releaseDescription = `
# Release ${newReleaseTag}

Это Андрей релиз проверяет:

- Проверка 1
- Проверка 2
`;
        const release = await createRelease(newReleaseTag, newReleaseTag, releaseDescription);
        console.log(`Created release with ID: ${release.id}`);

        await new Promise(resolve => setTimeout(resolve, 10000));

        const response = await octokit.actions.listWorkflowRunsForRepo({
            owner: mainRepoOwner,
            repo: mainRepoName,
            per_page: 1,
            page: 1,
            event: 'release',
        });

        if (response.data.workflow_runs.length === 0) {
            console.log('No workflow run found for the release');
            return;
        }

        const workflowRunId = response.data.workflow_runs[0].id;
        await waitForActionCompletion(mainRepoOwner, mainRepoName, workflowRunId);
    } catch (error) {
        console.error(error);
    }
}

run();
