---
name: "Enterprise Data Pipeline"
description: "Scalable ETL/ELT data pipeline with Apache Airflow, real-time streaming, and enterprise data governance"
category: "data-pipeline"
jtbd: "Build a robust data pipeline that handles batch and streaming data processing with governance, lineage tracking, and compliance controls"
tags:
  - data-pipeline
  - airflow
  - kafka
  - spark
  - etl
  - streaming
  - data-governance
compliance:
  standards:
    - SOC2
    - GDPR
    - CCPA
    - HIPAA
  certifications:
    - "Data Privacy Framework"
    - "ISO 27001"
  auditTrail: true
inject:
  - name: "airflow-dags"
    description: "Add DAGs to existing Airflow deployment"
    pattern: "# AIRFLOW DAGS INJECTION"
    type: "after"
  - name: "kafka-topics"
    description: "Add Kafka topics configuration"
    pattern: "# KAFKA TOPICS INJECTION"  
    type: "after"
variables:
  - name: "pipelineName"
    type: "string"
    description: "Name of the data pipeline"
    required: true
  - name: "orchestrator"
    type: "string"
    description: "Workflow orchestration engine"
    required: true
    options: ["airflow", "prefect", "dagster", "temporal"]
  - name: "streamingEngine"
    type: "string"
    description: "Stream processing engine"
    required: true
    options: ["kafka", "pulsar", "kinesis", "pubsub"]
  - name: "processingEngine"
    type: "string"
    description: "Data processing engine"
    required: true
    options: ["spark", "flink", "beam", "dask"]
  - name: "dataLake"
    type: "string"
    description: "Data lake storage"
    required: true
    options: ["s3", "gcs", "azure-blob", "minio"]
  - name: "dataWarehouse"
    type: "string"
    description: "Data warehouse"
    required: true
    options: ["snowflake", "bigquery", "redshift", "synapse"]
  - name: "catalogTool"
    type: "string"
    description: "Data catalog and governance tool"
    required: true
    options: ["datahub", "atlas", "amundsen", "collibra"]
  - name: "complianceFramework"
    type: "string"
    description: "Data compliance framework"
    required: true
    options: ["gdpr", "ccpa", "hipaa", "sox"]
rdf:
  ontology: "http://unjucks.dev/ontology/data-pipeline"
  properties:
    - "processesData"
    - "hasDataSource"
    - "hasDataSink"
    - "enforcesDLP"
---

# Enterprise Data Pipeline Template

Generates a comprehensive data pipeline with:

- **Orchestration**: Workflow management with dependency tracking
- **Streaming**: Real-time data processing with exactly-once semantics  
- **Batch Processing**: Large-scale data transformation and aggregation
- **Data Governance**: Lineage tracking, quality checks, and compliance
- **Security**: End-to-end encryption and access controls
- **Monitoring**: Pipeline health, data quality, and SLA monitoring

## Architecture Components

```
Data Sources → Ingestion → Processing → Storage → Consumption
     ↓            ↓           ↓          ↓          ↓
   APIs/DBs → Kafka/Kinesis → Spark → Data Lake → Analytics
                                        ↓
                                   Data Warehouse
```