#!/usr/bin/env node

/**
 * Grafana Dashboard Generator for CI/CD Pipeline Observability
 * Creates comprehensive real-time dashboards for pipeline health and performance
 */

import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

class GrafanaDashboardGenerator {
  constructor(options = {}) {
    this.metricsSource = options.metricsSource || 'prometheus';
    this.dashboardType = options.dashboardType || 'grafana';
    this.exportPath = options.exportPath || '.github/observability-data/dashboards';
    this.sessionId = options.sessionId;
    
    this.datasourceUid = 'prometheus-uid';
    this.refreshInterval = '30s';
  }

  generateObservabilityDashboard() {
    return {
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: "-- Grafana --",
            enable: true,
            hide: true,
            iconColor: "rgba(0, 211, 255, 1)",
            name: "Annotations & Alerts",
            type: "dashboard"
          }
        ]
      },
      editable: true,
      gnetId: null,
      graphTooltip: 0,
      id: null,
      links: [],
      panels: [
        this.createSummaryPanel(),
        this.createWorkflowSuccessRatePanel(),
        this.createLatencyPanel(),
        this.createErrorRatePanel(),
        this.createThroughputPanel(),
        this.createResourceUtilizationPanel(),
        this.createAnomalyDetectionPanel(),
        this.createRecentAlertsPanel()
      ],
      refresh: this.refreshInterval,
      schemaVersion: 16,
      style: "dark",
      tags: ["ci-cd", "observability", "github-actions"],
      templating: {
        list: [
          {
            current: {
              selected: false,
              text: "All",
              value: "$__all"
            },
            datasource: this.datasourceUid,
            definition: "label_values(github_workflow_runs_total, workflow)",
            hide: 0,
            includeAll: true,
            label: "Workflow",
            multi: true,
            name: "workflow",
            options: [],
            query: "label_values(github_workflow_runs_total, workflow)",
            refresh: 1,
            regex: "",
            skipUrlSync: false,
            sort: 0,
            tagValuesQuery: "",
            tags: [],
            tagsQuery: "",
            type: "query",
            useTags: false
          }
        ]
      },
      time: {
        from: "now-24h",
        to: "now"
      },
      timepicker: {},
      timezone: "",
      title: "CI/CD Pipeline Observability",
      uid: "cicd-observability",
      version: 1
    };
  }

  createSummaryPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "thresholds"
          },
          custom: {
            align: "auto",
            displayMode: "auto"
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "red",
                value: 80
              }
            ]
          }
        },
        overrides: []
      },
      gridPos: {
        h: 8,
        w: 24,
        x: 0,
        y: 0
      },
      id: 1,
      options: {
        showHeader: true
      },
      pluginVersion: "8.0.0",
      targets: [
        {
          expr: "github_workflow_slo_compliance",
          format: "table",
          instant: true,
          interval: "",
          legendFormat: "",
          refId: "A"
        }
      ],
      title: "SLO Compliance Summary",
      type: "table"
    };
  }

  createWorkflowSuccessRatePanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "line",
            fillOpacity: 10,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "never",
            spanNulls: true,
            stacking: {
              group: "A",
              mode: "none"
            },
            thresholdsStyle: {
              mode: "off"
            }
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 8
      },
      id: 2,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "single"
        }
      },
      targets: [
        {
          expr: "rate(github_workflow_runs_total{status=\"success\",workflow=~\"$workflow\"}[5m]) / rate(github_workflow_runs_total{workflow=~\"$workflow\"}[5m]) * 100",
          interval: "",
          legendFormat: "{{workflow}}",
          refId: "A"
        }
      ],
      title: "Workflow Success Rate",
      type: "timeseries"
    };
  }

  createLatencyPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "line",
            fillOpacity: 10,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "never",
            spanNulls: true,
            stacking: {
              group: "A",
              mode: "none"
            },
            thresholdsStyle: {
              mode: "line"
            }
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "yellow",
                value: 300
              },
              {
                color: "red",
                value: 600
              }
            ]
          },
          unit: "s"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 12,
        y: 8
      },
      id: 3,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "single"
        }
      },
      targets: [
        {
          expr: "histogram_quantile(0.95, rate(github_action_execution_seconds_bucket{workflow=~\"$workflow\"}[5m]))",
          interval: "",
          legendFormat: "P95 {{workflow}}",
          refId: "A"
        },
        {
          expr: "histogram_quantile(0.50, rate(github_action_execution_seconds_bucket{workflow=~\"$workflow\"}[5m]))",
          interval: "",
          legendFormat: "P50 {{workflow}}",
          refId: "B"
        }
      ],
      title: "Workflow Execution Latency",
      type: "timeseries"
    };
  }

  createErrorRatePanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "thresholds"
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "yellow",
                value: 0.1
              },
              {
                color: "red",
                value: 1
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 6,
        x: 0,
        y: 17
      },
      id: 4,
      options: {
        orientation: "auto",
        reduceOptions: {
          calcs: [
            "lastNotNull"
          ],
          fields: "",
          values: false
        },
        showThresholdLabels: false,
        showThresholdMarkers: true,
        text: {}
      },
      pluginVersion: "8.0.0",
      targets: [
        {
          expr: "github_workflow_error_rate{workflow=~\"$workflow\"}",
          interval: "",
          legendFormat: "{{workflow}}",
          refId: "A"
        }
      ],
      title: "Current Error Rate",
      type: "gauge"
    };
  }

  createThroughputPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "bars",
            fillOpacity: 100,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "never",
            spanNulls: true,
            stacking: {
              group: "A",
              mode: "normal"
            },
            thresholdsStyle: {
              mode: "off"
            }
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              }
            ]
          },
          unit: "short"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 9,
        x: 6,
        y: 17
      },
      id: 5,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "single"
        }
      },
      targets: [
        {
          expr: "rate(github_workflow_runs_total{workflow=~\"$workflow\"}[1h]) * 3600",
          interval: "",
          legendFormat: "{{workflow}}",
          refId: "A"
        }
      ],
      title: "Workflow Throughput (runs/hour)",
      type: "timeseries"
    };
  }

  createResourceUtilizationPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "thresholds"
          },
          mappings: [],
          max: 100,
          min: 0,
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "yellow",
                value: 70
              },
              {
                color: "red",
                value: 90
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 9,
        x: 15,
        y: 17
      },
      id: 6,
      options: {
        orientation: "auto",
        reduceOptions: {
          calcs: [
            "lastNotNull"
          ],
          fields: "",
          values: false
        },
        showThresholdLabels: false,
        showThresholdMarkers: true,
        text: {}
      },
      pluginVersion: "8.0.0",
      targets: [
        {
          expr: "avg(github_runner_resource_utilization{resource_type=\"cpu\",workflow=~\"$workflow\"})",
          interval: "",
          legendFormat: "CPU",
          refId: "A"
        },
        {
          expr: "avg(github_runner_resource_utilization{resource_type=\"memory\",workflow=~\"$workflow\"})",
          interval: "",
          legendFormat: "Memory",
          refId: "B"
        }
      ],
      title: "Resource Utilization",
      type: "gauge"
    };
  }

  createAnomalyDetectionPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "line",
            fillOpacity: 10,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 2,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "always",
            spanNulls: false,
            stacking: {
              group: "A",
              mode: "none"
            },
            thresholdsStyle: {
              mode: "line"
            }
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "red",
                value: 0.8
              }
            ]
          },
          unit: "short"
        },
        overrides: [
          {
            matcher: {
              id: "byName",
              options: "Anomaly Threshold"
            },
            properties: [
              {
                id: "color",
                value: {
                  fixedColor: "red",
                  mode: "fixed"
                }
              },
              {
                id: "custom.drawStyle",
                value: "line"
              },
              {
                id: "custom.lineStyle",
                value: {
                  dash: [10, 10],
                  fill: "dash"
                }
              }
            ]
          }
        ]
      },
      gridPos: {
        h: 8,
        w: 12,
        x: 0,
        y: 26
      },
      id: 7,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "single"
        }
      },
      targets: [
        {
          expr: "ml_anomaly_confidence_score",
          interval: "",
          legendFormat: "Anomaly Confidence",
          refId: "A"
        },
        {
          expr: "0.85",
          interval: "",
          legendFormat: "Anomaly Threshold",
          refId: "B"
        }
      ],
      title: "ML Anomaly Detection",
      type: "timeseries"
    };
  }

  createRecentAlertsPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "thresholds"
          },
          custom: {
            align: "auto",
            displayMode: "color-background"
          },
          mappings: [
            {
              options: {
                "critical": {
                  color: "red",
                  index: 0
                },
                "warning": {
                  color: "yellow",
                  index: 1
                },
                "info": {
                  color: "green",
                  index: 2
                }
              },
              type: "value"
            }
          ],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              }
            ]
          }
        },
        overrides: []
      },
      gridPos: {
        h: 8,
        w: 12,
        x: 12,
        y: 26
      },
      id: 8,
      options: {
        showHeader: true
      },
      pluginVersion: "8.0.0",
      targets: [
        {
          expr: "increase(alertmanager_notifications_total[1h])",
          format: "table",
          instant: true,
          interval: "",
          legendFormat: "",
          refId: "A"
        }
      ],
      title: "Recent Alerts (Last Hour)",
      transformations: [
        {
          id: "organize",
          options: {
            excludeByName: {},
            indexByName: {},
            renameByName: {
              "Value": "Count",
              "__name__": "Metric",
              "alertname": "Alert",
              "severity": "Severity"
            }
          }
        }
      ],
      type: "table"
    };
  }

  generateSLODashboard() {
    return {
      annotations: {
        list: []
      },
      editable: true,
      gnetId: null,
      graphTooltip: 0,
      id: null,
      links: [],
      panels: [
        this.createSLOOverviewPanel(),
        this.createAvailabilitySLOPanel(),
        this.createLatencySLOPanel(),
        this.createErrorBudgetPanel(),
        this.createSLOTrendsPanel()
      ],
      refresh: this.refreshInterval,
      schemaVersion: 16,
      style: "dark",
      tags: ["slo", "sli", "error-budget"],
      templating: {
        list: []
      },
      time: {
        from: "now-7d",
        to: "now"
      },
      timepicker: {},
      timezone: "",
      title: "SLO Dashboard",
      uid: "slo-dashboard",
      version: 1
    };
  }

  createSLOOverviewPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "thresholds"
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "red",
                value: null
              },
              {
                color: "yellow",
                value: 95
              },
              {
                color: "green",
                value: 99.9
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 8,
        w: 24,
        x: 0,
        y: 0
      },
      id: 1,
      options: {
        displayMode: "gradient",
        orientation: "horizontal",
        reduceOptions: {
          calcs: [
            "lastNotNull"
          ],
          fields: "",
          values: false
        },
        showUnfilled: true,
        text: {}
      },
      pluginVersion: "8.0.0",
      targets: [
        {
          expr: "github_workflow_slo_compliance{metric_type=\"availability\"}",
          interval: "",
          legendFormat: "Availability SLO",
          refId: "A"
        },
        {
          expr: "github_workflow_slo_compliance{metric_type=\"latency_avg\"} / github_workflow_slo_compliance{metric_type=\"latency_avg\"} * 95",
          interval: "",
          legendFormat: "Latency SLO",
          refId: "B"
        },
        {
          expr: "(100 - github_workflow_error_rate) / 100 * 100",
          interval: "",
          legendFormat: "Error Rate SLO",
          refId: "C"
        }
      ],
      title: "SLO Compliance Overview",
      type: "bargauge"
    };
  }

  createAvailabilitySLOPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "line",
            fillOpacity: 10,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "never",
            spanNulls: true,
            stacking: {
              group: "A",
              mode: "none"
            },
            thresholdsStyle: {
              mode: "line"
            }
          },
          mappings: [],
          max: 100,
          min: 90,
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "red",
                value: 99.9
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 8
      },
      id: 2,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "single"
        }
      },
      targets: [
        {
          expr: "github_workflow_slo_compliance{metric_type=\"availability\"}",
          interval: "",
          legendFormat: "Current Availability",
          refId: "A"
        },
        {
          expr: "99.9",
          interval: "",
          legendFormat: "SLO Target (99.9%)",
          refId: "B"
        }
      ],
      title: "Availability SLO",
      type: "timeseries"
    };
  }

  createLatencySLOPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "line",
            fillOpacity: 10,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "never",
            spanNulls: true,
            stacking: {
              group: "A",
              mode: "none"
            },
            thresholdsStyle: {
              mode: "line"
            }
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              },
              {
                color: "red",
                value: 5000
              }
            ]
          },
          unit: "ms"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 12,
        y: 8
      },
      id: 3,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "single"
        }
      },
      targets: [
        {
          expr: "histogram_quantile(0.95, rate(github_action_execution_seconds_bucket[5m])) * 1000",
          interval: "",
          legendFormat: "P95 Latency",
          refId: "A"
        },
        {
          expr: "5000",
          interval: "",
          legendFormat: "SLO Target (5000ms)",
          refId: "B"
        }
      ],
      title: "Latency SLO (P95)",
      type: "timeseries"
    };
  }

  createErrorBudgetPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "thresholds"
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "red",
                value: null
              },
              {
                color: "yellow",
                value: 25
              },
              {
                color: "green",
                value: 50
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 17
      },
      id: 4,
      options: {
        orientation: "auto",
        reduceOptions: {
          calcs: [
            "lastNotNull"
          ],
          fields: "",
          values: false
        },
        showThresholdLabels: false,
        showThresholdMarkers: true,
        text: {}
      },
      pluginVersion: "8.0.0",
      targets: [
        {
          expr: "slo_error_budget_remaining",
          interval: "",
          legendFormat: "Error Budget Remaining",
          refId: "A"
        }
      ],
      title: "Error Budget Remaining",
      type: "gauge"
    };
  }

  createSLOTrendsPanel() {
    return {
      datasource: this.datasourceUid,
      fieldConfig: {
        defaults: {
          color: {
            mode: "palette-classic"
          },
          custom: {
            axisLabel: "",
            axisPlacement: "auto",
            barAlignment: 0,
            drawStyle: "line",
            fillOpacity: 10,
            gradientMode: "none",
            hideFrom: {
              legend: false,
              tooltip: false,
              vis: false
            },
            lineInterpolation: "linear",
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: "linear"
            },
            showPoints: "never",
            spanNulls: true,
            stacking: {
              group: "A",
              mode: "none"
            },
            thresholdsStyle: {
              mode: "off"
            }
          },
          mappings: [],
          thresholds: {
            mode: "absolute",
            steps: [
              {
                color: "green",
                value: null
              }
            ]
          },
          unit: "percent"
        },
        overrides: []
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 12,
        y: 17
      },
      id: 5,
      options: {
        legend: {
          calcs: [],
          displayMode: "list",
          placement: "bottom"
        },
        tooltip: {
          mode: "multi"
        }
      },
      targets: [
        {
          expr: "avg_over_time(github_workflow_slo_compliance{metric_type=\"availability\"}[24h])",
          interval: "",
          legendFormat: "24h Avg Availability",
          refId: "A"
        },
        {
          expr: "avg_over_time(slo_error_budget_remaining[24h])",
          interval: "",
          legendFormat: "24h Avg Error Budget",
          refId: "B"
        }
      ],
      title: "SLO Trends (24h Average)",
      type: "timeseries"
    };
  }

  async generateAllDashboards() {
    consola.info('🎨 Generating Grafana dashboards');

    await fs.ensureDir(this.exportPath);

    try {
      // Generate main observability dashboard
      const observabilityDashboard = this.generateObservabilityDashboard();
      await fs.writeJson(
        path.join(this.exportPath, 'observability-dashboard.json'),
        observabilityDashboard,
        { spaces: 2 }
      );

      // Generate SLO dashboard
      const sloDashboard = this.generateSLODashboard();
      await fs.writeJson(
        path.join(this.exportPath, 'slo-dashboard.json'),
        sloDashboard,
        { spaces: 2 }
      );

      // Generate dashboard list
      const dashboardList = {
        dashboards: [
          {
            title: "CI/CD Pipeline Observability",
            uid: "cicd-observability",
            url: "/d/cicd-observability/ci-cd-pipeline-observability",
            description: "Comprehensive observability for CI/CD pipeline health and performance"
          },
          {
            title: "SLO Dashboard",
            uid: "slo-dashboard", 
            url: "/d/slo-dashboard/slo-dashboard",
            description: "Service Level Objectives tracking and error budget monitoring"
          }
        ],
        generatedAt: this.getDeterministicDate().toISOString(),
        version: "1.0.0"
      };

      await fs.writeJson(
        path.join(this.exportPath, 'dashboard-list.json'),
        dashboardList,
        { spaces: 2 }
      );

      consola.success(`✅ Generated ${dashboardList.dashboards.length} Grafana dashboards`);

      return {
        success: true,
        dashboards: dashboardList.dashboards,
        exportPath: this.exportPath
      };

    } catch (error) {
      consola.error('Failed to generate dashboards:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = value;
  }

  const generator = new GrafanaDashboardGenerator(options);

  try {
    consola.info('🎨 Starting Grafana dashboard generation');

    const result = await generator.generateAllDashboards();

    console.log('\n📊 Generated Dashboards:');
    result.dashboards.forEach(dashboard => {
      console.log(`  - ${dashboard.title} (${dashboard.uid})`);
    });

    consola.success('🎉 Dashboard generation completed successfully');
    process.exit(0);

  } catch (error) {
    consola.error('💥 Dashboard generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { GrafanaDashboardGenerator };