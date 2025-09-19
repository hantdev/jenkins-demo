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
          SCANNER_URL="https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SCANNER_VERSION}-linux.zip"
          
          # Download with retry and verification
          for i in {1..3}; do
            echo "Download attempt $i..."
            if curl -fsSLo scanner.zip "$SCANNER_URL"; then
              echo "Download successful"
              break
            else
              echo "Download failed, retrying..."
              rm -f scanner.zip
              sleep 2
            fi
          done
          
          # Verify download size (should be > 1MB)
          if [ ! -f scanner.zip ] || [ $(stat -c%s scanner.zip) -lt 1000000 ]; then
            echo "ERROR: Scanner download failed or file too small"
            exit 1
          fi
          
          # Extract with force overwrite
          unzip -o scanner.zip
          export PATH="$PWD/sonar-scanner-${SCANNER_VERSION}-linux/bin:$PATH"
          
          # Verify installation
          if ! sonar-scanner --version; then
            echo "ERROR: SonarQube Scanner installation failed"
            exit 1
          fi
        fi
        
        sonar-scanner \
          -Dsonar.host.url=http://10.10.2.200:30090 \
          -Dsonar.login=${SONAR_TOKEN} \
          -Dproject.settings=sonar-project.properties
        '''
      }
    }

    stage('Build & Push Image') {
      steps {
        sh '''
        # Install podman if not available
        if ! command -v podman >/dev/null 2>&1; then
          echo "Installing podman..."
          sudo apt-get update
          sudo apt-get install -y podman
        fi
        
        # Build container image using podman
        echo "Building container image: ${IMAGE_NAME}:${IMAGE_TAG}"
        podman build -t ${IMAGE_NAME}:${IMAGE_TAG} .
        
        # Tag image for Nexus Docker registry
        podman tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}
        podman tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY_URL}/${IMAGE_NAME}:latest
        
        # Login to Nexus Docker registry
        echo "Logging into Nexus Docker registry..."
        echo "${REGISTRY_CREDS_PSW}" | podman login ${REGISTRY_URL} -u ${REGISTRY_CREDS_USR} --password-stdin
        
        # Push image to Nexus Docker registry
        echo "Pushing image to Nexus Docker registry..."
        podman push ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}
        podman push ${REGISTRY_URL}/${IMAGE_NAME}:latest
        
        # Logout from registry
        podman logout ${REGISTRY_URL}
        
        echo "Image built and pushed successfully:"
        echo "  - ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}"
        echo "  - ${REGISTRY_URL}/${IMAGE_NAME}:latest"
        '''
      }
    }
  }
}


