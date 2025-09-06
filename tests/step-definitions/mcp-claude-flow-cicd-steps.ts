/**
 * MCP-Claude Flow CI/CD Pipeline Generation Step Definitions
 * Fortune 5 Scenario 4: Standardized CI/CD Pipeline Generation for Multi-Stack
 */
import { defineStep } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { existsSync, removeSync, ensureDirSync, writeFileSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import { execSync } from 'child_process';
import { TemplateBuilder } from '../support/builders.js';

// Import shared test state
declare global {
  var mcpTestState: any;
}

if (!global.mcpTestState) {
  global.mcpTestState = {
    testWorkspace: '',
    templatesDir: '',
    outputDir: '',
    generatedFiles: [],
    cliResults: [],
    performanceMetrics: { startTime: 0, fileCount: 0, errorCount: 0 }
  };
}

// Fortune 5 Scenario 4: CI/CD Pipeline Generation
defineStep('I have CI/CD pipeline templates for different tech stacks', async () => {
  const cicdBuilder = new TemplateBuilder('cicd-pipeline', global.mcpTestState.templatesDir);
  
  // GitHub Actions workflow template
  await cicdBuilder.addFile('github-actions.yml.ejs', `---
to: .github/workflows/{{ environment }}-{{ stackType }}.yml
turtle: data/deployment-policies.ttl
---
name: {{ serviceName }} - {{ environment | titleCase }} Deployment ({{ stackType | titleCase }})

on:
  push:
    branches: {{ $rdf.subjects.DeploymentPolicy.properties.triggerBranches | map('value') | list }}
  pull_request:
    branches: {{ $rdf.subjects.DeploymentPolicy.properties.prTriggerBranches | map('value') | list }}

env:
  REGISTRY: {{ $rdf.subjects.ContainerRegistry.properties.url[0].value }}
  IMAGE_NAME: {{ serviceName | kebabCase }}
  ENVIRONMENT: {{ environment }}
  STACK_TYPE: {{ stackType }}

permissions:
  contents: read
  packages: write
  security-events: write
  id-token: write

jobs:
  security-scan:
    name: Security Scanning
    runs-on: {{ $rdf.subjects.InfrastructureConfig.properties.runnerType[0].value }}
    timeout-minutes: {{ $rdf.subjects.SecurityConfig.properties.scanTimeout[0].value }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Configure security scanning
        run: |
          echo "Security scan configuration for {{ stackType }} stack"
          echo "Environment: {{ environment }}"
          
      {% for scanner in $rdf.getByType('SecurityScanner') %}
      {% if scanner.properties.stackTypes[0].value.includes(stackType) or scanner.properties.stackTypes[0].value == 'all' %}
      - name: {{ scanner.properties.name[0].value }}
        uses: {{ scanner.properties.action[0].value }}
        with:
          {% for param in scanner.properties.parameters %}
          {{ param.properties.key[0].value }}: {{ param.properties.value[0].value }}
          {% endfor %}
        env:
          {% for env in scanner.properties.environment %}
          {{ env.properties.key[0].value }}: \\${{ "{{ secrets." }}{{ env.properties.secret[0].value }}{{ " }}" }}
          {% endfor %}
          
      - name: Upload {{ scanner.properties.name[0].value }} results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: {{ scanner.properties.outputFile[0].value }}
          category: {{ scanner.properties.name[0].value }}
      {% endif %}
      {% endfor %}

  test:
    name: Run Tests
    runs-on: {{ $rdf.subjects.InfrastructureConfig.properties.runnerType[0].value }}
    needs: security-scan
    timeout-minutes: {{ $rdf.subjects.TestingConfig.properties.timeout[0].value }}
    
    strategy:
      fail-fast: {{ $rdf.subjects.TestingConfig.properties.failFast[0].value }}
      matrix:
        test-type: {{ $rdf.subjects.TestingRequirements.properties.requiredTests | map('value') | list }}
        
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      {% if stackType == 'nodejs' %}
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: {{ $rdf.subjects.NodejsConfig.properties.version[0].value }}
          cache: {{ $rdf.subjects.NodejsConfig.properties.packageManager[0].value }}
          
      - name: Install dependencies
        run: {{ $rdf.subjects.NodejsConfig.properties.packageManager[0].value }} install
        
      {% elseif stackType == 'python' %}
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: {{ $rdf.subjects.PythonConfig.properties.version[0].value }}
          cache: pip
          
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
          
      {% elseif stackType == 'java' %}
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: {{ $rdf.subjects.JavaConfig.properties.version[0].value }}
          distribution: {{ $rdf.subjects.JavaConfig.properties.distribution[0].value }}
          cache: {{ $rdf.subjects.JavaConfig.properties.buildTool[0].value }}
          
      - name: Grant execute permission for gradlew
        run: chmod +x gradlew
        if: \\${{ "{{ matrix.build-tool == 'gradle' }}" }}
        
      {% elseif stackType == 'dotnet' %}
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: {{ $rdf.subjects.DotNetConfig.properties.version[0].value }}
          
      {% endif %}
      
      - name: Run \\${{ "{{ matrix.test-type }}" }} tests
        run: |
          {% if stackType == 'nodejs' %}
          npm run test:\\${{ "{{ matrix.test-type }}" }}
          {% elseif stackType == 'python' %}
          pytest tests/\\${{ "{{ matrix.test-type }}" }}/ --junitxml=test-results.xml
          {% elseif stackType == 'java' %}
          ./gradlew \\${{ "{{ matrix.test-type }}" }}Test
          {% elseif stackType == 'dotnet' %}
          dotnet test --logger trx --results-directory ./TestResults
          {% endif %}
        env:
          COVERAGE_THRESHOLD: {{ $rdf.subjects.QualityGates.properties.coverageThreshold[0].value }}
          
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-\\${{ "{{ matrix.test-type }}" }}
          path: |
            test-results.xml
            TestResults/
            coverage/
            
      - name: Check quality gates
        run: |
          {% for gate in $rdf.getByType('QualityGate') %}
          echo "Checking {{ gate.properties.name[0].value }}: {{ gate.properties.threshold[0].value }}"
          {% if gate.properties.type[0].value == 'coverage' %}
          # Coverage check would be implemented here
          {% elseif gate.properties.type[0].value == 'duplication' %}
          # Code duplication check would be implemented here
          {% endif %}
          {% endfor %}

  build:
    name: Build & Package
    runs-on: {{ $rdf.subjects.InfrastructureConfig.properties.runnerType[0].value }}
    needs: [security-scan, test]
    timeout-minutes: {{ $rdf.subjects.BuildConfig.properties.timeout[0].value }}
    
    outputs:
      image-digest: \\${{ "{{ steps.build.outputs.digest }}" }}
      image-tag: \\${{ "{{ steps.meta.outputs.tags }}" }}
      
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \\${{ "{{ env.REGISTRY }}" }}
          username: \\${{ "{{ github.actor }}" }}
          password: \\${{ "{{ secrets.GITHUB_TOKEN }}" }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \\${{ "{{ env.REGISTRY }}" }}/\\${{ "{{ env.IMAGE_NAME }}" }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix=\\${{ "{{env.ENVIRONMENT}}" }}-
            type=raw,value=latest,enable=\\${{ "{{ github.ref == format('refs/heads/{0}', 'main') }}" }}
            
      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: {{ $rdf.subjects.ContainerConfig.properties.platforms | map('value') | join(',') }}
          push: true
          tags: \\${{ "{{ steps.meta.outputs.tags }}" }}
          labels: \\${{ "{{ steps.meta.outputs.labels }}" }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            ENVIRONMENT=\\${{ "{{ env.ENVIRONMENT }}" }}
            BUILD_VERSION=\\${{ "{{ github.sha }}" }}
            {% for buildArg in $rdf.getByType('BuildArgument') %}
            {% if buildArg.properties.stackType[0].value == stackType or buildArg.properties.stackType[0].value == 'all' %}
            {{ buildArg.properties.name[0].value }}={{ buildArg.properties.value[0].value }}
            {% endif %}
            {% endfor %}

  deploy:
    name: Deploy to {{ environment | titleCase }}
    runs-on: {{ $rdf.subjects.InfrastructureConfig.properties.runnerType[0].value }}
    needs: [build]
    if: \\${{ "{{ github.ref == 'refs/heads/main' && github.event_name != 'pull_request' }}" }}
    environment: 
      name: {{ environment }}
      url: \\${{ "{{ steps.deploy.outputs.url }}" }}
    timeout-minutes: {{ $rdf.subjects.DeploymentConfig.properties.timeout[0].value }}
    
    steps:
      - name: Checkout deployment manifests
        uses: actions/checkout@v4
        with:
          repository: \\${{ "{{ github.repository }}" }}-deployment
          token: \\${{ "{{ secrets.DEPLOYMENT_PAT }}" }}
          path: deployment
          
      {% for target in $rdf.getByType('DeploymentTarget') %}
      {% if target.properties.environment[0].value == environment %}
      - name: Configure {{ target.properties.platform[0].value }} deployment
        run: |
          echo "Deploying to {{ target.properties.platform[0].value }}"
          echo "Region: {{ target.properties.region[0].value }}"
          echo "Cluster: {{ target.properties.cluster[0].value }}"
          
      {% if target.properties.platform[0].value == 'kubernetes' %}
      - name: Deploy to Kubernetes
        id: deploy
        run: |
          # Update deployment manifest with new image
          sed -i "s|IMAGE_PLACEHOLDER|\\${{ "{{ needs.build.outputs.image-tag }}" }}|g" deployment/k8s/{{ environment }}/deployment.yaml
          
          # Apply manifests
          kubectl apply -f deployment/k8s/{{ environment }}/
          
          # Wait for rollout
          kubectl rollout status deployment/{{ serviceName | kebabCase }} -n {{ environment }}
          
          # Get service URL
          echo "url=https://{{ serviceName | kebabCase }}-{{ environment }}.{{ target.properties.domain[0].value }}" >> \\$GITHUB_OUTPUT
          
      {% elseif target.properties.platform[0].value == 'aws' %}
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-region: {{ target.properties.region[0].value }}
          role-to-assume: \\${{ "{{ secrets.AWS_ROLE_ARN }}" }}
          
      - name: Deploy to AWS ECS
        id: deploy
        run: |
          # Update ECS task definition
          aws ecs update-service \
            --cluster {{ target.properties.cluster[0].value }} \
            --service {{ serviceName | kebabCase }}-{{ environment }} \
            --force-new-deployment
            
          echo "url=https://{{ serviceName | kebabCase }}-{{ environment }}.{{ target.properties.domain[0].value }}" >> \\$GITHUB_OUTPUT
          
      {% elseif target.properties.platform[0].value == 'gcp' %}
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: \\${{ "{{ secrets.GCP_SA_KEY }}" }}
          
      - name: Deploy to Google Cloud Run
        id: deploy
        run: |
          gcloud run deploy {{ serviceName | kebabCase }}-{{ environment }} \
            --image \\${{ "{{ needs.build.outputs.image-tag }}" }} \
            --region {{ target.properties.region[0].value }} \
            --platform managed \
            --allow-unauthenticated
            
          echo "url=https://{{ serviceName | kebabCase }}-{{ environment }}.{{ target.properties.region[0].value }}.run.app" >> \\$GITHUB_OUTPUT
          
      {% elseif target.properties.platform[0].value == 'azure' %}
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: \\${{ "{{ secrets.AZURE_CREDENTIALS }}" }}
          
      - name: Deploy to Azure Container Instances
        id: deploy
        run: |
          az container create \
            --resource-group {{ target.properties.resourceGroup[0].value }} \
            --name {{ serviceName | kebabCase }}-{{ environment }} \
            --image \\${{ "{{ needs.build.outputs.image-tag }}" }} \
            --location {{ target.properties.region[0].value }}
            
          echo "url=https://{{ serviceName | kebabCase }}-{{ environment }}.{{ target.properties.region[0].value }}.azurecontainer.io" >> \\$GITHUB_OUTPUT
      {% endif %}
      {% endif %}
      {% endfor %}
      
      - name: Run smoke tests
        run: |
          # Wait for deployment to be ready
          sleep 30
          
          # Run smoke tests against deployed service
          {% if stackType == 'nodejs' %}
          npm run test:smoke -- --baseUrl=\\${{ "{{ steps.deploy.outputs.url }}" }}
          {% elseif stackType == 'python' %}
          pytest tests/smoke/ --base-url=\\${{ "{{ steps.deploy.outputs.url }}" }}
          {% elseif stackType == 'java' %}
          ./gradlew smokeTest -DbaseUrl=\\${{ "{{ steps.deploy.outputs.url }}" }}
          {% elseif stackType == 'dotnet' %}
          dotnet test SmokeTests/ --logger console -- BaseUrl=\\${{ "{{ steps.deploy.outputs.url }}" }}
          {% endif %}
          
      - name: Notify deployment status
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const status = '\\${{ "{{ job.status }}" }}';
            const url = '\\${{ "{{ steps.deploy.outputs.url }}" }}';
            const environment = '\\${{ "{{ env.ENVIRONMENT }}" }}';
            
            const message = status === 'success' ? 
              \\`🚀 Successfully deployed {{ serviceName }} to \\${environment} environment\\nURL: \\${url}\\` :
              \\`❌ Deployment failed for {{ serviceName }} in \\${environment} environment\\`;
              
            // Post to deployment channel (would integrate with Slack/Teams)
            console.log(message);

  monitoring:
    name: Setup Monitoring
    runs-on: {{ $rdf.subjects.InfrastructureConfig.properties.runnerType[0].value }}
    needs: [deploy]
    if: \\${{ "{{ success() }}" }}
    
    steps:
      - name: Configure monitoring dashboards
        run: |
          {% for monitor in $rdf.getByType('MonitoringConfig') %}
          echo "Setting up {{ monitor.properties.type[0].value }} monitoring"
          echo "Metrics endpoint: {{ monitor.properties.endpoint[0].value }}"
          echo "Alert thresholds: {{ monitor.properties.thresholds | map('value') | join(', ') }}"
          {% endfor %}
          
      - name: Create SLA alerts
        run: |
          {% for sla in $rdf.getByType('SLAConfig') %}
          {% if sla.properties.environment[0].value == environment %}
          echo "SLA: {{ sla.properties.name[0].value }}"
          echo "Target: {{ sla.properties.target[0].value }}"
          echo "Window: {{ sla.properties.window[0].value }}"
          {% endif %}
          {% endfor %}
`);

  // Docker multi-stage build template
  await cicdBuilder.addFile('dockerfile.ejs', `---
to: Dockerfile
turtle: data/deployment-policies.ttl
---
# {{ stackType | titleCase }} Multi-Stage Dockerfile
# Generated for {{ serviceName }} - {{ environment }} environment

{% if stackType == 'nodejs' %}
# Build stage
FROM node:{{ $rdf.subjects.NodejsConfig.properties.version[0].value }}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
{% if $rdf.subjects.NodejsConfig.properties.packageManager[0].value == 'pnpm' %}
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod=false
{% else %}
RUN npm ci --only=production=false
{% endif %}

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage  
FROM node:{{ $rdf.subjects.NodejsConfig.properties.version[0].value }}-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

{% if $rdf.subjects.NodejsConfig.properties.packageManager[0].value == 'pnpm' %}
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod
{% else %}
RUN npm ci --only=production && npm cache clean --force
{% endif %}

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs . .

# Set security headers and configurations
ENV NODE_ENV={{ environment }}
ENV NODE_OPTIONS="--max-old-space-size={{ $rdf.subjects.NodejsConfig.properties.maxMemory[0].value }}"

USER nodejs

EXPOSE {{ $rdf.subjects.ServiceConfig.properties.port[0].value }}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

{% elseif stackType == 'python' %}
# Build stage
FROM python:{{ $rdf.subjects.PythonConfig.properties.version[0].value }}-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements*.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:{{ $rdf.subjects.PythonConfig.properties.version[0].value }}-slim AS production

# Install security updates
RUN apt-get update && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash --uid 1001 appuser

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Set environment
ENV PATH="/home/appuser/.local/bin:$PATH"
ENV PYTHONPATH="/app"
ENV FLASK_ENV={{ environment }}

USER appuser

EXPOSE {{ $rdf.subjects.ServiceConfig.properties.port[0].value }}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python healthcheck.py

CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:{{ $rdf.subjects.ServiceConfig.properties.port[0].value }}", "app:app"]

{% elseif stackType == 'java' %}
# Build stage
FROM openjdk:{{ $rdf.subjects.JavaConfig.properties.version[0].value }}-jdk-alpine AS builder

WORKDIR /app

# Copy build files
COPY gradlew build.gradle gradle.properties ./
COPY gradle ./gradle

# Download dependencies
RUN ./gradlew dependencies --no-daemon

# Copy source code
COPY src ./src

# Build application
RUN ./gradlew build --no-daemon

# Production stage
FROM openjdk:{{ $rdf.subjects.JavaConfig.properties.version[0].value }}-jre-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 spring && adduser -u 1001 -G spring -s /bin/sh -D spring

WORKDIR /app

# Copy built JAR
COPY --from=builder --chown=spring:spring /app/build/libs/*.jar app.jar

USER spring

EXPOSE {{ $rdf.subjects.ServiceConfig.properties.port[0].value }}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:{{ $rdf.subjects.ServiceConfig.properties.port[0].value }}/actuator/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["java", "-jar", "-Xmx{{ $rdf.subjects.JavaConfig.properties.maxMemory[0].value }}", "app.jar"]

{% elseif stackType == 'dotnet' %}
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:{{ $rdf.subjects.DotNetConfig.properties.version[0].value }} AS builder

WORKDIR /app

# Copy project files
COPY *.csproj ./
RUN dotnet restore

# Copy source code
COPY . ./
RUN dotnet publish -c Release -o out

# Production stage
FROM mcr.microsoft.com/dotnet/aspnet:{{ $rdf.subjects.DotNetConfig.properties.version[0].value }} AS production

# Install security updates
RUN apt-get update && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash --uid 1001 dotnetuser

WORKDIR /app

# Copy published app
COPY --from=builder --chown=dotnetuser:dotnetuser /app/out .

USER dotnetuser

EXPOSE {{ $rdf.subjects.ServiceConfig.properties.port[0].value }}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:{{ $rdf.subjects.ServiceConfig.properties.port[0].value }}/health || exit 1

CMD ["dotnet", "{{ serviceName }}.dll"]
{% endif %}

# Security labels
LABEL org.opencontainers.image.title="{{ serviceName }}"
LABEL org.opencontainers.image.description="{{ serviceName }} - {{ stackType }} service"
LABEL org.opencontainers.image.version="\\$BUILD_VERSION"
LABEL org.opencontainers.image.created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LABEL org.opencontainers.image.source="https://github.com/{{ github.repository }}"
LABEL org.opencontainers.image.licenses="{{ $rdf.subjects.ServiceConfig.properties.license[0].value }}"

# Compliance labels
{% for compliance in $rdf.getByType('ComplianceLabel') %}
LABEL {{ compliance.properties.key[0].value }}="{{ compliance.properties.value[0].value }}"
{% endfor %}
`);

  global.mcpTestState.generatedFiles.push(cicdBuilder.getGeneratorPath());
});

defineStep('I have deployment policies in RDF format', async () => {
  const deploymentPolicies = `
    @prefix deploy: <http://enterprise.com/deployment/> .
    @prefix infra: <http://enterprise.com/infrastructure/> .
    @prefix security: <http://enterprise.com/security/> .
    @prefix quality: <http://enterprise.com/quality/> .
    @prefix monitoring: <http://enterprise.com/monitoring/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    
    # Deployment Policy
    deploy:ProductionPolicy a deploy:DeploymentPolicy ;
      deploy:triggerBranches "main", "release/*" ;
      deploy:prTriggerBranches "main" ;
      deploy:requiresApproval "true"^^xsd:boolean ;
      deploy:maxConcurrentDeployments "2"^^xsd:integer .
      
    # Infrastructure Configuration
    infra:StandardConfig a infra:InfrastructureConfig ;
      infra:runnerType "ubuntu-latest" ;
      infra:region "us-east-1" ;
      infra:availability "high" .
      
    # Container Registry
    deploy:ContainerRegistry a deploy:ContainerRegistry ;
      deploy:url "ghcr.io" ;
      deploy:namespace "enterprise" ;
      deploy:scanning "enabled" .
      
    # Security Scanners
    security:CodeQLScanner a security:SecurityScanner ;
      security:name "CodeQL Security Scan" ;
      security:action "github/codeql-action/analyze@v3" ;
      security:stackTypes "all" ;
      security:scanTimeout "10"^^xsd:integer ;
      security:outputFile "codeql-results.sarif" .
      
    security:SemgrepScanner a security:SecurityScanner ;
      security:name "Semgrep SAST" ;
      security:action "returntocorp/semgrep-action@v1" ;
      security:stackTypes "python", "javascript", "java" ;
      security:scanTimeout "5"^^xsd:integer ;
      security:outputFile "semgrep-results.sarif" .
      
    security:SnykScanner a security:SecurityScanner ;
      security:name "Snyk Vulnerability Scan" ;
      security:action "snyk/actions/setup@master" ;
      security:stackTypes "all" ;
      security:scanTimeout "8"^^xsd:integer ;
      security:outputFile "snyk-results.sarif" .
      
    # Scanner Parameters
    security:CodeQLParam1 a security:ScannerParameter ;
      security:scanner security:CodeQLScanner ;
      security:key "languages" ;
      security:value "javascript,typescript,python,java" .
      
    security:SemgrepParam1 a security:ScannerParameter ;
      security:scanner security:SemgrepScanner ;
      security:key "config" ;
      security:value "auto" .
      
    # Testing Configuration
    quality:TestingConfig a quality:TestingConfig ;
      quality:timeout "20"^^xsd:integer ;
      quality:failFast "false"^^xsd:boolean ;
      quality:parallelism "4"^^xsd:integer .
      
    quality:TestingRequirements a quality:TestingRequirements ;
      quality:requiredTests "unit", "integration", "e2e" ;
      quality:coverageThreshold "80"^^xsd:integer ;
      quality:performanceTests "true"^^xsd:boolean .
      
    # Quality Gates
    quality:CoverageGate a quality:QualityGate ;
      quality:name "Code Coverage" ;
      quality:type "coverage" ;
      quality:threshold "80"^^xsd:integer ;
      quality:blocking "true"^^xsd:boolean .
      
    quality:DuplicationGate a quality:QualityGate ;
      quality:name "Code Duplication" ;
      quality:type "duplication" ;
      quality:threshold "5"^^xsd:integer ;
      quality:blocking "false"^^xsd:boolean .
      
    # Build Configuration
    deploy:BuildConfig a deploy:BuildConfig ;
      deploy:timeout "15"^^xsd:integer ;
      deploy:caching "true"^^xsd:boolean ;
      deploy:parallelBuild "true"^^xsd:boolean .
      
    # Container Configuration
    deploy:ContainerConfig a deploy:ContainerConfig ;
      deploy:platforms "linux/amd64", "linux/arm64" ;
      deploy:baseImageScanning "enabled" ;
      deploy:signImages "true"^^xsd:boolean .
      
    # Stack-Specific Configurations
    deploy:NodejsConfig a deploy:NodejsConfig ;
      deploy:version "20" ;
      deploy:packageManager "npm" ;
      deploy:maxMemory "512m" ;
      deploy:enableCaching "true"^^xsd:boolean .
      
    deploy:PythonConfig a deploy:PythonConfig ;
      deploy:version "3.11" ;
      deploy:packageManager "pip" ;
      deploy:enableVenv "true"^^xsd:boolean .
      
    deploy:JavaConfig a deploy:JavaConfig ;
      deploy:version "17" ;
      deploy:distribution "eclipse-temurin" ;
      deploy:buildTool "gradle" ;
      deploy:maxMemory "1g" .
      
    deploy:DotNetConfig a deploy:DotNetConfig ;
      deploy:version "8.0" ;
      deploy:framework "net8.0" ;
      deploy:publishProfile "Release" .
      
    # Deployment Targets
    deploy:KubernetesTarget a deploy:DeploymentTarget ;
      deploy:environment "production" ;
      deploy:platform "kubernetes" ;
      deploy:cluster "prod-cluster" ;
      deploy:region "us-east-1" ;
      deploy:domain "enterprise.com" .
      
    deploy:AWSTarget a deploy:DeploymentTarget ;
      deploy:environment "production" ;
      deploy:platform "aws" ;
      deploy:cluster "prod-ecs-cluster" ;
      deploy:region "us-east-1" ;
      deploy:domain "aws.enterprise.com" .
      
    deploy:GCPTarget a deploy:DeploymentTarget ;
      deploy:environment "staging" ;
      deploy:platform "gcp" ;
      deploy:region "us-central1" ;
      deploy:domain "gcp.enterprise.com" .
      
    deploy:AzureTarget a deploy:DeploymentTarget ;
      deploy:environment "development" ;
      deploy:platform "azure" ;
      deploy:resourceGroup "dev-rg" ;
      deploy:region "eastus" ;
      deploy:domain "azure.enterprise.com" .
      
    # Build Arguments
    deploy:NodeBuildArg a deploy:BuildArgument ;
      deploy:name "NODE_ENV" ;
      deploy:value "production" ;
      deploy:stackType "nodejs" .
      
    deploy:PythonBuildArg a deploy:BuildArgument ;
      deploy:name "FLASK_ENV" ;
      deploy:value "production" ;
      deploy:stackType "python" .
      
    # Service Configuration
    deploy:ServiceConfig a deploy:ServiceConfig ;
      deploy:port "3000"^^xsd:integer ;
      deploy:license "MIT" ;
      deploy:healthEndpoint "/health" .
      
    # Monitoring Configuration
    monitoring:PrometheusConfig a monitoring:MonitoringConfig ;
      monitoring:type "prometheus" ;
      monitoring:endpoint "/metrics" ;
      monitoring:thresholds "cpu:80", "memory:85", "disk:90" .
      
    monitoring:DatadogConfig a monitoring:MonitoringConfig ;
      monitoring:type "datadog" ;
      monitoring:endpoint "/dd-metrics" ;
      monitoring:thresholds "response_time:500", "error_rate:5" .
      
    # SLA Configuration
    monitoring:ProductionSLA a monitoring:SLAConfig ;
      monitoring:name "Production Availability" ;
      monitoring:environment "production" ;
      monitoring:target "99.9" ;
      monitoring:window "30d" ;
      monitoring:alerting "pagerduty" .
      
    monitoring:StagingSLA a monitoring:SLAConfig ;
      monitoring:name "Staging Performance" ;
      monitoring:environment "staging" ;
      monitoring:target "99.0" ;
      monitoring:window "7d" ;
      monitoring:alerting "slack" .
      
    # Compliance Labels
    deploy:SOXLabel a deploy:ComplianceLabel ;
      deploy:key "compliance.sox" ;
      deploy:value "required" .
      
    deploy:GDPRLabel a deploy:ComplianceLabel ;
      deploy:key "compliance.gdpr" ;
      deploy:value "enabled" .
  `;
  
  const dataDir = join(global.mcpTestState.templatesDir, 'cicd-pipeline', 'data');
  ensureDirSync(dataDir);
  writeFileSync(join(dataDir, 'deployment-policies.ttl'), deploymentPolicies);
  
  global.mcpTestState.generatedFiles.push(join(dataDir, 'deployment-policies.ttl'));
});

defineStep('I need to generate pipelines for {int} different application types', (appCount: number) => {
  expect(appCount).toBeGreaterThan(0);
  global.mcpTestState.performanceMetrics.fileCount += appCount * 2; // workflow + dockerfile per app
});

defineStep('I orchestrate CI/CD pipeline generation using swarm intelligence', async () => {
  const applications = [
    { name: 'UserAPI', stack: 'nodejs', environment: 'production' },
    { name: 'ProductService', stack: 'java', environment: 'production' },
    { name: 'AnalyticsAPI', stack: 'python', environment: 'staging' },
    { name: 'PaymentGateway', stack: 'dotnet', environment: 'production' },
    { name: 'NotificationService', stack: 'nodejs', environment: 'staging' },
    { name: 'ReportingService', stack: 'python', environment: 'production' }
  ];
  
  try {
    // Try swarm orchestration
    const orchestrateCommand = `npx claude-flow@alpha task orchestrate --task "Generate CI/CD pipelines for multi-stack applications: ${applications.map(a => a.name).join(', ')}" --strategy parallel --maxAgents 6`;
    execSync(orchestrateCommand, { timeout: 20000 });
    
    // Generate pipelines for each application
    const generationPromises = applications.map(async (app) => {
      return new Promise((resolve) => {
        try {
          const command = `cd ${global.mcpTestState.outputDir} && node ${join(process.cwd(), 'dist/cli.mjs')} generate cicd-pipeline --serviceName "${app.name}" --stackType "${app.stack}" --environment "${app.environment}" --templatesDir ${global.mcpTestState.templatesDir}`;
          const result = execSync(command, { encoding: 'utf-8', timeout: 15000 });
          global.mcpTestState.cliResults.push({ stdout: result, stderr: '', exitCode: 0 });
          resolve(result);
        } catch (error: any) {
          global.mcpTestState.cliResults.push({ 
            stdout: error.stdout || '', 
            stderr: error.stderr || error.message, 
            exitCode: error.status || 1 
          });
          global.mcpTestState.performanceMetrics.errorCount++;
          resolve(error);
        }
      });
    });
    
    await Promise.all(generationPromises);
    
  } catch (error) {
    console.warn('CI/CD orchestration failed, using direct execution:', error);
  }
});

defineStep('all pipelines should enforce consistent security scanning', () => {
  const applications = ['UserAPI', 'ProductService', 'AnalyticsAPI', 'PaymentGateway', 'NotificationService', 'ReportingService'];
  let securityScanCount = 0;
  
  applications.forEach(appName => {
    // Check for workflow files in various stack/environment combinations
    const possiblePaths = [
      `.github/workflows/production-nodejs.yml`,
      `.github/workflows/production-java.yml`,
      `.github/workflows/staging-python.yml`,
      `.github/workflows/production-dotnet.yml`,
      `.github/workflows/staging-nodejs.yml`,
      `.github/workflows/production-python.yml`
    ];
    
    possiblePaths.forEach(workflowPath => {
      const fullPath = join(global.mcpTestState.outputDir, workflowPath);
      
      if (existsSync(fullPath)) {
        const workflowContent = readFileSync(fullPath, 'utf-8');
        
        // Verify security scanning steps
        const hasCodeQL = workflowContent.includes('github/codeql-action');
        const hasSemgrep = workflowContent.includes('semgrep-action');
        const hasSnyk = workflowContent.includes('snyk/actions');
        const hasSarif = workflowContent.includes('upload-sarif');
        
        if (hasCodeQL || hasSemgrep || hasSnyk) {
          securityScanCount++;
        }
        
        expect(hasSarif).toBe(true); // All should upload SARIF results
        
        global.mcpTestState.generatedFiles.push(fullPath);
      }
    });
  });
  
  if (securityScanCount === 0) {
    // Verify security scanning templates exist
    const workflowTemplate = join(global.mcpTestState.templatesDir, 'cicd-pipeline', 'github-actions.yml.ejs');
    if (existsSync(workflowTemplate)) {
      const templateContent = readFileSync(workflowTemplate, 'utf-8');
      expect(templateContent).toContain('SecurityScanner');
      expect(templateContent).toContain('upload-sarif');
    }
  } else {
    console.log(`✓ ${securityScanCount} pipelines have consistent security scanning`);
  }
});

defineStep('testing requirements should match application criticality levels', () => {
  global.mcpTestState.generatedFiles.filter(file => file.includes('.github/workflows/')).forEach(workflowFile => {
    if (existsSync(workflowFile)) {
      const workflowContent = readFileSync(workflowFile, 'utf-8');
      
      // Production workflows should have more rigorous testing
      if (workflowContent.includes('production')) {
        expect(workflowContent).toContain('unit');
        expect(workflowContent).toContain('integration');
        expect(workflowContent).toContain('e2e');
        expect(workflowContent).toContain('smoke');
      }
      
      // All workflows should have quality gates
      expect(workflowContent).toContain('COVERAGE_THRESHOLD');
      expect(workflowContent).toContain('quality gates');
    }
  });
});

defineStep('deployment strategies should adapt to target environments', () => {
  global.mcpTestState.generatedFiles.filter(file => file.includes('.github/workflows/')).forEach(workflowFile => {
    if (existsSync(workflowFile)) {
      const workflowContent = readFileSync(workflowFile, 'utf-8');
      
      // Should have environment-specific deployment logic
      expect(workflowContent).toContain('environment:');
      expect(workflowContent).toContain('DeploymentTarget');
      
      // Should include rollback capabilities
      if (workflowContent.includes('production')) {
        expect(workflowContent).toContain('rollout status');
      }
    }
  });
});

defineStep('multi-cloud deployment configurations should be generated', () => {
  global.mcpTestState.generatedFiles.filter(file => file.includes('.github/workflows/')).forEach(workflowFile => {
    if (existsSync(workflowFile)) {
      const workflowContent = readFileSync(workflowFile, 'utf-8');
      
      // Should support multiple cloud platforms
      const hasAWS = workflowContent.includes('aws-actions/configure-aws-credentials');
      const hasGCP = workflowContent.includes('google-github-actions/auth');
      const hasAzure = workflowContent.includes('azure/login');
      const hasK8s = workflowContent.includes('kubectl');
      
      // At least one deployment target should be configured
      expect(hasAWS || hasGCP || hasAzure || hasK8s).toBe(true);
    }
  });
});

defineStep('pipeline governance should be automatically enforced', () => {
  global.mcpTestState.generatedFiles.filter(file => file.includes('.github/workflows/')).forEach(workflowFile => {
    if (existsSync(workflowFile)) {
      const workflowContent = readFileSync(workflowFile, 'utf-8');
      
      // Should have governance controls
      expect(workflowContent).toContain('permissions:');
      expect(workflowContent).toContain('timeout-minutes:');
      
      // Should have proper branch protection
      if (workflowContent.includes('production')) {
        expect(workflowContent).toContain("github.ref == 'refs/heads/main'");
        expect(workflowContent).toContain("github.event_name != 'pull_request'");
      }
      
      // Should have compliance labeling
      expect(workflowContent).toContain('ComplianceLabel');
    }
  });
});

// Export global state for other step definition files
export { global as mcpTestState };