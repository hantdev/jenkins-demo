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
  - name: sonar-scanner
    image: sonarsource/sonar-scanner-cli:latest
    command:
    - cat
    tty: true
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
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
        container('sonar-scanner') {
          sh '''
          # Change to workspace directory
          cd /home/jenkins/agent/workspace/jenkins-demo-pipeline
          
          echo "Current directory: $(pwd)"
          echo "Contents: $(ls -la)"
          
          # Check if sonar-project.properties exists
          if [ -f sonar-project.properties ]; then
            echo "Found sonar-project.properties:"
            cat sonar-project.properties
          else
            echo "sonar-project.properties not found, creating one..."
            cat > sonar-project.properties << EOF
sonar.projectKey=jenkins-demo-app
sonar.projectName=jenkins-demo-app
sonar.projectVersion=1.0
sonar.sources=src
sonar.tests=test
sonar.language=js
sonar.sourceEncoding=UTF-8
sonar.javascript.lcov.reportPaths=coverage/lcov.info
EOF
          fi
          
          # Check if test directory exists, if not remove from config
          if [ ! -d test ]; then
            echo "Test directory not found, updating sonar-project.properties..."
            sed -i '/sonar.tests/d' sonar-project.properties
            echo "Updated sonar-project.properties:"
            cat sonar-project.properties
          fi
          
          # Run sonar-scanner
          sonar-scanner \
            -Dsonar.host.url=http://10.10.2.200:30090 \
            -Dsonar.token=${SONAR_TOKEN} \
            -Dproject.settings=sonar-project.properties
          '''
        }
      }
    }

    stage('Build & Push Image') {
      steps {
        container('buildah') {
          sh '''
          # Set buildah format and HTTP configuration
          export BUILDAH_FORMAT=docker
          export STORAGE_DRIVER=vfs
          export BUILDAH_ISOLATION=chroot
          export BUILDAH_REGISTRY_AUTH_FILE=/tmp/auth.json
          export BUILDAH_REGISTRY_V1=true
          
          # Change to workspace directory
          cd /home/jenkins/agent/workspace/jenkins-demo-pipeline
          
          echo "Current directory: $(pwd)"
          echo "Contents: $(ls -la)"
          
          echo "Building image..."
          buildah bud --format=docker -t ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} -f Dockerfile .
          
          echo "Logging into registry..."
          # Configure buildah for insecure registry
          export BUILDAH_REGISTRY_AUTH_FILE=/tmp/auth.json
          
          # Create auth file for HTTP registry
          echo '{"auths":{"'${REGISTRY_URL}'":{"auth":"'$(echo -n ${REGISTRY_CREDS_USR}:${REGISTRY_CREDS_PSW} | base64)'"}}}' > /tmp/auth.json
          
          # Test connection first
          echo "Testing connection to registry..."
          curl -I http://${REGISTRY_URL}/v2/ || echo "v2 API not accessible via HTTP"
          curl -I http://${REGISTRY_URL}/v1/ || echo "v1 API not accessible via HTTP"
          
          # Test authentication
          echo "Testing authentication..."
          curl -u ${REGISTRY_CREDS_USR}:${REGISTRY_CREDS_PSW} http://${REGISTRY_URL}/v2/ || echo "v2 Authentication failed"
          curl -u ${REGISTRY_CREDS_USR}:${REGISTRY_CREDS_PSW} http://${REGISTRY_URL}/v1/_ping || echo "v1 Authentication failed"
          
          # Check if Docker registry is properly configured
          echo "Checking Docker registry configuration..."
          curl -u ${REGISTRY_CREDS_USR}:${REGISTRY_CREDS_PSW} http://${REGISTRY_URL}/v2/_catalog || echo "Cannot access v2 catalog"
          curl -u ${REGISTRY_CREDS_USR}:${REGISTRY_CREDS_PSW} http://${REGISTRY_URL}/v1/search || echo "Cannot access v1 search"
          
          # Configure buildah for HTTP registry with v1 API
          echo "Configuring buildah for HTTP registry with v1 API..."
          mkdir -p /etc/containers
          cat > /etc/containers/registries.conf << EOF
unqualified-search-registries = ["docker.io"]
[[registry]]
location = "${REGISTRY_URL}"
insecure = true
[[registry]]
location = "docker.io"
insecure = false
EOF
          
          # Create registries.d configuration for v1 API only
          mkdir -p /etc/containers/registries.d
          cat > /etc/containers/registries.d/nexus.yaml << EOF
docker:
  ${REGISTRY_URL}:
    tls-verify: false
    v1: true
    v2: false
EOF
          
          # Debug buildah configuration
          echo "Buildah configuration:"
          echo "BUILDAH_REGISTRY_V1: $BUILDAH_REGISTRY_V1"
          echo "BUILDAH_REGISTRY_AUTH_FILE: $BUILDAH_REGISTRY_AUTH_FILE"
          echo "Auth file contents:"
          cat /tmp/auth.json
          echo "Registries configuration:"
          cat /etc/containers/registries.conf
          echo "Registries.d configuration:"
          cat /etc/containers/registries.d/nexus.yaml
          
          # Login with buildah using v1 API
          echo "Attempting login with buildah using v1 API..."
          buildah login --authfile /tmp/auth.json --tls-verify=false -u ${REGISTRY_CREDS_USR} -p ${REGISTRY_CREDS_PSW} ${REGISTRY_URL}
          
          echo "Pushing image..."
          # Push without docker:// scheme but with HTTP configuration
          buildah push --tls-verify=false ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}
          
          echo "Tagging latest..."
          buildah tag ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY_URL}/${IMAGE_NAME}:latest
          buildah push --tls-verify=false ${REGISTRY_URL}/${IMAGE_NAME}:latest
          
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


