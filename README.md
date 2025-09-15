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
```

## Prerequisites

- Jenkins with Docker available on the agent (DinD or host Docker)
- Kubernetes cluster reachable from your workstation and Jenkins
- Optional: Ingress Controller if you plan to expose SonarQube/Nexus externally