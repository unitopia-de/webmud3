pipeline {
  agent any
  stages {
    stage('Load') {
      steps {
        git(url: 'https://github.com/myonara/webmud3.git', branch: 'master')
      }
    }
    stage('Build') {
      steps {
        sh '''docker build -f dockerfiles/ng.dockerfile -t myonara/webmud3:unitopiatest .
'''
      }
    }
  }
}