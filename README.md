# Jenkins Demo: CI/CD with Gitleaks, SonarQube, and Nexus

This project provides a minimal Node.js service and a Jenkins pipeline that runs:

- Checkout, Gitleaks secret scan, ESLint, Jest tests
- SonarQube analysis
- Docker build and push to Nexus Repository

You mentioned Jenkins is already deployed on Kubernetes per the guide [How To Install Jenkins on Kubernetes](https://www.digitalocean.com/community/tutorials/how-to-install-jenkins-on-kubernetes). We build on top of that.

## Project structure

```
src/                # Express app
test/               # Jest tests
Dockerfile          # App container
Jenkinsfile         # CI/CD pipeline
.gitleaks.toml      # Gitleaks config
sonar-project.properties
k8s/sonarqube/      # SonarQube manifests
k8s/nexus/          # Nexus manifests
```

## Prerequisites

- Jenkins with Docker available on the agent (DinD or host Docker)
- Kubernetes cluster reachable from your workstation and Jenkins
- Optional: Ingress Controller if you plan to expose SonarQube/Nexus externally

## Setup steps

### 1) Deploy SonarQube (Kubernetes)

```
kubectl apply -f k8s/sonarqube/sonarqube.yaml
kubectl -n sonarqube port-forward svc/sonarqube 9000:9000
```

Access: http://localhost:9000 (default admin/admin, then change password). Create a token and save it.

In Jenkins: Manage Jenkins → Credentials → Add:

- Secret text: ID `sonarqube-token`, Secret: <your token>
- Configure SonarQube server named `sonarqube-server` in Manage Jenkins → System.

### 2) Deploy Nexus Repository (Kubernetes)

```
kubectl apply -f k8s/nexus/nexus.yaml
kubectl -n nexus port-forward svc/nexus 8081:8081 5000:5000
```

Access: http://localhost:8081 (default admin with initial password in `/nexus-data/admin.password`).

Steps in Nexus UI:

- Create a Docker (hosted) repository listening on port 5000 (e.g., name `docker-hosted`).
- Optional: disable anonymous or create a dedicated `jenkins` user with `docker-hosted` push perms.

In Jenkins: Manage Jenkins → Credentials → Add:

- Username/Password: ID `nexus-docker-creds`, use your Nexus creds
- Secret text or String: ID `nexus-registry-url`, value like `localhost:5000` (or your ClusterIP/Ingress)

### 3) Configure Jenkins pipeline

- Create a Multibranch Pipeline or Pipeline job pointing to this repo.
- Ensure the agent has Docker and can run `curl`, `unzip` (for tools installation inline).

Stages in `Jenkinsfile`:

- Gitleaks scan (installs binary if missing, uses `.gitleaks.toml`)
- Install dev deps (`npm ci`), Lint & Test
- SonarQube scan via `withSonarQubeEnv('sonarqube-server')`
- Docker build and push to `${REGISTRY_URL}` with `nexus-docker-creds`

### 4) Build and push image

On a successful run, images will be pushed as:

- `${REGISTRY_URL}/jenkins-demo-app:${BUILD_NUMBER}`
- `${REGISTRY_URL}/jenkins-demo-app:latest`

## Local development

```
npm ci
npm run lint
npm test
npm start
```

## References

- DigitalOcean guide used for Jenkins on K8s: [How To Install Jenkins on Kubernetes](https://www.digitalocean.com/community/tutorials/how-to-install-jenkins-on-kubernetes)
