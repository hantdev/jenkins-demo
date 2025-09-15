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
        set -e
        if ! command -v gitleaks >/dev/null 2>&1; then
          # Download latest Gitleaks from GitHub releases
          GITLEAKS_VERSION=$(curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
          curl -L -o gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz https://github.com/gitleaks/gitleaks/releases/download/${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz
          tar -xzf gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz
          mv gitleaks /usr/local/bin/
          chmod +x /usr/local/bin/gitleaks
        fi
        gitleaks detect --source . --config .gitleaks.toml --report-format json --report-path gitleaks-report.json
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
        sh 'npm ci'
      }
    }

    stage('Lint & Test') {
      steps {
        sh 'npm run lint'
        sh 'npm test'
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

    stage('Build Image') {
      steps {
        sh '''
        docker build -t ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} .
        '''
      }
    }

    stage('Push Image') {
      steps {
        sh '''
        echo ${REGISTRY_CREDS_PSW} | docker login ${REGISTRY_URL} -u ${REGISTRY_CREDS_USR} --password-stdin
        docker push ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}
        docker tag ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY_URL}/${IMAGE_NAME}:latest
        docker push ${REGISTRY_URL}/${IMAGE_NAME}:latest
        '''
      }
    }
  }
}


