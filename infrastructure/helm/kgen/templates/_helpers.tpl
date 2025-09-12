{{/*
Expand the name of the chart.
*/}}
{{- define "kgen.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "kgen.fullname" -}}
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
{{- define "kgen.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kgen.labels" -}}
helm.sh/chart: {{ include "kgen.chart" . }}
{{ include "kgen.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kgen.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kgen.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kgen.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kgen.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the proper Docker Image Registry Secret Names
*/}}
{{- define "kgen.imagePullSecrets" -}}
{{- include "common.images.pullSecrets" (dict "images" (list .Values.image) "global" .Values.global) -}}
{{- end }}

{{/*
Return the proper image name
*/}}
{{- define "kgen.image" -}}
{{- include "common.images.image" (dict "imageRoot" .Values.image "global" .Values.global) -}}
{{- end }}

{{/*
Return the proper Storage Class
*/}}
{{- define "kgen.storageClass" -}}
{{- include "common.storage.class" (dict "persistence" .Values.persistence "global" .Values.global) -}}
{{- end }}

{{/*
Create a default fully qualified postgresql name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "kgen.postgresql.fullname" -}}
{{- if .Values.database.postgresql.fullnameOverride -}}
{{- .Values.database.postgresql.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "postgresql" .Values.database.postgresql.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Return PostgreSQL service name
*/}}
{{- define "kgen.databaseHost" -}}
{{- if .Values.database.external.enabled -}}
{{- .Values.database.external.host -}}
{{- else if .Values.database.postgresql.enabled -}}
{{- include "kgen.postgresql.fullname" . -}}
{{- end -}}
{{- end -}}

{{/*
Return PostgreSQL port
*/}}
{{- define "kgen.databasePort" -}}
{{- if .Values.database.external.enabled -}}
{{- .Values.database.external.port -}}
{{- else if .Values.database.postgresql.enabled -}}
{{- 5432 -}}
{{- end -}}
{{- end -}}

{{/*
Return PostgreSQL database name
*/}}
{{- define "kgen.databaseName" -}}
{{- if .Values.database.external.enabled -}}
{{- .Values.database.external.database -}}
{{- else if .Values.database.postgresql.enabled -}}
{{- .Values.database.postgresql.auth.database -}}
{{- end -}}
{{- end -}}

{{/*
Return PostgreSQL username
*/}}
{{- define "kgen.databaseUsername" -}}
{{- if .Values.database.external.enabled -}}
{{- .Values.database.external.username -}}
{{- else if .Values.database.postgresql.enabled -}}
{{- .Values.database.postgresql.auth.username -}}
{{- end -}}
{{- end -}}

{{/*
Return PostgreSQL secret name
*/}}
{{- define "kgen.databaseSecretName" -}}
{{- if .Values.database.external.enabled -}}
{{- .Values.database.external.existingSecret -}}
{{- else if .Values.database.postgresql.enabled -}}
{{- include "kgen.postgresql.fullname" . -}}
{{- end -}}
{{- end -}}

{{/*
Return PostgreSQL secret key
*/}}
{{- define "kgen.databaseSecretPasswordKey" -}}
{{- if .Values.database.external.enabled -}}
{{- .Values.database.external.existingSecretPasswordKey -}}
{{- else if .Values.database.postgresql.enabled -}}
{{- "postgres-password" -}}
{{- end -}}
{{- end -}}

{{/*
Create a default fully qualified redis name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "kgen.redis.fullname" -}}
{{- if .Values.redis.fullnameOverride -}}
{{- .Values.redis.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "redis" .Values.redis.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Return Redis host
*/}}
{{- define "kgen.redis.host" -}}
{{- if .Values.redis.enabled -}}
{{- include "kgen.redis.fullname" . -}}-master
{{- end -}}
{{- end -}}

{{/*
Return Redis secret name
*/}}
{{- define "kgen.redis.secretName" -}}
{{- if .Values.redis.enabled -}}
{{- include "kgen.redis.fullname" . -}}
{{- end -}}
{{- end -}}

{{/*
Return Redis secret key
*/}}
{{- define "kgen.redis.secretPasswordKey" -}}
{{- if .Values.redis.enabled -}}
{{- "redis-password" -}}
{{- end -}}
{{- end -}}

{{/*
Validate values
*/}}
{{- define "kgen.validateValues" -}}
{{- $messages := list -}}
{{- $messages := append $messages (include "kgen.validateValues.database" .) -}}
{{- $messages := without $messages "" -}}
{{- $message := join "\n" $messages -}}
{{- if $message -}}
{{- printf "\nVALUES VALIDATION:\n%s" $message | fail -}}
{{- end -}}
{{- end -}}

{{/*
Validate database configuration
*/}}
{{- define "kgen.validateValues.database" -}}
{{- if and (not .Values.database.external.enabled) (not .Values.database.postgresql.enabled) -}}
kgen: database
    You must enable either external database or internal PostgreSQL.
    Please set either:
      - database.external.enabled=true
      - database.postgresql.enabled=true
{{- end -}}
{{- end -}}

{{/*
Compile all warnings into a single message, and call fail.
*/}}
{{- define "kgen.warnings" -}}
{{- $messages := list -}}
{{- $messages := append $messages (include "kgen.validateValues" .) -}}
{{- $messages := without $messages "" -}}
{{- $message := join "\n" $messages -}}
{{- if $message -}}
{{- printf "\nWARNINGS:\n%s" $message -}}
{{- end -}}
{{- end -}}