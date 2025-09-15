pipeline {
  agent any

  environment {
    REGISTRY_URL = credentials('nexus-registry-url')
    REGISTRY_CREDS = credentials('nexus-docker-creds')
    IMAGE_NAME = 'jenkins-demo-app'
    IMAGE_TAG = "${env.BUILD_NUMBER}"

    // SonarQube server configured in Jenkins global settings with name 'sonarqube-server'
    // SonarQube token stored as secret text credential id 'sonarqube-token'
    SONARQUBE_ENV = 'sonarqube-server'
    SONAR_TOKEN = credentials('sonarqube-token')
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Gitleaks Scan') {
      steps {
        sh '''
        curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.28.0/gitleaks_8.28.0_linux_x64.tar.gz | tar -xz
        ./gitleaks detect \
          --source . \
          --config .gitleaks.toml \
          --report-format json \
          --report-path gitleaks-report.json
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'gitleaks-report.json', allowEmptyArchive: true
        }
        unsuccessful {
          error 'Gitleaks found issues. Failing the build.'
        }
      }
    }

    stage('Install Dev Deps') {
      steps {
        sh '''
        # Download Node.js binary if not available
        if ! command -v npm >/dev/null 2>&1; then
          NODE_VERSION="20.11.0"
          curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz -o node.tar.gz
          tar -xzf node.tar.gz
          export PATH="$PWD/node-v${NODE_VERSION}-linux-x64/bin:$PATH"
        fi
        npm ci
        '''
      }
    }

    stage('Lint & Test') {
      steps {
        sh '''
        # Use downloaded Node.js for lint and test
        if ! command -v npm >/dev/null 2>&1; then
          NODE_VERSION="20.11.0"
          export PATH="$PWD/node-v${NODE_VERSION}-linux-x64/bin:$PATH"
        fi
        npm run lint
        npm test
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'junit.xml'
          archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
        }
      }
    }

    stage('SonarQube Scan') {
      environment {
        SONAR_SCANNER_OPTS = '-Xmx512m'
      }
      steps {
        sh '''
        if ! command -v sonar-scanner >/dev/null 2>&1; then
          SCANNER_VERSION=5.0.1.3006
          curl -sSLo scanner.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_VERSION}-linux.zip
          unzip -q scanner.zip
          export PATH="$PWD/sonar-scanner-${SCANNER_VERSION}-linux/bin:$PATH"
        fi
        sonar-scanner \
          -Dsonar.host.url=http://sonarqube.sonarqube.svc.cluster.local \
          -Dsonar.login=${SONAR_TOKEN} \
          -Dproject.settings=sonar-project.properties
        '''
      }
    }

    stage('Build & Push Image') {
      steps {
        sh '''
        # Use Kaniko to build and push image (no Docker daemon needed)
        docker run --rm \
          -v "$PWD:/workspace" \
          -v "$HOME/.docker:/kaniko/.docker" \
          gcr.io/kaniko-project/executor:latest \
          --context=/workspace \
          --dockerfile=/workspace/Dockerfile \
          --destination=${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} \
          --destination=${REGISTRY_URL}/${IMAGE_NAME}:latest \
          --insecure \
          --skip-tls-verify
        '''
      }
    }
  }
}


