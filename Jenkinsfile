pipeline {
  agent {
        kubernetes {
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: maven
    image: maven:3.9.2-eclipse-temurin-17
    command:
    - cat
    tty: true
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
  - name: buildah
    image: quay.io/buildah/stable:latest
    command:
    - cat
    tty: true
    securityContext:
      privileged: true
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
    - mountPath: /var/lib/containers
      name: container-storage
    - mountPath: /tmp
      name: tmp-volume
  - name: jnlp
    image: jenkins/inbound-agent:latest
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
  volumes:
  - name: workspace-volume
    emptyDir: {}
  - name: container-storage
    emptyDir: {}
  - name: tmp-volume
    emptyDir: {}
"""
        }
    }

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
    skipDefaultCheckout()  // Skip automatic checkout
  }

  stages {
    stage('Checkout') {
      steps {
        script {
          // Đảm bảo workspace là git repository và có thể fetch
          sh '''
            echo "Current directory: $(pwd)"
            echo "Contents: $(ls -la)"
            
            # Xóa workspace cũ nếu có vấn đề
            if [ -d .git ] && ! git status >/dev/null 2>&1; then
              echo "Corrupted git repository detected, removing..."
              rm -rf .git
            fi
            
            # Khởi tạo git repository nếu cần
            if [ ! -d .git ]; then
              echo "Initializing fresh git repository..."
              git init
              git config --global --add safe.directory /var/jenkins_home/workspace/jenkins-demo-pipeline
              git remote add origin https://github.com/hantdev/jenkins-demo.git
            fi
            
            # Fetch và checkout code
            echo "Fetching from remote repository..."
            git fetch origin main
            git checkout -f main
            git reset --hard origin/main
            
            echo "Git status after checkout:"
            git status
            echo "Current branch: $(git branch --show-current)"
          '''
        }
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
        container('buildah') {
          sh '''
          # Set buildah format
          export BUILDAH_FORMAT=docker
          export STORAGE_DRIVER=vfs
          
          # Change to workspace directory
          cd /home/jenkins/agent
          
          echo "Current directory: $(pwd)"
          echo "Contents: $(ls -la)"
          
          echo "Building image..."
          buildah bud --format=docker -t ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} -f Dockerfile .
          
          echo "Logging into registry..."
          buildah login -u ${REGISTRY_CREDS_USR} -p ${REGISTRY_CREDS_PSW} ${REGISTRY_URL}
          
          echo "Pushing image..."
          buildah push ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}
          
          echo "Tagging latest..."
          buildah tag ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY_URL}/${IMAGE_NAME}:latest
          buildah push ${REGISTRY_URL}/${IMAGE_NAME}:latest
          
          echo "Logging out..."
          buildah logout ${REGISTRY_URL}
          '''
        }
      }
    }
  }

  post {
        always {
            echo "Pipeline finished"
        }
  }
}


