---
to: config/{{ configName | kebabCase }}.json
---
{
  "name": "{{ configName }}",
  "version": "{{ version | default('1.0.0') }}",
  "services": [
    {{#each services}}
    {
      "name": "{{ this.name }}",
      "port": {{ this.port }}
    }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}
