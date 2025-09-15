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
        # Use Docker Gitleaks to avoid download issues
        docker run --rm -v "$PWD:/src" zricethezav/gitleaks:v8.28.0 detect \
          --source /src \
          --config /src/.gitleaks.toml \
          --report-format json \
          --report-path /src/gitleaks-report.json
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


