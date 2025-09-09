{{/*
Expand the name of the chart.
*/}}
{{- define "unjucks-enterprise.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "unjucks-enterprise.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "unjucks-enterprise.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "unjucks-enterprise.labels" -}}
helm.sh/chart: {{ include "unjucks-enterprise.chart" . }}
{{ include "unjucks-enterprise.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "unjucks-enterprise.selectorLabels" -}}
app.kubernetes.io/name: {{ include "unjucks-enterprise.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "unjucks-enterprise.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "unjucks-enterprise.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate certificates secret name
*/}}
{{- define "unjucks-enterprise.certificatesSecret" -}}
{{- printf "%s-certificates" (include "unjucks-enterprise.fullname" .) -}}
{{- end }}

{{/*
Generate TLS secret name for ingress
*/}}
{{- define "unjucks-enterprise.tlsSecret" -}}
{{- printf "%s-tls" (include "unjucks-enterprise.fullname" .) -}}
{{- end }}

{{/*
Common enterprise security labels
*/}}
{{- define "unjucks-enterprise.securityLabels" -}}
security.unjucks.io/hardened: "true"
security.unjucks.io/scanned: "true"
security.unjucks.io/nonroot: "true"
compliance.unjucks.io/cis: "true"
compliance.unjucks.io/nist: "true"
{{- end }}

{{/*
Generate image repository
*/}}
{{- define "unjucks-enterprise.imageRepository" -}}
{{- if .Values.image.registry -}}
{{ .Values.image.registry }}/{{ .Values.image.repository }}
{{- else -}}
{{ .Values.image.repository }}
{{- end -}}
{{- end }}

{{/*
Generate image tag
*/}}
{{- define "unjucks-enterprise.imageTag" -}}
{{- .Values.image.tag | default .Chart.AppVersion -}}
{{- end }}

{{/*
Generate full image name
*/}}
{{- define "unjucks-enterprise.imageName" -}}
{{ include "unjucks-enterprise.imageRepository" . }}:{{ include "unjucks-enterprise.imageTag" . }}
{{- end }}