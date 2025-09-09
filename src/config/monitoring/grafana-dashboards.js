/**
 * Grafana Dashboard Specifications
 * Production-ready dashboard configurations for monitoring Unjucks enterprise services
 */

import { env } from '../../server/config/environment.js';

/**
 * Dashboard configuration templates
 */
export const DashboardTemplates = {
  /**
   * Main Service Overview Dashboard
   */
  SERVICE_OVERVIEW: {
    id: 'unjucks-service-overview',
    title: 'Unjucks Enterprise - Service Overview',
    tags: ['unjucks', 'overview', 'production'],
    timezone: 'browser',
    refresh: '30s',
    time: {
      from: 'now-1h',
      to: 'now'
    },
    variables: [
      {
        name: 'environment',
        type: 'custom',
        options: ['production', 'staging', 'development'],
        current: env.NODE_ENV
      },
      {
        name: 'instance',
        type: 'query',
        query: 'label_values(unjucks_http_requests_total, instance)',
        current: 'all'
      }
    ],
    panels: [
      // Row: Service Health
      {
        type: 'row',
        title: 'Service Health & Availability',
        collapsed: false,
        panels: [
          {
            id: 1,
            title: 'Service Status',
            type: 'stat',
            targets: [
              {
                expr: 'up{job="unjucks-enterprise"}',
                legendFormat: '{{instance}}'
              }
            ],
            fieldConfig: {
              defaults: {
                color: { mode: 'thresholds' },
                thresholds: {
                  steps: [
                    { color: 'red', value: 0 },
                    { color: 'green', value: 1 }
                  ]
                },
                mappings: [
                  { options: { '0': { text: 'DOWN' } } },
                  { options: { '1': { text: 'UP' } } }
                ]
              }
            },
            gridPos: { h: 8, w: 6, x: 0, y: 0 }
          },
          {
            id: 2,
            title: 'Uptime',
            type: 'stat',
            targets: [
              {
                expr: '(time() - process_start_time_seconds{job="unjucks-enterprise"}) / 86400',
                legendFormat: 'Days'
              }
            ],
            fieldConfig: {
              defaults: {
                unit: 'd',
                decimals: 1,
                color: { mode: 'value' }
              }
            },
            gridPos: { h: 8, w: 6, x: 6, y: 0 }
          },
          {
            id: 3,
            title: 'Health Check Status',
            type: 'table',
            targets: [
              {
                expr: 'unjucks_health_check_status',
                legendFormat: '{{check_name}}',
                format: 'table',
                instant: true
              }
            ],
            transformations: [
              {
                id: 'organize',
                options: {
                  excludeByName: { Time: true, __name__: true },
                  renameByName: {
                    check_name: 'Health Check',
                    Value: 'Status'
                  }
                }
              }
            ],
            fieldConfig: {
              overrides: [
                {
                  matcher: { id: 'byName', options: 'Status' },
                  properties: [
                    {
                      id: 'mappings',
                      value: [
                        { options: { '0': { text: 'UNHEALTHY', color: 'red' } } },
                        { options: { '1': { text: 'HEALTHY', color: 'green' } } }
                      ]
                    }
                  ]
                }
              ]
            },
            gridPos: { h: 8, w: 12, x: 12, y: 0 }
          }
        ]
      },
      // Row: Request Metrics
      {
        type: 'row',
        title: 'HTTP Request Metrics',
        collapsed: false,
        panels: [
          {
            id: 4,
            title: 'Request Rate',
            type: 'graph',
            targets: [
              {
                expr: 'rate(unjucks_http_requests_total[5m])',
                legendFormat: '{{method}} {{path}} ({{status_code}})'
              }
            ],
            yAxes: [
              {
                label: 'Requests/sec',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 12, x: 0, y: 8 }
          },
          {
            id: 5,
            title: 'Response Time (95th percentile)',
            type: 'graph',
            targets: [
              {
                expr: 'histogram_quantile(0.95, rate(unjucks_http_request_duration_seconds_bucket[5m]))',
                legendFormat: '95th percentile'
              },
              {
                expr: 'histogram_quantile(0.50, rate(unjucks_http_request_duration_seconds_bucket[5m]))',
                legendFormat: '50th percentile'
              }
            ],
            yAxes: [
              {
                label: 'Seconds',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 12, x: 12, y: 8 }
          }
        ]
      },
      // Row: Business Metrics
      {
        type: 'row',
        title: 'Business KPIs',
        collapsed: false,
        panels: [
          {
            id: 6,
            title: 'Templates Generated',
            type: 'graph',
            targets: [
              {
                expr: 'rate(unjucks_templates_generated_total[5m]) * 60',
                legendFormat: '{{template_type}} (per minute)'
              }
            ],
            yAxes: [
              {
                label: 'Templates/min',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 8, x: 0, y: 16 }
          },
          {
            id: 7,
            title: 'Template Generation Time',
            type: 'graph',
            targets: [
              {
                expr: 'histogram_quantile(0.95, rate(unjucks_template_generation_duration_seconds_bucket[5m]))',
                legendFormat: '95th percentile'
              }
            ],
            yAxes: [
              {
                label: 'Seconds',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 8, x: 8, y: 16 }
          },
          {
            id: 8,
            title: 'RDF Triples Processed',
            type: 'graph',
            targets: [
              {
                expr: 'rate(unjucks_rdf_triples_processed_total[5m])',
                legendFormat: '{{operation}} {{format}}'
              }
            ],
            yAxes: [
              {
                label: 'Triples/sec',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 8, x: 16, y: 16 }
          }
        ]
      },
      // Row: Error Metrics
      {
        type: 'row',
        title: 'Error Tracking',
        collapsed: false,
        panels: [
          {
            id: 9,
            title: 'Error Rate',
            type: 'graph',
            targets: [
              {
                expr: 'rate(unjucks_errors_total[5m])',
                legendFormat: '{{error_type}} ({{severity}})'
              }
            ],
            yAxes: [
              {
                label: 'Errors/sec',
                min: 0
              }
            ],
            alert: {
              conditions: [
                {
                  query: { queryType: '', refId: 'A' },
                  reducer: { type: 'last', params: [] },
                  evaluator: { params: [0.1], type: 'gt' }
                }
              ],
              executionErrorState: 'alerting',
              noDataState: 'no_data',
              frequency: '10s',
              handler: 1,
              name: 'High Error Rate',
              message: 'Error rate is above 0.1 errors per second'
            },
            gridPos: { h: 8, w: 12, x: 0, y: 24 }
          },
          {
            id: 10,
            title: 'HTTP Error Responses',
            type: 'graph',
            targets: [
              {
                expr: 'rate(unjucks_http_requests_total{status_code=~"4..|5.."}[5m])',
                legendFormat: '{{status_code}} {{method}} {{path}}'
              }
            ],
            yAxes: [
              {
                label: 'Errors/sec',
                min: 0
              }
            ],
            gridPos: { h: 8, w: 12, x: 12, y: 24 }
          }
        ]
      }
    ]
  },

  /**
   * System Resources Dashboard
   */
  SYSTEM_RESOURCES: {
    id: 'unjucks-system-resources',
    title: 'Unjucks Enterprise - System Resources',
    tags: ['unjucks', 'system', 'resources'],
    timezone: 'browser',
    refresh: '30s',
    time: {
      from: 'now-1h',
      to: 'now'
    },
    panels: [
      // Memory Usage
      {
        id: 1,
        title: 'Memory Usage',
        type: 'graph',
        targets: [
          {
            expr: 'unjucks_memory_usage_bytes{type="heap_used"} / 1024 / 1024',
            legendFormat: 'Heap Used (MB)'
          },
          {
            expr: 'unjucks_memory_usage_bytes{type="heap_total"} / 1024 / 1024',
            legendFormat: 'Heap Total (MB)'
          },
          {
            expr: 'unjucks_memory_usage_bytes{type="rss"} / 1024 / 1024',
            legendFormat: 'RSS (MB)'
          }
        ],
        yAxes: [
          {
            label: 'MB',
            min: 0
          }
        ],
        alert: {
          conditions: [
            {
              query: { queryType: '', refId: 'A' },
              reducer: { type: 'last', params: [] },
              evaluator: { params: [1024], type: 'gt' } // Alert if heap > 1GB
            }
          ],
          name: 'High Memory Usage',
          message: 'Memory usage is above 1GB'
        },
        gridPos: { h: 8, w: 12, x: 0, y: 0 }
      },
      // CPU Usage
      {
        id: 2,
        title: 'CPU Usage',
        type: 'graph',
        targets: [
          {
            expr: 'rate(process_cpu_seconds_total{job="unjucks-enterprise"}[5m]) * 100',
            legendFormat: 'CPU Usage (%)'
          }
        ],
        yAxes: [
          {
            label: 'Percent',
            min: 0,
            max: 100
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 0 }
      },
      // Event Loop Lag
      {
        id: 3,
        title: 'Event Loop Lag',
        type: 'graph',
        targets: [
          {
            expr: 'histogram_quantile(0.95, rate(unjucks_event_loop_lag_seconds_bucket[5m])) * 1000',
            legendFormat: '95th percentile (ms)'
          }
        ],
        yAxes: [
          {
            label: 'Milliseconds',
            min: 0
          }
        ],
        alert: {
          conditions: [
            {
              query: { queryType: '', refId: 'A' },
              reducer: { type: 'last', params: [] },
              evaluator: { params: [100], type: 'gt' }
            }
          ],
          name: 'High Event Loop Lag',
          message: 'Event loop lag is above 100ms'
        },
        gridPos: { h: 8, w: 12, x: 0, y: 8 }
      },
      // Garbage Collection
      {
        id: 4,
        title: 'Garbage Collection',
        type: 'graph',
        targets: [
          {
            expr: 'rate(nodejs_gc_duration_seconds_total[5m])',
            legendFormat: '{{kind}} GC'
          }
        ],
        yAxes: [
          {
            label: 'Seconds/sec',
            min: 0
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 8 }
      }
    ]
  },

  /**
   * SLI/SLO Monitoring Dashboard
   */
  SLI_SLO_MONITORING: {
    id: 'unjucks-sli-slo',
    title: 'Unjucks Enterprise - SLI/SLO Monitoring',
    tags: ['unjucks', 'sli', 'slo', 'reliability'],
    timezone: 'browser',
    refresh: '1m',
    time: {
      from: 'now-24h',
      to: 'now'
    },
    variables: [
      {
        name: 'slo_name',
        type: 'query',
        query: 'label_values(unjucks_slo_compliance, slo_name)',
        current: 'all'
      }
    ],
    panels: [
      // SLO Compliance Overview
      {
        id: 1,
        title: 'SLO Compliance Status',
        type: 'table',
        targets: [
          {
            expr: 'unjucks_slo_compliance{slo_name=~"$slo_name"}',
            format: 'table',
            instant: true
          }
        ],
        transformations: [
          {
            id: 'organize',
            options: {
              excludeByName: { Time: true, __name__: true, instance: true, job: true },
              renameByName: {
                slo_name: 'SLO Name',
                target: 'Target',
                Value: 'Current Value',
                time_window: 'Time Window'
              }
            }
          }
        ],
        fieldConfig: {
          overrides: [
            {
              matcher: { id: 'byName', options: 'Current Value' },
              properties: [
                {
                  id: 'thresholds',
                  value: {
                    steps: [
                      { color: 'red', value: 0 },
                      { color: 'yellow', value: 95 },
                      { color: 'green', value: 99 }
                    ]
                  }
                }
              ]
            }
          ]
        },
        gridPos: { h: 8, w: 24, x: 0, y: 0 }
      },
      // Error Budget Burn Rate
      {
        id: 2,
        title: 'Error Budget Burn Rate',
        type: 'graph',
        targets: [
          {
            expr: 'unjucks_slo_error_budget_burn_rate{slo_name=~"$slo_name"}',
            legendFormat: '{{slo_name}} Burn Rate'
          }
        ],
        yAxes: [
          {
            label: 'Budget %/hour',
            min: 0
          }
        ],
        alert: {
          conditions: [
            {
              query: { queryType: '', refId: 'A' },
              reducer: { type: 'last', params: [] },
              evaluator: { params: [5], type: 'gt' } // Alert if burning > 5% per hour
            }
          ],
          name: 'High Error Budget Burn Rate',
          message: 'Error budget is burning faster than 5% per hour'
        },
        gridPos: { h: 8, w: 12, x: 0, y: 8 }
      },
      // Remaining Error Budget
      {
        id: 3,
        title: 'Remaining Error Budget',
        type: 'graph',
        targets: [
          {
            expr: 'unjucks_slo_error_budget_remaining{slo_name=~"$slo_name"}',
            legendFormat: '{{slo_name}} Remaining Budget'
          }
        ],
        yAxes: [
          {
            label: 'Percent',
            min: 0,
            max: 100
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 8 }
      }
    ]
  },

  /**
   * Security & Audit Dashboard
   */
  SECURITY_AUDIT: {
    id: 'unjucks-security-audit',
    title: 'Unjucks Enterprise - Security & Audit',
    tags: ['unjucks', 'security', 'audit'],
    timezone: 'browser',
    refresh: '30s',
    time: {
      from: 'now-24h',
      to: 'now'
    },
    panels: [
      // Security Events
      {
        id: 1,
        title: 'Security Events',
        type: 'graph',
        targets: [
          {
            expr: 'rate(unjucks_security_events_total[5m])',
            legendFormat: '{{event_type}} ({{severity}})'
          }
        ],
        yAxes: [
          {
            label: 'Events/sec',
            min: 0
          }
        ],
        alert: {
          conditions: [
            {
              query: { queryType: '', refId: 'A' },
              reducer: { type: 'last', params: [] },
              evaluator: { params: [0.01], type: 'gt' }
            }
          ],
          name: 'Security Event Detected',
          message: 'Security events detected'
        },
        gridPos: { h: 8, w: 12, x: 0, y: 0 }
      },
      // Authentication Attempts
      {
        id: 2,
        title: 'Authentication Attempts',
        type: 'graph',
        targets: [
          {
            expr: 'rate(unjucks_authentication_attempts_total[5m])',
            legendFormat: '{{method}} {{outcome}}'
          }
        ],
        yAxes: [
          {
            label: 'Attempts/sec',
            min: 0
          }
        ],
        gridPos: { h: 8, w: 12, x: 12, y: 0 }
      },
      // Active Users
      {
        id: 3,
        title: 'Active Users',
        type: 'stat',
        targets: [
          {
            expr: 'unjucks_active_users_current',
            legendFormat: '{{session_type}}'
          }
        ],
        fieldConfig: {
          defaults: {
            color: { mode: 'value' },
            unit: 'short'
          }
        },
        gridPos: { h: 8, w: 12, x: 0, y: 8 }
      }
    ]
  }
};

/**
 * Alert rule templates
 */
export const AlertTemplates = {
  // High error rate alert
  HIGH_ERROR_RATE: {
    alert: {
      name: 'Unjucks High Error Rate',
      message: 'Error rate is above acceptable threshold',
      frequency: '30s',
      conditions: [
        {
          query: {
            queryType: '',
            refId: 'A',
            model: {
              expr: 'rate(unjucks_errors_total[5m])',
              interval: '',
              legendFormat: '',
              refId: 'A'
            }
          },
          reducer: {
            type: 'last',
            params: []
          },
          evaluator: {
            params: [0.05], // 0.05 errors/sec threshold
            type: 'gt'
          }
        }
      ],
      executionErrorState: 'alerting',
      noDataState: 'no_data',
      for: '2m'
    }
  },

  // High memory usage alert
  HIGH_MEMORY_USAGE: {
    alert: {
      name: 'Unjucks High Memory Usage',
      message: 'Memory usage is critically high',
      frequency: '1m',
      conditions: [
        {
          query: {
            queryType: '',
            refId: 'A',
            model: {
              expr: 'unjucks_memory_usage_bytes{type="heap_used"} / 1024 / 1024',
              interval: '',
              legendFormat: '',
              refId: 'A'
            }
          },
          reducer: {
            type: 'last',
            params: []
          },
          evaluator: {
            params: [2048], // 2GB threshold
            type: 'gt'
          }
        }
      ],
      executionErrorState: 'alerting',
      noDataState: 'no_data',
      for: '5m'
    }
  },

  // SLO violation alert
  SLO_VIOLATION: {
    alert: {
      name: 'Unjucks SLO Violation',
      message: 'Service Level Objective has been violated',
      frequency: '1m',
      conditions: [
        {
          query: {
            queryType: '',
            refId: 'A',
            model: {
              expr: 'unjucks_slo_compliance < bool 1',
              interval: '',
              legendFormat: '{{slo_name}}',
              refId: 'A'
            }
          },
          reducer: {
            type: 'last',
            params: []
          },
          evaluator: {
            params: [0.5], // Any violation
            type: 'gt'
          }
        }
      ],
      executionErrorState: 'alerting',
      noDataState: 'no_data',
      for: '1m'
    }
  }
};

/**
 * Dashboard generator utility
 */
export class GrafanaDashboardGenerator {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.apiKey = options.apiKey || process.env.GRAFANA_API_KEY;
    this.orgId = options.orgId || 1;
    this.datasourceUid = options.datasourceUid || 'prometheus';
  }

  /**
   * Generate dashboard JSON with customized parameters
   */
  generateDashboard(template, customizations = {}) {
    const dashboard = {
      ...template,
      ...customizations,
      uid: template.id,
      version: 1,
      schemaVersion: 30,
      graphTooltip: 1,
      links: [],
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: '-- Grafana --',
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard'
          }
        ]
      },
      editable: true,
      gnetId: null,
      hideControls: false,
      style: 'dark',
      templating: {
        list: template.variables || []
      }
    };

    // Update datasource references
    this.updateDatasourceReferences(dashboard);

    return dashboard;
  }

  /**
   * Update datasource references in dashboard
   */
  updateDatasourceReferences(dashboard) {
    const updateTargets = (obj) => {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach(updateTargets);
        } else {
          Object.keys(obj).forEach(key => {
            if (key === 'targets' && Array.isArray(obj[key])) {
              obj[key].forEach(target => {
                if (!target.datasource) {
                  target.datasource = { uid: this.datasourceUid };
                }
              });
            } else {
              updateTargets(obj[key]);
            }
          });
        }
      }
    };

    updateTargets(dashboard);
  }

  /**
   * Export all dashboard templates as JSON files
   */
  exportAllTemplates() {
    const exports = {};
    
    Object.entries(DashboardTemplates).forEach(([name, template]) => {
      exports[name] = this.generateDashboard(template);
    });
    
    return exports;
  }

  /**
   * Generate Grafana provisioning configuration
   */
  generateProvisioningConfig() {
    return {
      apiVersion: 1,
      providers: [
        {
          name: 'unjucks-dashboards',
          orgId: this.orgId,
          folder: 'Unjucks Enterprise',
          type: 'file',
          disableDeletion: false,
          updateIntervalSeconds: 10,
          allowUiUpdates: true,
          options: {
            path: '/etc/grafana/provisioning/dashboards/unjucks'
          }
        }
      ]
    };
  }

  /**
   * Generate datasource configuration
   */
  generateDatasourceConfig() {
    return {
      apiVersion: 1,
      datasources: [
        {
          name: 'Prometheus',
          type: 'prometheus',
          uid: this.datasourceUid,
          access: 'proxy',
          url: process.env.PROMETHEUS_URL || 'http://localhost:9090',
          basicAuth: false,
          isDefault: true,
          version: 1,
          editable: false,
          jsonData: {
            httpMethod: 'POST',
            timeInterval: '30s'
          }
        }
      ]
    };
  }
}

export default {
  DashboardTemplates,
  AlertTemplates,
  GrafanaDashboardGenerator
};
