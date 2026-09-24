import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export const TARGET = Object.freeze({
  repository: "ko-indra/gastro-intranet",
  repositoryId: "1318600841",
  ref: "refs/heads/main",
  projectId: "prj_SjMFkNE16O7xLBLqzk9fdkuOOnja",
  orgId: "team_GZpREty7f75EZvvqrPwVMp0r",
  name: "gastro-intranet",
  alias: "gastro-intranet.vercel.app",
});

const STATES = new Set(["BLOCKED", "BUILDING", "CANCELED", "ERROR", "INITIALIZING", "QUEUED", "READY"]);
const TERMINAL_FAILURES = new Set(["BLOCKED", "CANCELED", "ERROR"]);
const POLL_MS = 15_000;
const DEADLINE_MS = 15 * 60_000;

export class DeploymentError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new DeploymentError(message);
}

export function readConfiguration(env) {
  for (const [key, expected] of [
    ["GITHUB_REPOSITORY", TARGET.repository],
    ["GITHUB_REPOSITORY_ID", TARGET.repositoryId],
    ["GITHUB_REF", TARGET.ref],
    ["VERCEL_PROJECT_ID", TARGET.projectId],
    ["VERCEL_ORG_ID", TARGET.orgId],
  ]) {
    requireValue(env[key] === expected, `${key} does not match the approved deployment target.`);
  }
  requireValue(typeof env.GITHUB_SHA === "string" && env.GITHUB_SHA.length === 40 && /^[a-f0-9]{40}$/i.test(env.GITHUB_SHA), "GITHUB_SHA must be a full commit SHA.");
  requireValue(typeof env.VERCEL_TOKEN === "string" && env.VERCEL_TOKEN.length > 0 && !/[\s\x00-\x1f\x7f]/.test(env.VERCEL_TOKEN), "VERCEL_TOKEN is missing or invalid.");
  return Object.freeze({ sha: env.GITHUB_SHA.toLowerCase(), token: env.VERCEL_TOKEN });
}

// See https://openapi.vercel.sh/ POST /v13/deployments and GET deployment/alias schemas.
export function deploymentBody(sha) {
  return {
    name: TARGET.name,
    project: TARGET.projectId,
    target: "production",
    gitSource: { type: "github", repoId: Number(TARGET.repositoryId), ref: sha, sha },
    meta: { githubCommitSha: sha, githubCommitRef: "main" },
  };
}

export function createApi(token, execute = execFileSync) {
  return (method, endpoint, body) => {
    const args = ["api", endpoint, "--method", method, "--raw", "--token", token];
    if (body !== undefined) args.push("--input", "-");
    let result;
    try {
      result = execute("vercel", args, {
        input: body === undefined ? undefined : JSON.stringify(body),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch {
      // CLI errors can include the command (and token), stdout, or provider details.
      throw new DeploymentError("Vercel API request failed. Check scoped access and deployment status before retrying.");
    }
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      throw new DeploymentError("Vercel API returned an invalid response.");
    }
    requireValue(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && !parsed.error, "Vercel API request was not accepted.");
    return parsed;
  };
}

function validateDeployment(deployment, id, sha) {
  requireValue(deployment.id === id, "Deployment identity changed during verification.");
  requireValue(deployment.projectId === TARGET.projectId, "Deployment project does not match the approved target.");
  requireValue(deployment.target === "production", "Deployment is not a production deployment.");
  requireValue(deployment.gitSource?.type === "github" && String(deployment.gitSource.repoId) === TARGET.repositoryId, "Deployment repository does not match the approved source.");
  requireValue(deployment.gitSource.sha === sha, "Deployment commit does not match the verified commit.");
  if (deployment.meta?.githubCommitSha !== undefined) {
    requireValue(deployment.meta.githubCommitSha === sha, "Deployment commit metadata does not match the verified commit.");
  }
  requireValue(STATES.has(deployment.readyState), "Vercel returned an unknown deployment state.");
  requireValue(!TERMINAL_FAILURES.has(deployment.readyState), `Deployment entered ${deployment.readyState}.`);
  requireValue(!deployment.aliasError, "Production alias assignment failed.");
}

export async function deployVerified(env, dependencies = {}) {
  const config = readConfiguration(env);
  const api = dependencies.api ?? createApi(config.token);
  const pause = dependencies.sleep ?? sleep;
  const now = dependencies.now ?? Date.now;
  const log = dependencies.log ?? console.log;
  const startedAt = now();
  const teamQuery = `teamId=${TARGET.orgId}`;

  // Never retry this POST automatically: an uncertain response may already have created a deployment.
  const created = await api("POST", `/v13/deployments?${teamQuery}`, deploymentBody(config.sha));
  requireValue(typeof created.id === "string" && /^dpl_[A-Za-z0-9]+$/.test(created.id), "Vercel did not return a valid deployment identifier.");
  const id = created.id;
  log(`Deployment created: ${id}`);
  let lastStatus;
  while (now() - startedAt < DEADLINE_MS) {
    const deployment = await api("GET", `/v13/deployments/${id}?${teamQuery}&withGitRepoInfo=true`);
    validateDeployment(deployment, id, config.sha);
    const status = deployment.readyState === "READY" && !deployment.aliasAssigned ? "READY (assigning production alias)" : deployment.readyState;
    if (status !== lastStatus) {
      log(`Deployment status: ${status}`);
      lastStatus = status;
    }
    if (deployment.readyState === "READY" && deployment.aliasAssigned === true && Array.isArray(deployment.alias) && deployment.alias.includes(TARGET.alias)) {
      const alias = await api("GET", `/v4/aliases/${TARGET.alias}?${teamQuery}&projectId=${TARGET.projectId}`);
      requireValue(alias.alias === TARGET.alias && alias.projectId === TARGET.projectId, "Production alias does not match the approved target.");
      const aliasDeploymentId = alias.deploymentId ?? alias.deployment?.id;
      if (aliasDeploymentId === id && (!alias.deployment?.id || alias.deployment.id === id)) {
        const url = `https://${TARGET.alias}`;
        log(`Production verified: ${url}`);
        return { id, url };
      }
      // Allow brief propagation while the canonical alias still points at the previous deployment.
    }
    await pause(Math.min(POLL_MS, Math.max(0, DEADLINE_MS - (now() - startedAt))));
  }
  throw new DeploymentError("Deployment verification timed out. Check the existing deployment before retrying.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  deployVerified(process.env).catch((error) => {
    console.error(error instanceof DeploymentError ? error.message : "Deployment verification failed.");
    process.exitCode = 1;
  });
}
